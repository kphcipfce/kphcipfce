import GrmPlan from "../models/GrmPlan.js";
import District from "../models/District.js";
import GrmActivityRecord from "../models/GrmActivityRecord.js";
import { logAction } from "../middleware/audit.js";

// Same pattern as coordinatorPlanController — Super Admin sees every plan in full; a
// grm_focal account sees only plans assigned to their own district, with occupied weeks
// removed from the picker.
export async function listGrmPlans(req, res) {
  if (req.user.role === "super_admin") {
    const plans = await GrmPlan.find({}).populate("districts", "name").populate("createdBy", "name").sort("-createdAt");
    return res.json(plans);
  }

  const plans = await GrmPlan.find({ districts: req.user.district })
    .populate("districts", "name")
    .populate("createdBy", "name")
    .sort("-createdAt")
    .lean();

  const occupied = await GrmActivityRecord.find({
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

export async function createGrmPlan(req, res) {
  const { month, year, weeks, districts } = req.body;
  if (!month || month < 1 || month > 12 || !year) {
    return res.status(400).json({ error: "Valid month (1-12) and year required" });
  }
  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.some((w) => !w.date)) {
    return res.status(400).json({ error: "At least one week with a date required" });
  }
  if (!Array.isArray(districts) || districts.length === 0) {
    return res.status(400).json({ error: "At least one district must be assigned" });
  }

  const foundDistricts = await District.find({ _id: { $in: districts } });
  if (foundDistricts.length !== districts.length) return res.status(400).json({ error: "One or more districts not found" });

  const normalizedWeeks = weeks.map((w, i) => ({ weekNumber: i + 1, date: w.date }));

  const plan = await GrmPlan.create({ month, year, weeks: normalizedWeeks, districts, createdBy: req.user._id });
  await logAction(req.user._id, "create", "GrmPlan", plan._id, { month, year, districts });
  res.status(201).json(plan);
}

export async function deleteGrmPlan(req, res) {
  const plan = await GrmPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found" });

  const inUse = await GrmActivityRecord.exists({ plan: plan._id });
  if (inUse) return res.status(400).json({ error: "Cannot delete a plan that has activity records referencing it" });

  await plan.deleteOne();
  await logAction(req.user._id, "delete", "GrmPlan", plan._id, { month: plan.month, year: plan.year });
  res.status(204).end();
}
