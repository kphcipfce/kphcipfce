import crypto from "node:crypto";
import { Readable } from "node:stream";
import exifr from "exifr";
import ActivityRecord from "../models/ActivityRecord.js";
import Facility from "../models/Facility.js";
import Team from "../models/Team.js";
import SocialMobilizerPlan from "../models/SocialMobilizerPlan.js";
import AttendanceEntry from "../models/AttendanceEntry.js";
import ImageMetadata from "../models/ImageMetadata.js";
import { logAction } from "../middleware/audit.js";
import cloudinary from "../config/cloudinary.js";

function checksumBuffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Same calendar day, ignoring time-of-day — a same-day submission shouldn't get flagged
// just because the member typed 9am and it happened to upload at 9:05am.
function sameCalendarDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Reads the photo's own capture time from its EXIF data — not something the client can fake
// by editing a form field. Screenshots, WhatsApp-forwarded images, and some cameras strip EXIF
// entirely, so a missing value means "unknown," not "suspicious."
async function extractCaptureDate(buffer) {
  try {
    const data = await exifr.parse(buffer, ["DateTimeOriginal", "CreateDate"]);
    const raw = data?.DateTimeOriginal || data?.CreateDate;
    return raw instanceof Date ? raw : null;
  } catch {
    return null;
  }
}

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: "nexa-serve" }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });
}

// FR-2.1/2.2/2.3/2.4/2.5: create activity + attendance + per-photo metadata, duplicate/location flags.
export async function createActivity(req, res) {
  const {
    time,
    activityType,
    description,
    attendeeIds,
    gpsLat,
    gpsLong,
    facility,
    plannedActivity,
    responsiblePerson,
    targetGroup,
    expectedOutput,
    visitStatus,
    plan,
    planWeek,
    maleAttendees,
    femaleAttendees,
  } = req.body;
  const teamId = req.user.team;

  if (!teamId) return res.status(400).json({ error: "You must belong to a team to submit an activity" });
  if (
    !activityType ||
    !facility ||
    !plannedActivity ||
    !responsiblePerson ||
    !targetGroup ||
    !expectedOutput ||
    !plan ||
    !planWeek
  ) {
    return res.status(400).json({ error: "activityType, facility, plan/week, and all report fields are required" });
  }
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: "At least one photo required" });

  // A team works a single district — every activity it submits inherits that, rather than
  // the field worker picking one per visit.
  const team = await Team.findById(teamId);
  if (!team) return res.status(400).json({ error: "Team not found" });
  const district = team.district;

  // Defense in depth: verify the facility is real and actually in this member's own
  // district, rather than trusting whatever ID the client happens to send.
  const facilityDoc = await Facility.findById(facility);
  if (!facilityDoc) return res.status(400).json({ error: "Facility not found" });
  if (String(facilityDoc.district) !== String(district)) {
    return res.status(403).json({ error: "This facility is not in your team's district" });
  }

  // Defense in depth: verify the referenced plan/week is real and actually assigned to this
  // member's team, rather than trusting whatever IDs the client happens to send.
  const planDoc = await SocialMobilizerPlan.findById(plan);
  if (!planDoc) return res.status(400).json({ error: "Plan not found" });
  if (!planDoc.teams.some((t) => String(t) === String(teamId))) {
    return res.status(403).json({ error: "This plan is not assigned to your team" });
  }
  const weekEntry = planDoc.weeks.id(planWeek);
  if (!weekEntry) return res.status(400).json({ error: "Invalid week for this plan" });

  const attendees = Array.isArray(attendeeIds) ? attendeeIds : attendeeIds ? [attendeeIds] : [req.user._id];

  // Mirrors the dropdown filtering in listSocialMobilizerPlans: occupancy is per-attendee, not
  // per-team — a teammate who wasn't checked as an attendee on an existing submission for this
  // week can still submit their own separate one for it, but nobody can double-log the same
  // week for themselves.
  const sameWeekActivityIds = await ActivityRecord.find({
    team: teamId,
    planWeek,
    status: { $in: ["submitted", "verified", "flagged"] },
  }).distinct("_id");
  if (sameWeekActivityIds.length) {
    const alreadyAttended = await AttendanceEntry.exists({
      activityRecord: { $in: sameWeekActivityIds },
      member: { $in: attendees },
    });
    if (alreadyAttended) {
      return res.status(409).json({ error: "One of the selected attendees already has this week's activity submitted" });
    }
  }

  const submittedAt = new Date();
  const dateTime = new Date(weekEntry.date);
  if (time) {
    const [hours, minutes] = time.split(":").map(Number);
    dateTime.setHours(hours || 0, minutes || 0, 0, 0);
  }

  const activity = await ActivityRecord.create({
    team: teamId,
    district,
    submittedBy: req.user._id,
    dateTime,
    activityType,
    facility,
    plannedActivity,
    responsiblePerson,
    targetGroup,
    expectedOutput,
    visitStatus,
    plan,
    planWeek,
    maleAttendees: Number(maleAttendees) || 0,
    femaleAttendees: Number(femaleAttendees) || 0,
    description,
  });

  await AttendanceEntry.insertMany(attendees.map((member) => ({ activityRecord: activity._id, member, present: true })));

  let anyDuplicate = false;
  let anyLocationUnverified = false;
  let anyCaptureDateMismatch = false;
  for (const file of req.files) {
    const checksum = checksumBuffer(file.buffer);
    const existing = await ImageMetadata.findOne({ checksum });
    const isDuplicate = !!existing;
    const locationVerified = gpsLat != null && gpsLong != null;
    if (isDuplicate) anyDuplicate = true;
    if (!locationVerified) anyLocationUnverified = true;

    const captureDate = await extractCaptureDate(file.buffer);
    const captureDateMismatch = captureDate ? !sameCalendarDate(captureDate, submittedAt) : false;
    if (captureDateMismatch) anyCaptureDateMismatch = true;

    const uploaded = await uploadToCloudinary(file.buffer);

    await ImageMetadata.create({
      activityRecord: activity._id,
      fileUrl: uploaded.secure_url,
      exifTimestamp: captureDate,
      gpsLat: gpsLat != null ? Number(gpsLat) : null,
      gpsLong: gpsLong != null ? Number(gpsLong) : null,
      checksum,
      fileSize: file.size,
      fileType: file.mimetype,
      locationVerified,
      isDuplicate,
    });
  }

  const flagReasons = [];
  if (anyDuplicate) flagReasons.push("duplicate image detected");
  if (anyCaptureDateMismatch) flagReasons.push("photo capture date does not match submission date");

  if (flagReasons.length) {
    activity.status = "flagged";
    activity.statusReason = `${flagReasons.join("; ")} — pending Super Admin review`;
    await activity.save();
  }

  await logAction(req.user._id, "create", "ActivityRecord", activity._id, {
    anyDuplicate,
    anyLocationUnverified,
    anyCaptureDateMismatch,
  });
  res.status(201).json({ activity, flags: { anyDuplicate, anyLocationUnverified, anyCaptureDateMismatch } });
}

