import SocialMobilizerPlan from "../models/SocialMobilizerPlan.js";
import Team from "../models/Team.js";
import ActivityRecord from "../models/ActivityRecord.js";
import AttendanceEntry from "../models/AttendanceEntry.js";
import { logAction } from "../middleware/audit.js";

// Same pattern as coordinatorPlanController — Super Admin sees every plan in full (for
// oversight). A member sees only plans assigned to their own team, oldest-first, with occupied
// weeks removed from the picker: occupancy is per-attendee, not per-team — a week only
// disappears from MY picker if I'm specifically recorded as an attendee on an existing
// submitted/verified/flagged activity for it. If a teammate submitted without checking me as
// an attendee, the week stays available in my own picker so I can still submit my own; if they
// checked both of us (a shared activity), it disappears from both.
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

  const myAttendedActivityIds = await AttendanceEntry.find({ member: req.user._id }).distinct("activityRecord");
  const occupied = await ActivityRecord.find({
    _id: { $in: myAttendedActivityIds },
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
  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.some((w) => !w.weekNumber || !w.date || !w.dayOfWeek)) {
    return res.status(400).json({ error: "At least one week with a week number, date, and day of week required" });
  }
  if (weeks.some((w) => !Number.isInteger(Number(w.weekNumber)) || Number(w.weekNumber) < 1 || Number(w.weekNumber) > 18)) {
    return res.status(400).json({ error: "Week number must be between 1 and 18" });
  }
  if (!Array.isArray(teams) || teams.length === 0) {
    return res.status(400).json({ error: "At least one team must be assigned" });
  }

  const foundTeams = await Team.find({ _id: { $in: teams } });
  if (foundTeams.length !== teams.length) return res.status(400).json({ error: "One or more teams not found" });

  // weekNumber is now chosen explicitly by the admin (a dropdown of 1-18), not derived from
  // array order — a plan doesn't have to start at week 1 or number its rows sequentially.
  const normalizedWeeks = weeks.map((w) => ({ weekNumber: Number(w.weekNumber), date: w.date, dayOfWeek: w.dayOfWeek }));

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
