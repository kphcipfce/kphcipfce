import MonitoringPlan from "../models/MonitoringPlan.js";
import MonitoringVisit from "../models/MonitoringVisit.js";
import Member from "../models/Member.js";
import District from "../models/District.js";
import { logAction } from "../middleware/audit.js";
import { isWeekExpired } from "../utils/weekExpiry.js";

export async function listMonitoringPlans(req, res) {
  if (req.user.role === "super_admin" || req.user.role === "tl_reviewer") {
    const plans = await MonitoringPlan.find({})
      .populate("district", "name")
      .populate("targetMobilizer", "name email gender")
      .populate("targetMobilizer2", "name email gender")
      .populate("coordinator", "name email")
      .populate("createdBy", "name")
      .sort("-createdAt");
    return res.json(plans);
  }

  // For district_viewer (District Coordinator):
  const plans = await MonitoringPlan.find({ coordinator: req.user._id })
    .populate("district", "name")
    .populate("targetMobilizer", "name email gender")
    .populate("targetMobilizer2", "name email gender")
    .populate("coordinator", "name email")
    .populate("createdBy", "name")
    .sort("createdAt")
    .lean();

  const occupied = await MonitoringVisit.find({
    plan: { $in: plans.map((p) => p._id) },
  }).select("planWeek");
  const occupiedWeekIds = new Set(occupied.map((a) => String(a.planWeek)));

  for (const plan of plans) {
    plan.weeks = plan.weeks.filter(
      (w) => !occupiedWeekIds.has(String(w._id)) && !isWeekExpired(w.date)
    );
  }
  res.json(plans);
}

export async function createMonitoringPlan(req, res) {
  const { month, year, weeks, district, targetMobilizer, targetMobilizer2, coordinator } = req.body;

  if (!month || month < 1 || month > 12 || !year) {
    return res.status(400).json({ error: "Valid month (1-12) and year required" });
  }
  if (!district) {
    return res.status(400).json({ error: "District is required" });
  }
  if (!targetMobilizer) {
    return res.status(400).json({ error: "Primary Target Social Mobilizer is required" });
  }
  if (!coordinator) {
    return res.status(400).json({ error: "District Coordinator is required" });
  }
  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.some((w) => !w.weekNumber || !w.date || !w.dayOfWeek)) {
    return res.status(400).json({ error: "At least one week with a week number, date, and day of week required" });
  }

  const districtDoc = await District.findById(district);
  if (!districtDoc) return res.status(400).json({ error: "Invalid district ID" });

  const mobilizerDoc = await Member.findById(targetMobilizer);
  if (!mobilizerDoc) return res.status(400).json({ error: "Invalid target mobilizer ID" });

  if (targetMobilizer2) {
    const mobilizerDoc2 = await Member.findById(targetMobilizer2);
    if (!mobilizerDoc2) return res.status(400).json({ error: "Invalid second target mobilizer ID" });
  }

  const coordDoc = await Member.findById(coordinator);
  if (!coordDoc || coordDoc.role !== "district_viewer") {
    return res.status(400).json({ error: "Invalid District Coordinator ID" });
  }

  const normalizedWeeks = weeks.map((w) => ({
    weekNumber: Number(w.weekNumber),
    date: w.date,
    dayOfWeek: w.dayOfWeek,
  }));

  const plan = await MonitoringPlan.create({
    month: Number(month),
    year: Number(year),
    weeks: normalizedWeeks,
    district,
    targetMobilizer,
    targetMobilizer2: targetMobilizer2 || null,
    coordinator,
    createdBy: req.user._id,
  });

  await logAction(req.user._id, "create", "MonitoringPlan", plan._id, { month, year, district, targetMobilizer, targetMobilizer2, coordinator });

  const populated = await MonitoringPlan.findById(plan._id)
    .populate("district", "name")
    .populate("targetMobilizer", "name email gender")
    .populate("targetMobilizer2", "name email gender")
    .populate("coordinator", "name email")
    .populate("createdBy", "name");

  res.status(201).json(populated);
}

export async function deleteMonitoringPlan(req, res) {
  const plan = await MonitoringPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found" });

  const inUse = await MonitoringVisit.exists({ plan: plan._id });
  if (inUse) return res.status(400).json({ error: "Cannot delete a plan that has monitoring visit records referencing it" });

  await plan.deleteOne();
  await logAction(req.user._id, "delete", "MonitoringPlan", plan._id, { month: plan.month, year: plan.year });
  res.status(204).end();
}
