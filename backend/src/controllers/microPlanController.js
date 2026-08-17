import MicroPlan from "../models/MicroPlan.js";
import Team from "../models/Team.js";
import ActivityRecord from "../models/ActivityRecord.js";
import { logAction } from "../middleware/audit.js";

// Super Admin sees every plan in full (for oversight — every week, regardless of status).
// A member sees only plans assigned to their own team, with occupied weeks removed from the
// picker: a "submitted" week is already awaiting review, and a "verified" one is confirmed
// done — either way it shouldn't be submittable again, and a teammate shouldn't be able to
// submit a duplicate for the same week while the first is still pending. A flagged/rejected
// submission is the one case that leaves the week available again, for a redo.
export async function listMicroPlans(req, res) {
  if (req.user.role === "super_admin") {
    const plans = await MicroPlan.find({}).populate("teams", "name").populate("createdBy", "name").sort("-createdAt");
    return res.json(plans);
  }

  const plans = await MicroPlan.find({ teams: req.user.team })
    .populate("teams", "name")
    .populate("createdBy", "name")
    .sort("-createdAt")
    .lean();

  const occupied = await ActivityRecord.find({
    team: req.user.team,
    status: { $in: ["submitted", "verified"] },
    microPlan: { $in: plans.map((p) => p._id) },
  }).select("microPlanWeek");
  const occupiedWeekIds = new Set(occupied.map((a) => String(a.microPlanWeek)));

  for (const plan of plans) {
    plan.weeks = plan.weeks.filter((w) => !occupiedWeekIds.has(String(w._id)));
  }
  res.json(plans);
}

export async function getMicroPlan(req, res) {
  const plan = await MicroPlan.findById(req.params.id).populate("teams", "name").populate("createdBy", "name");
  if (!plan) return res.status(404).json({ error: "Not found" });
  if (req.user.role !== "super_admin" && !plan.teams.some((t) => String(t._id) === String(req.user.team))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(plan);
}

export async function createMicroPlan(req, res) {
  const { month, year, weeks, teams } = req.body;
  if (!month || month < 1 || month > 12 || !year) {
    return res.status(400).json({ error: "Valid month (1-12) and year required" });
  }
  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.some((w) => !w.date)) {
    return res.status(400).json({ error: "At least one week with a date required" });
  }
  if (!Array.isArray(teams) || teams.length === 0) {
    return res.status(400).json({ error: "At least one team must be assigned" });
  }

  const foundTeams = await Team.find({ _id: { $in: teams } });
  if (foundTeams.length !== teams.length) return res.status(400).json({ error: "One or more teams not found" });

  // weekNumber is assigned server-side from array order, never trusted from the client.
  const normalizedWeeks = weeks.map((w, i) => ({ weekNumber: i + 1, date: w.date }));

  const plan = await MicroPlan.create({ month, year, weeks: normalizedWeeks, teams, createdBy: req.user._id });
  await logAction(req.user._id, "create", "MicroPlan", plan._id, { month, year, teams });
  res.status(201).json(plan);
}

// Same rule as district deletion: blocked while real activity records reference it, so a
// deletion can never orphan submitted evidence — once deleted, listMicroPlans naturally
// stops returning it, so it drops out of every team's planned-week picker automatically.
export async function deleteMicroPlan(req, res) {
  const plan = await MicroPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found" });

  const inUse = await ActivityRecord.exists({ microPlan: plan._id });
  if (inUse) return res.status(400).json({ error: "Cannot delete a micro plan that has activity records referencing it" });

  await plan.deleteOne();
  await logAction(req.user._id, "delete", "MicroPlan", plan._id, { month: plan.month, year: plan.year });
  res.status(204).end();
}