export async function listActivities(req, res) {
  const filter = {};
  if (req.query.district) filter.district = req.query.district;
  if (req.query.team) filter.team = req.query.team;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.activityType) filter.activityType = req.query.activityType;
  if (req.query.from || req.query.to) {
    filter.dateTime = {};
    if (req.query.from) filter.dateTime.$gte = new Date(req.query.from);
    if (req.query.to) filter.dateTime.$lte = new Date(req.query.to);
  }
  // Plain members only see their own team's records; a district_viewer only their own
  // district's; super_admin sees everything (Sec. 7).
  if (req.user.role === "member") filter.team = req.user.team;
  if (req.user.role === "district_viewer") filter.district = req.user.district;

  const activities = await ActivityRecord.find(filter)
    .populate("team", "name")
    .populate("district", "name")
    .populate("submittedBy", "name")
    .populate("facility", "name category")
    // Most recently submitted first — dateTime is the plan week's own scheduled date (which,
    // since a week can be assigned any number/date, isn't always in submission order), so
    // sorting by that instead of createdAt could put an older submission above a newer one.
    .sort("-createdAt")
    .lean();

  // One flag per activity so the list view can color a verified row by attendance
  // without a per-row detail fetch: true = everyone present, false = someone marked absent.
  const summary = await AttendanceEntry.aggregate([
    { $match: { activityRecord: { $in: activities.map((a) => a._id) } } },
    { $group: { _id: "$activityRecord", anyAbsent: { $sum: { $cond: ["$present", 0, 1] } }, attendeeIds: { $push: "$member" } } },
  ]);
  const summaryMap = new Map(summary.map((s) => [String(s._id), s]));
  for (const activity of activities) {
    const s = summaryMap.get(String(activity._id));
    activity.allPresent = s ? s.anyAbsent === 0 : null;
    activity.attendeeIds = s ? s.attendeeIds : [];
  }

  res.json(activities);
}

export async function getActivity(req, res) {
  const activity = await ActivityRecord.findById(req.params.id)
    .populate("team", "name")
    .populate("district", "name")
    .populate("submittedBy", "name")
    .populate("facility", "name category");
  if (!activity) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "district_viewer" && String(activity.district?._id) !== String(req.user.district)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const [attendance, images] = await Promise.all([
    AttendanceEntry.find({ activityRecord: activity._id }).populate("member", "name"),
    ImageMetadata.find({ activityRecord: activity._id }),
  ]);
  res.json({ activity, attendance, images });
}

// FR-2.6/FR-5.4: Super Admin verifies or flags a record.
export async function setActivityStatus(req, res) {
  const { status, statusReason } = req.body;
  if (!["submitted", "verified", "flagged"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const activity = await ActivityRecord.findById(req.params.id);
  if (!activity) return res.status(404).json({ error: "Not found" });

  activity.editHistory.push({ editedBy: req.user._id, changes: { status: { from: activity.status, to: status } } });
  activity.status = status;
  activity.statusReason = statusReason || "";
  await activity.save();
  await logAction(req.user._id, "status_change", "ActivityRecord", activity._id, { status, statusReason });
  res.json(activity);
}

// Corrects attendance after reviewing the evidence, in either direction. This is itself a
// completed review decision, so it also moves the record to "verified" — that's the only
// status the dashboard's attendance rate counts, so the correction needs to land there to
// actually be reflected in the number (in either direction — absent or present).
export async function setAttendancePresence(req, res) {
  const { present } = req.body;
  if (typeof present !== "boolean") return res.status(400).json({ error: "present (boolean) required" });

  const activity = await ActivityRecord.findById(req.params.id);
  if (!activity) return res.status(404).json({ error: "Not found" });

  await AttendanceEntry.updateMany({ activityRecord: activity._id }, { present });

  activity.editHistory.push({
    editedBy: req.user._id,
    changes: { status: { from: activity.status, to: "verified" }, attendance: present ? "marked present" : "marked absent" },
  });
  activity.status = "verified";
  await activity.save();
  await logAction(req.user._id, present ? "mark_present" : "mark_absent", "ActivityRecord", activity._id, {});

  const attendance = await AttendanceEntry.find({ activityRecord: activity._id }).populate("member", "name");
  res.json({ activity, attendance });
}
