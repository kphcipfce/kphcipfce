import SocialMobilizerPlan from "../models/SocialMobilizerPlan.js";
import Team from "../models/Team.js";
import ActivityRecord from "../models/ActivityRecord.js";
import { logAction } from "../middleware/audit.js";

// Same pattern as coordinatorPlanController — Super Admin sees every plan in full (for
// oversight). A member sees only plans assigned to their own team, oldest-first, with occupied
// weeks removed from the picker: any week that already has a record — submitted, verified, or
// flagged — has been used up for the whole team (occupancy isn't per-attendee here, unlike the
// old fixed calendar; whichever teammate submits first uses up the week for both). Different
// weeks (even sharing the same date, since the admin can assign more than one) are unaffected.
export async function listSocialMobilizerPlans(req, res) {
  if (req.user.role === "super_admin") {
    const plans = await SocialMobilizerPlan.find({}).populate("teams", "name").populate("createdBy", "name").sort("-createdAt");
    return res.json(plans);
  }

  const plans = await SocialMobilizerPlan.find({ teams: req.user.team })
    .populate("teams", "name")
    .populate("createdBy", "name")
    .sort("createdAt")
    .lean();

  const occupied = await ActivityRecord.find({
    team: req.user.team,
    status: { $in: ["submitted", "verified", "flagged"] },
    plan: { $in: plans.map((p) => p._id) },
  }).select("planWeek");
  const occupiedWeekIds = new Set(occupied.map((a) => String(a.planWeek)));

  for (const plan of plans) {
    plan.weeks = plan.weeks.filter((w) => !occupiedWeekIds.has(String(w._id)));
  }
  res.json(plans);
}

export async function createSocialMobilizerPlan(req, res) {
  const { month, year, weeks, teams } = req.body;
  if (!month || month < 1 || month > 12 || !year) {
    return res.status(400).json({ error: "Valid month (1-12) and year required" });
  }
  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.some((w) => !w.date || !w.dayOfWeek)) {
    return res.status(400).json({ error: "At least one week with a date and day of week required" });
  }
  if (!Array.isArray(teams) || teams.length === 0) {
    return res.status(400).json({ error: "At least one team must be assigned" });
  }

  const foundTeams = await Team.find({ _id: { $in: teams } });
  if (foundTeams.length !== teams.length) return res.status(400).json({ error: "One or more teams not found" });

  // weekNumber is assigned server-side from array order, never trusted from the client.
  const normalizedWeeks = weeks.map((w, i) => ({ weekNumber: i + 1, date: w.date, dayOfWeek: w.dayOfWeek }));

  const plan = await SocialMobilizerPlan.create({ month, year, weeks: normalizedWeeks, teams, createdBy: req.user._id });
  await logAction(req.user._id, "create", "SocialMobilizerPlan", plan._id, { month, year, teams });
  res.status(201).json(plan);
}

// Same rule as coordinator/GRM plan deletion: blocked while real activity records reference it,
// so a deletion can never orphan submitted evidence.
export async function deleteSocialMobilizerPlan(req, res) {
  const plan = await SocialMobilizerPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found" });

  const inUse = await ActivityRecord.exists({ plan: plan._id });
  if (inUse) return res.status(400).json({ error: "Cannot delete a plan that has activity records referencing it" });

  await plan.deleteOne();
  await logAction(req.user._id, "delete", "SocialMobilizerPlan", plan._id, { month: plan.month, year: plan.year });
  res.status(204).end();
}
