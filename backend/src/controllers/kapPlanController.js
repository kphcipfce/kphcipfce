import KapPlan from "../models/KapPlan.js";
import KapSurvey from "../models/KapSurvey.js";
import Member from "../models/Member.js";
import District from "../models/District.js";
import Team from "../models/Team.js";
import { logAction } from "../middleware/audit.js";
import { isWeekExpired } from "../utils/weekExpiry.js";

export async function listKapPlans(req, res) {
  if (req.user.role === "super_admin" || req.user.role === "tl_reviewer") {
    const plans = await KapPlan.find({})
      .populate("district", "name")
      .populate("targetMobilizer", "name email gender")
      .populate("coordinator", "name email")
      .populate("createdBy", "name")
      .sort("-createdAt");
    return res.json(plans);
  }

  const query = {};
  if (req.user.role === "member") {
    query.targetRole = "member";
    query.targetMobilizer = req.user._id;
  } else if (req.user.role === "district_viewer") {
    query.targetRole = "district_viewer";
    query.coordinator = req.user._id;
  } else {
    return res.json([]);
  }

  const plans = await KapPlan.find(query)
    .populate("district", "name")
    .populate("targetMobilizer", "name email gender")
    .populate("coordinator", "name email")
    .populate("createdBy", "name")
    .sort("createdAt")
    .lean();

  const occupied = await KapSurvey.find({
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

export async function createKapPlan(req, res) {
  const { month, year, weeks, district, targetRole, targetMobilizer, coordinator } = req.body;

  if (!month || month < 1 || month > 12 || !year) {
    return res.status(400).json({ error: "Valid month (1-12) and year required" });
  }
  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.some((w) => !w.weekNumber || !w.date || !w.dayOfWeek)) {
    return res.status(400).json({ error: "At least one week with a week number, date, and day of week required" });
  }

  const role = targetRole || "member";
  let resolvedDistrict = district;

  if (role === "member") {
    if (!targetMobilizer) {
      return res.status(400).json({ error: "Target Social Mobilizer is required when assigning to a mobilizer" });
    }
    const mobilizerDoc = await Member.findById(targetMobilizer);
    if (!mobilizerDoc) return res.status(400).json({ error: "Invalid target mobilizer ID" });

    // Derive district from team assigned to the mobilizer
    const teamDoc = await Team.findOne({ memberIds: targetMobilizer });
    if (teamDoc && teamDoc.district) {
      resolvedDistrict = teamDoc.district;
    } else if (mobilizerDoc.district) {
      resolvedDistrict = mobilizerDoc.district;
    }
  } else if (role === "district_viewer") {
    if (!coordinator) {
      return res.status(400).json({ error: "District Coordinator is required when assigning to a coordinator" });
    }
    const coordDoc = await Member.findById(coordinator);
    if (!coordDoc || coordDoc.role !== "district_viewer") {
      return res.status(400).json({ error: "Invalid District Coordinator ID" });
    }
    if (coordDoc.district) {
      resolvedDistrict = coordDoc.district;
    }
  }

  if (!resolvedDistrict) {
    return res.status(400).json({ error: "No district is assigned to the selected person/team." });
  }

  const districtDoc = await District.findById(resolvedDistrict);
  if (!districtDoc) return res.status(400).json({ error: "Invalid district ID" });

  const normalizedWeeks = weeks.map((w) => ({
    weekNumber: Number(w.weekNumber),
    date: w.date,
    dayOfWeek: w.dayOfWeek,
  }));

  const plan = await KapPlan.create({
    month: Number(month),
    year: Number(year),
    weeks: normalizedWeeks,
    district: resolvedDistrict,
    targetRole: role,
    targetMobilizer: role === "member" ? targetMobilizer : null,
    coordinator: role === "district_viewer" ? coordinator : null,
    createdBy: req.user._id,
  });

  await logAction(req.user._id, "create", "KapPlan", plan._id, { month, year, district: resolvedDistrict, targetRole: role });

  const populated = await KapPlan.findById(plan._id)
    .populate("district", "name")
    .populate("targetMobilizer", "name email gender")
    .populate("coordinator", "name email")
    .populate("createdBy", "name");

  res.status(201).json(populated);
}

export async function deleteKapPlan(req, res) {
  const plan = await KapPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found" });

  const inUse = await KapSurvey.exists({ plan: plan._id });
  if (inUse) return res.status(400).json({ error: "Cannot delete a plan that has submitted KAP surveys referencing it" });

  await plan.deleteOne();
  await logAction(req.user._id, "delete", "KapPlan", plan._id, { month: plan.month, year: plan.year });
  res.status(204).end();
}
