import CoordinatorPlan from "../models/CoordinatorPlan.js";
import District from "../models/District.js";
import CoordinatorActivityRecord from "../models/CoordinatorActivityRecord.js";
import { logAction } from "../middleware/audit.js";

// Super Admin sees every plan in full (for oversight — every week, regardless of status).
// A district_viewer sees only plans assigned to their own district, oldest-first (the first
// week added is the first one offered), with occupied weeks removed from the picker: any week
// that already has a record — submitted, verified, or flagged — has been used up, so it's
// never submittable again from here. Different weeks (even sharing the same date, since the
// admin can assign more than one) are unaffected — occupancy is scoped to the exact week.
export async function listCoordinatorPlans(req, res) {
  if (req.user.role === "super_admin") {
    const plans = await CoordinatorPlan.find({}).populate("districts", "name").populate("createdBy", "name").sort("-createdAt");
    return res.json(plans);
  }

  const plans = await CoordinatorPlan.find({ districts: req.user.district })
    .populate("districts", "name")
    .populate("createdBy", "name")
    .sort("createdAt")
    .lean();

  const occupied = await CoordinatorActivityRecord.find({
    district: req.user.district,
    status: { $in: ["submitted", "verified", "flagged"] },
    plan: { $in: plans.map((p) => p._id) },
  }).select("planWeek");
  const occupiedWeekIds = new Set(occupied.map((a) => String(a.planWeek)));

  for (const plan of plans) {
    plan.weeks = plan.weeks.filter((w) => !occupiedWeekIds.has(String(w._id)));
  }
  res.json(plans);
}

export async function createCoordinatorPlan(req, res) {
  const { month, year, weeks, districts } = req.body;
  if (!month || month < 1 || month > 12 || !year) {
    return res.status(400).json({ error: "Valid month (1-12) and year required" });
  }
  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.some((w) => !w.date || !w.dayOfWeek)) {
    return res.status(400).json({ error: "At least one week with a date and day of week required" });
  }
  if (!Array.isArray(districts) || districts.length === 0) {
    return res.status(400).json({ error: "At least one district must be assigned" });
  }

  const foundDistricts = await District.find({ _id: { $in: districts } });
  if (foundDistricts.length !== districts.length) return res.status(400).json({ error: "One or more districts not found" });

  // weekNumber is assigned server-side from array order, never trusted from the client.
  const normalizedWeeks = weeks.map((w, i) => ({ weekNumber: i + 1, date: w.date, dayOfWeek: w.dayOfWeek }));

  const plan = await CoordinatorPlan.create({ month, year, weeks: normalizedWeeks, districts, createdBy: req.user._id });
  await logAction(req.user._id, "create", "CoordinatorPlan", plan._id, { month, year, districts });
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
