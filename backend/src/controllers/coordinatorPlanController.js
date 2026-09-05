import CoordinatorPlan from "../models/CoordinatorPlan.js";
import Member from "../models/Member.js";
import CoordinatorActivityRecord from "../models/CoordinatorActivityRecord.js";
import { logAction } from "../middleware/audit.js";
import { isWeekExpired } from "../utils/weekExpiry.js";

// Super Admin sees every plan in full (for oversight — every week, regardless of status).
// A district_viewer sees only plans assigned to their own coordinator account (a plan can be
// shared across several coordinators, e.g. everyone in the same district), oldest-first, with
// occupied weeks removed from the picker: any week that already has a record — submitted,
// verified, or flagged — has been used up for everyone the plan is shared with (coordinators
// submit solo, there's no per-attendee concept the way Social Mobilizers have). Different
// weeks (even sharing the same date, since the admin can assign more than one) are unaffected.
export async function listCoordinatorPlans(req, res) {
  if (req.user.role === "super_admin") {
    const plans = await CoordinatorPlan.find({}).populate("coordinators", "name email district").populate("createdBy", "name").sort("-createdAt");
    return res.json(plans);
  }

  const plans = await CoordinatorPlan.find({ coordinators: req.user._id })
    .populate("coordinators", "name email district")
    .populate("createdBy", "name")
    .sort("createdAt")
    .lean();

  const occupied = await CoordinatorActivityRecord.find({
    status: { $in: ["submitted", "verified", "flagged"] },
    plan: { $in: plans.map((p) => p._id) },
  }).select("planWeek");
  const occupiedWeekIds = new Set(occupied.map((a) => String(a.planWeek)));

  for (const plan of plans) {
    plan.weeks = plan.weeks.filter((w) => !occupiedWeekIds.has(String(w._id)) && !isWeekExpired(w.date));
  }
  res.json(plans);
}

export async function createCoordinatorPlan(req, res) {
  const { month, year, weeks, coordinators } = req.body;
  if (!month || month < 1 || month > 12 || !year) {
    return res.status(400).json({ error: "Valid month (1-12) and year required" });
  }
  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.some((w) => !w.weekNumber || !w.date || !w.dayOfWeek)) {
    return res.status(400).json({ error: "At least one week with a week number, date, and day of week required" });
  }
  if (weeks.some((w) => !Number.isInteger(Number(w.weekNumber)) || Number(w.weekNumber) < 1 || Number(w.weekNumber) > 18)) {
    return res.status(400).json({ error: "Week number must be between 1 and 18" });
  }
  if (!Array.isArray(coordinators) || coordinators.length === 0) {
    return res.status(400).json({ error: "At least one coordinator must be assigned" });
  }

  const foundCoordinators = await Member.find({ _id: { $in: coordinators }, role: "district_viewer" });
  if (foundCoordinators.length !== coordinators.length) {
    return res.status(400).json({ error: "One or more coordinators not found" });
  }

  // weekNumber is chosen explicitly by the admin (a dropdown of 1-18), not derived from array
  // order — a plan doesn't have to start at week 1 or number its rows sequentially.
  const normalizedWeeks = weeks.map((w) => ({ weekNumber: Number(w.weekNumber), date: w.date, dayOfWeek: w.dayOfWeek }));

  const plan = await CoordinatorPlan.create({ month, year, weeks: normalizedWeeks, coordinators, createdBy: req.user._id });
  await logAction(req.user._id, "create", "CoordinatorPlan", plan._id, { month, year, coordinators });
  res.status(201).json(plan);
}

// Same rule as district/micro-plan deletion: blocked while real activity records reference
// it, so a deletion can never orphan submitted evidence.
export async function deleteCoordinatorPlan(req, res) {
  const plan = await CoordinatorPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found" });

  const inUse = await CoordinatorActivityRecord.exists({ plan: plan._id });
  if (inUse) return res.status(400).json({ error: "Cannot delete a plan that has activity records referencing it" });

  await plan.deleteOne();
  await logAction(req.user._id, "delete", "CoordinatorPlan", plan._id, { month: plan.month, year: plan.year });
  res.status(204).end();
}
