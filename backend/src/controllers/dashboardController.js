import mongoose from "mongoose";
import ExcelJS from "exceljs";
import ActivityRecord from "../models/ActivityRecord.js";
import AttendanceEntry from "../models/AttendanceEntry.js";
import Team from "../models/Team.js";
import Member from "../models/Member.js";
import CoordinatorActivityRecord from "../models/CoordinatorActivityRecord.js";
import GrmActivityRecord from "../models/GrmActivityRecord.js";

function buildMatch(req) {
  const match = {};
  // A district_viewer or grm_focal only ever sees their own district — this overrides any
  // district query param they might pass, same rule as a member being locked to their team.
  if (req.user.role === "district_viewer" || req.user.role === "grm_focal") {
    match.district = req.user.district;
  } else if (req.query.district) {
    match.district = new mongoose.Types.ObjectId(req.query.district);
  }
  if (req.query.team) match.team = new mongoose.Types.ObjectId(req.query.team);
  if (req.query.activityType) match.activityType = req.query.activityType;
  if (req.query.status) match.status = req.query.status;
  if (req.query.from || req.query.to) {
    match.dateTime = {};
    if (req.query.from) match.dateTime.$gte = new Date(req.query.from);
    if (req.query.to) match.dateTime.$lte = new Date(req.query.to);
  }
  return match;
}

// FR-3.1/3.2/3.3/3.5: actual activity + attendance per team/district, flagged counts.
// Note: SRS data model (Sec. 5) has no Schedule/target entity, so "expected" activities
// are not modeled — this reports actuals only. Add a Schedule collection if target-setting is needed.
export async function monitoring(req, res) {
  const match = buildMatch(req);

  const byTeam = await ActivityRecord.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$team",
        activityCount: { $sum: 1 },
        verified: { $sum: { $cond: [{ $eq: ["$status", "verified"] }, 1, 0] } },
        flagged: { $sum: { $cond: [{ $eq: ["$status", "flagged"] }, 1, 0] } },
      },
    },
    { $lookup: { from: "teams", localField: "_id", foreignField: "_id", as: "team" } },
    { $unwind: "$team" },
    { $project: { team: "$team.name", teamId: "$_id", activityCount: 1, verified: 1, flagged: 1 } },
  ]);

  const byDistrict = await ActivityRecord.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$district",
        activityCount: { $sum: 1 },
        verified: { $sum: { $cond: [{ $eq: ["$status", "verified"] }, 1, 0] } },
        flagged: { $sum: { $cond: [{ $eq: ["$status", "flagged"] }, 1, 0] } },
      },
    },
    { $lookup: { from: "districts", localField: "_id", foreignField: "_id", as: "district" } },
    { $unwind: "$district" },
    { $project: { district: "$district.name", districtId: "$_id", activityCount: 1, verified: 1, flagged: 1 } },
  ]);

  // Scoped by district only (team/activityType/status query filters are social-mobilizer-
  // specific and wouldn't apply consistently across the other two collections' schemas).
  const districtOnlyMatch = match.district ? { district: match.district } : {};

  // Male/female headcount is entered on the form as the activity's actual audience — not the
  // submitting member's own gender, and not the per-teammate present/absent AttendanceEntry
  // data (a separate concept: whether the submitter's own teammates showed up). Combined across
  // all three panels via $unionWith: a district_viewer/grm_focal's own district-scoped total
  // includes whatever a social mobilizer, coordinator, or GRM focal person submitted there, and
  // Super Admin (no district match) gets the global total across every district.
  const byActivityTypeGender = await ActivityRecord.aggregate([
    { $match: districtOnlyMatch },
    { $project: { activityType: 1, maleAttendees: 1, femaleAttendees: 1 } },
    {
      $unionWith: {
        coll: "coordinatoractivityrecords",
        pipeline: [{ $match: districtOnlyMatch }, { $project: { activityType: 1, maleAttendees: 1, femaleAttendees: 1 } }],
      },
    },
    {
      $unionWith: {
        coll: "grmactivityrecords",
        pipeline: [{ $match: districtOnlyMatch }, { $project: { activityType: 1, maleAttendees: 1, femaleAttendees: 1 } }],
      },
    },
    {
      $group: {
        _id: "$activityType",
        Male: { $sum: { $ifNull: ["$maleAttendees", 0] } },
        Female: { $sum: { $ifNull: ["$femaleAttendees", 0] } },
      },
    },
    { $project: { activityType: "$_id", Male: 1, Female: 1, _id: 0 } },
  ]);

  // "Attendance rate" is really a verified-vs-total rate spanning all three activity-record
  // collections (social mobilizer, coordinator, GRM focal) — "verified" is the one status value
  // common to all of them, unlike present/absent attendee data, which only social mobilizer
  // group visits track at all.
  const [smCounts, coordCounts, grmCounts] = await Promise.all([
    ActivityRecord.aggregate([
      { $match: districtOnlyMatch },
      { $group: { _id: null, total: { $sum: 1 }, verified: { $sum: { $cond: [{ $eq: ["$status", "verified"] }, 1, 0] } } } },
    ]),
    CoordinatorActivityRecord.aggregate([
      { $match: districtOnlyMatch },
      { $group: { _id: null, total: { $sum: 1 }, verified: { $sum: { $cond: [{ $eq: ["$status", "verified"] }, 1, 0] } } } },
    ]),
    GrmActivityRecord.aggregate([
      { $match: districtOnlyMatch },
      { $group: { _id: null, total: { $sum: 1 }, verified: { $sum: { $cond: [{ $eq: ["$status", "verified"] }, 1, 0] } } } },
    ]),
  ]);
  const totalRecords = (smCounts[0]?.total || 0) + (coordCounts[0]?.total || 0) + (grmCounts[0]?.total || 0);
  const totalVerified = (smCounts[0]?.verified || 0) + (coordCounts[0]?.verified || 0) + (grmCounts[0]?.verified || 0);
  const attendanceRate = totalRecords > 0 ? totalVerified / totalRecords : null;

  res.json({ byTeam, byDistrict, byActivityTypeGender, attendanceRate });
}

