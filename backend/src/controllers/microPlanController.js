import MicroPlan from "../models/MicroPlan.js";
import Team from "../models/Team.js";
import ActivityRecord from "../models/ActivityRecord.js";
import { logAction } from "../middleware/audit.js";

// Super Admin sees every plan in full (for oversight — every week, regardless of status).
// A member sees only plans assigned to their own team, with already-verified weeks removed
// from the picker: once Super Admin confirms a visit happened, it shouldn't be submittable
// again. A flagged/rejected submission leaves the week available to redo.
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

  const verified = await ActivityRecord.find({
    team: req.user.team,
    status: "verified",
    microPlan: { $in: plans.map((p) => p._id) },
  }).select("microPlanWeek");
  const verifiedWeekIds = new Set(verified.map((a) => String(a.microPlanWeek)));

  for (const plan of plans) {
    plan.weeks = plan.weeks.filter((w) => !verifiedWeekIds.has(String(w._id)));
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