// FR-4.1/4.2/4.3: per-team and per-member performance stats.
export async function adminStats(req, res) {
  const match = buildMatch(req);

  const teams = await Team.find({}).populate("memberIds", "name");
  const teamStats = await ActivityRecord.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$team",
        activityCount: { $sum: 1 },
        flagged: { $sum: { $cond: [{ $eq: ["$status", "flagged"] }, 1, 0] } },
      },
    },
  ]);
  const teamStatsMap = Object.fromEntries(teamStats.map((t) => [String(t._id), t]));
  const perTeam = teams.map((t) => ({
    teamId: t._id,
    name: t.name,
    activityCount: teamStatsMap[String(t._id)]?.activityCount || 0,
    flagged: teamStatsMap[String(t._id)]?.flagged || 0,
  }));

  const members = await Member.find({}).select("name team");
  const activityIds = await ActivityRecord.find(match).distinct("_id");
  const memberAttendance = await AttendanceEntry.aggregate([
    { $match: { activityRecord: { $in: activityIds } } },
    { $group: { _id: "$member", participationCount: { $sum: 1 }, present: { $sum: { $cond: ["$present", 1, 0] } } } },
  ]);
  const memberMap = Object.fromEntries(memberAttendance.map((m) => [String(m._id), m]));
  const perMember = members.map((m) => ({
    memberId: m._id,
    name: m.name,
    participationCount: memberMap[String(m._id)]?.participationCount || 0,
    attendanceRate: memberMap[String(m._id)] ? memberMap[String(m._id)].present / memberMap[String(m._id)].participationCount : null,
  }));

  // Simple weekly trend (FR-4.3), no charting lib server-side — frontend renders it.
  const trend = await ActivityRecord.aggregate([
    { $match: match },
    { $group: { _id: { $dateTrunc: { date: "$dateTime", unit: "week" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  res.json({ perTeam, perMember, trend });
}

// FR-5.2: org-wide KPI summary for Super Admin.
export async function superAdminOverview(req, res) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [thisWeek, thisMonth, flaggedCount, districtBreakdown] = await Promise.all([
    ActivityRecord.countDocuments({ dateTime: { $gte: weekAgo } }),
    ActivityRecord.countDocuments({ dateTime: { $gte: monthAgo } }),
    ActivityRecord.countDocuments({ status: "flagged" }),
    ActivityRecord.aggregate([
      { $group: { _id: "$district", count: { $sum: 1 }, flagged: { $sum: { $cond: [{ $eq: ["$status", "flagged"] }, 1, 0] } } } },
      { $lookup: { from: "districts", localField: "_id", foreignField: "_id", as: "district" } },
      { $unwind: "$district" },
      { $project: { district: "$district.name", count: 1, flagged: 1 } },
    ]),
  ]);

  // Same rule as monitoring(): only verified activities' attendance counts.
  const verifiedIds = await ActivityRecord.find({ status: "verified" }).distinct("_id");
  const attendanceAgg = await AttendanceEntry.aggregate([
    { $match: { activityRecord: { $in: verifiedIds } } },
    { $group: { _id: null, total: { $sum: 1 }, present: { $sum: { $cond: ["$present", 1, 0] } } } },
  ]);

  res.json({
    activitiesThisWeek: thisWeek,
    activitiesThisMonth: thisMonth,
    flaggedNeedingReview: flaggedCount,
    overallAttendanceRate: attendanceAgg[0] ? attendanceAgg[0].present / attendanceAgg[0].total : null,
    districtBreakdown,
  });
}

// Executive Dashboard: a leadership-only, read-only combined view across all three activity
// panels (Social Mobilizer, District Coordinator, GRM Focal Person) — every other endpoint in
// this file deliberately keeps those panels isolated (Field Tracker export, the regular
// Monitoring Dashboard's district/team charts), but the Executive Dashboard's whole point is
// "overall working across the org," so this is the one place they're merged.
// ponytail: JS-side merge across three small collections rather than a cross-collection
// aggregation pipeline — fine at this data volume; revisit with $unionWith if it ever grows
// into the tens of thousands of records.
export async function executiveOverview(req, res) {
  const { district, team, activityType, status, from, to } = req.query;
  const commonMatch = {};
  if (district) commonMatch.district = new mongoose.Types.ObjectId(district);
  if (status) commonMatch.status = status;
  if (from || to) {
    commonMatch.dateTime = {};
    if (from) commonMatch.dateTime.$gte = new Date(from);
    if (to) commonMatch.dateTime.$lte = new Date(to);
  }
  // Team only exists on Social Mobilizer records; activityType enums differ per panel, so a
  // type picked for one panel simply matches zero records in the others, same as any other
  // non-matching filter would — no special-casing needed.
  const mobilizerMatch = { ...commonMatch };
  if (team) mobilizerMatch.team = new mongoose.Types.ObjectId(team);
  if (activityType) mobilizerMatch.activityType = activityType;
  const otherMatch = { ...commonMatch };
  if (activityType) otherMatch.activityType = activityType;

  const [smActivities, coordActivities, grmActivities] = await Promise.all([
    ActivityRecord.find(mobilizerMatch)
      .populate("district", "name")
      .populate("team", "name")
      .populate("facility", "name category")
      .populate("submittedBy", "name")
      .populate("plan", "weeks")
      .sort("-dateTime")
      .lean(),
    CoordinatorActivityRecord.find(otherMatch)
      .populate("district", "name")
      .populate("facility", "name category")
      .populate("submittedBy", "name")
      .populate("plan", "weeks")
      .sort("-dateTime")
      .lean(),
    GrmActivityRecord.find(otherMatch)
      .populate("district", "name")
      .populate("facility", "name category")
      .populate("submittedBy", "name")
      .populate("plan", "weeks")
      .sort("-dateTime")
      .lean(),
  ]);

  // Each panel stores its week/day differently (a plan reference, never a flat field) —
  // resolved here so the frontend reads one uniform shape regardless of which panel a row
  // came from.
  function normalize(list, panel) {
    return list.map((a) => {
      const weekEntry = a.plan?.weeks?.find((w) => String(w._id) === String(a.planWeek));
      return {
        _id: a._id,
        panel,
        dateTime: a.dateTime,
        activityType: a.activityType,
        district: a.district || null,
        team: a.team || null,
        facility: a.facility || null,
        submittedBy: a.submittedBy || null,
        status: a.status,
        statusReason: a.statusReason,
        visitStatus: a.visitStatus,
        plannedActivity: a.plannedActivity,
        responsiblePerson: a.responsiblePerson,
        targetGroup: a.targetGroup,
        expectedOutput: a.expectedOutput,
        description: a.description,
        maleAttendees: a.maleAttendees || 0,
        femaleAttendees: a.femaleAttendees || 0,
        week: weekEntry?.weekNumber ?? null,
        dayOfWeek: weekEntry?.dayOfWeek ?? null,
      };
    });
  }

  const activities = [...normalize(smActivities, "mobilizer"), ...normalize(coordActivities, "coordinator"), ...normalize(grmActivities, "grm")].sort(
    (a, b) => new Date(b.dateTime) - new Date(a.dateTime)
  );

  const byDistrictMap = new Map();
  for (const a of activities) {
    const key = a.district ? String(a.district._id) : "unknown";
    const row = byDistrictMap.get(key) || {
      districtId: a.district?._id,
      district: a.district?.name || "Unknown",
      activityCount: 0,
      verified: 0,
      flagged: 0,
    };
    row.activityCount += 1;
    if (a.status === "verified") row.verified += 1;
    if (a.status === "flagged") row.flagged += 1;
    byDistrictMap.set(key, row);
  }

  // Team leaderboard is Social Mobilizer-only — Coordinator/GRM Focal Person work solo per
  // district, there's no team unit to rank for them.
  const byTeamMap = new Map();
  for (const a of activities) {
    if (a.panel !== "mobilizer" || !a.team) continue;
    const key = String(a.team._id);
    const row = byTeamMap.get(key) || { teamId: a.team._id, team: a.team.name, activityCount: 0, flagged: 0 };
    row.activityCount += 1;
    if (a.status === "flagged") row.flagged += 1;
    byTeamMap.set(key, row);
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const activitiesThisWeek = activities.filter((a) => new Date(a.dateTime) >= weekAgo).length;
  const activitiesThisMonth = activities.filter((a) => new Date(a.dateTime) >= monthAgo).length;
  const flaggedNeedingReview = activities.filter((a) => a.status === "flagged").length;

  // Same rule as monitoring()'s combined rate: "verified" is the one status value common to
  // all three panels, unlike present/absent attendee data which only Social Mobilizer tracks.
  const totalRecords = activities.length;
  const totalVerified = activities.filter((a) => a.status === "verified").length;
  const attendanceRate = totalRecords > 0 ? totalVerified / totalRecords : null;

  res.json({
    activities,
    byDistrict: [...byDistrictMap.values()],
    byTeam: [...byTeamMap.values()],
    activitiesThisWeek,
    activitiesThisMonth,
    flaggedNeedingReview,
    attendanceRate,
  });
}

// FR-4.4: exports exactly the Field Tracker template's columns (no extra data), plus one
// derived "Approval" column colored the same way the dashboard colors a record's status cell.
const APPROVAL_STYLE = {
  verified: { fill: "FFC6EFCE", font: "FF006100" },
  absent: { fill: "FFFFC7CE", font: "FF9C0006" },
  flagged: { fill: "FFFFEB9C", font: "FF9C6500" },
};

// Matches the reference Field Tracker's legend: Pending red, In Progress yellow,
// Completed green, Deferred / Rescheduled gray.
const VISIT_STATUS_FILL = {
  Pending: "FFFF0000",
  "In Progress": "FFFFFF00",
  Completed: "FF00B050",
  "Deferred / Rescheduled": "FFD9D9D9",
};

export async function exportFieldTracker(req, res) {
  const match = buildMatch(req);
  const activities = await ActivityRecord.find(match)
    .populate("district", "name")
    .populate("facility", "name")
    .populate("plan", "weeks")
    .sort("-dateTime")
    .lean();

  const summary = await AttendanceEntry.aggregate([
    { $match: { activityRecord: { $in: activities.map((a) => a._id) } } },
    { $group: { _id: "$activityRecord", anyAbsent: { $sum: { $cond: ["$present", 0, 1] } } } },
  ]);
  const allPresentMap = new Map(summary.map((s) => [String(s._id), s.anyAbsent === 0]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Field Tracker");
  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Week", key: "week", width: 8 },
    { header: "Day", key: "day", width: 12 },
    { header: "District", key: "district", width: 14 },
    { header: "Health Facility / Community", key: "healthFacility", width: 28 },
    { header: "Planned Activity", key: "plannedActivity", width: 28 },
    { header: "Responsible Person", key: "responsiblePerson", width: 20 },
    { header: "Target Group", key: "targetGroup", width: 20 },
    { header: "Expected Output", key: "expectedOutput", width: 24 },
    { header: "Status", key: "status", width: 16 },
    { header: "Remarks / Follow-up", key: "remarks", width: 28 },
    { header: "Approval", key: "approval", width: 14 },
  ];
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6D9B8" } };
  });
  sheet.autoFilter = { from: "A1", to: "L1" };

  for (const a of activities) {
    // Same rule as the dashboard's statusClassName: flagged always shown; a verified record
    // is "verified" or "absent" depending on attendance; anything still submitted is blank.
    const allPresent = allPresentMap.has(String(a._id)) ? allPresentMap.get(String(a._id)) : null;
    let approval = "";
    if (a.status === "flagged") approval = "flagged";
    else if (a.status === "verified" && allPresent === true) approval = "verified";
    else if (a.status === "verified" && allPresent === false) approval = "absent";

    const weekEntry = a.plan?.weeks?.find((w) => String(w._id) === String(a.planWeek));

    const row = sheet.addRow({
      date: new Date(a.dateTime).toLocaleDateString("en-US"),
      week: weekEntry?.weekNumber ?? "",
      day: weekEntry?.dayOfWeek ?? "",
      district: a.district?.name || "",
      healthFacility: a.facility?.name || "",
      plannedActivity: a.plannedActivity,
      responsiblePerson: a.responsiblePerson,
      targetGroup: a.targetGroup,
      expectedOutput: a.expectedOutput,
      status: a.visitStatus,
      remarks: a.description || "",
      approval,
    });

    const style = APPROVAL_STYLE[approval];
    if (style) {
      const cell = row.getCell("approval");
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
      cell.font = { bold: true, color: { argb: style.font } };
    }

    const statusFill = VISIT_STATUS_FILL[a.visitStatus];
    if (statusFill) {
      row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill } };
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=field-tracker.xlsx");
  await workbook.xlsx.write(res);
  res.end();
}

// Shared by exportCoordinatorTracker/exportGrmTracker below — same shape as the Field Tracker
// export, minus attendance (a coordinator/focal person submits alone, no per-attendee list so
// there's no "absent" approval state) and with Week/Day resolved from the plan's weeks
// subdocument instead of a flat field like the fixed social-mobilizer calendar has.
function buildTrackerMatch(req) {
  const match = {};
  if (req.query.district) match.district = new mongoose.Types.ObjectId(req.query.district);
  if (req.query.activityType) match.activityType = req.query.activityType;
  if (req.query.status) match.status = req.query.status;
  if (req.query.from || req.query.to) {
    match.dateTime = {};
    if (req.query.from) match.dateTime.$gte = new Date(req.query.from);
    if (req.query.to) match.dateTime.$lte = new Date(req.query.to);
  }
  return match;
}

async function exportActivityTracker(req, res, Model, sheetTitle, filename) {
  const match = buildTrackerMatch(req);
  const activities = await Model.find(match)
    .populate("district", "name")
    .populate("facility", "name")
    .populate("plan", "weeks")
    .sort("-dateTime")
    .lean();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetTitle);
  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Week", key: "week", width: 8 },
    { header: "Day", key: "day", width: 12 },
    { header: "District", key: "district", width: 14 },
    { header: "Health Facility / Community", key: "healthFacility", width: 28 },
    { header: "Activity Type", key: "activityType", width: 26 },
    { header: "Refresher", key: "refresher", width: 12 },
    { header: "Planned Activity", key: "plannedActivity", width: 28 },
    { header: "Responsible Person", key: "responsiblePerson", width: 20 },
    { header: "Target Group", key: "targetGroup", width: 20 },
    { header: "Expected Output", key: "expectedOutput", width: 24 },
    { header: "Status", key: "status", width: 16 },
    { header: "Remarks / Follow-up", key: "remarks", width: 28 },
    { header: "Approval", key: "approval", width: 14 },
  ];
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6D9B8" } };
  });
  sheet.autoFilter = { from: "A1", to: "N1" };

  for (const a of activities) {
    const weekEntry = a.plan?.weeks?.find((w) => String(w._id) === String(a.planWeek));

    let approval = "";
    if (a.status === "flagged") approval = "flagged";
    else if (a.status === "verified") approval = "verified";

    const row = sheet.addRow({
      date: new Date(a.dateTime).toLocaleDateString("en-US"),
      week: weekEntry?.weekNumber ?? "",
      day: weekEntry?.dayOfWeek ?? "",
      district: a.district?.name || "",
      healthFacility: a.facility?.name || "",
      activityType: a.activityType,
      refresher: a.isRefresher ? "Yes" : "No",
      plannedActivity: a.plannedActivity,
      responsiblePerson: a.responsiblePerson,
      targetGroup: a.targetGroup,
      expectedOutput: a.expectedOutput,
      status: a.visitStatus,
      remarks: a.description || "",
      approval,
    });

    const style = APPROVAL_STYLE[approval];
    if (style) {
      const cell = row.getCell("approval");
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
      cell.font = { bold: true, color: { argb: style.font } };
    }

    const statusFill = VISIT_STATUS_FILL[a.visitStatus];
    if (statusFill) {
      row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill } };
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  await workbook.xlsx.write(res);
  res.end();
}

export async function exportCoordinatorTracker(req, res) {
  await exportActivityTracker(req, res, CoordinatorActivityRecord, "DCMO-FMO Tracker", "dcmo-fmo-tracker.xlsx");
}

export async function exportGrmTracker(req, res) {
  await exportActivityTracker(req, res, GrmActivityRecord, "GRM Tracker", "grm-tracker.xlsx");
}
