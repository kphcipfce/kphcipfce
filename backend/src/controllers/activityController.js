import crypto from "node:crypto";
import { Readable } from "node:stream";
import exifr from "exifr";
import ActivityRecord from "../models/ActivityRecord.js";
import Facility from "../models/Facility.js";
import Team from "../models/Team.js";
import AttendanceEntry from "../models/AttendanceEntry.js";
import ImageMetadata from "../models/ImageMetadata.js";
import { logAction } from "../middleware/audit.js";
import cloudinary from "../config/cloudinary.js";
import { dateForSlot, isValidSlot, BCC_TYPE } from "../config/projectCalendar.js";

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
    week,
    dayOfWeek,
  } = req.body;
  const teamId = req.user.team;
  const weekNumber = Number(week);

  if (!teamId) return res.status(400).json({ error: "You must belong to a team to submit an activity" });
  if (
    !activityType ||
    !facility ||
    !plannedActivity ||
    !responsiblePerson ||
    !targetGroup ||
    !expectedOutput ||
    !week ||
    !dayOfWeek
  ) {
    return res.status(400).json({ error: "activityType, facility, week, day, and all report fields are required" });
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

  // The fixed calendar decides which days are even offered for a given activity type (5 for
  // the first two, 4 for WASH-in-schools) — checked here too, never trusting the client.
  if (!isValidSlot(activityType, weekNumber, dayOfWeek)) {
    return res.status(400).json({ error: "Invalid week/day for this activity type" });
  }

  const attendees = Array.isArray(attendeeIds) ? attendeeIds : attendeeIds ? [attendeeIds] : [req.user._id];

  // Each activity type is its own independent track — a WASH session and a Community
  // engagement session can both happen on the same day, they don't block each other. What's
  // occupied is per attendee, not per team: a teammate who wasn't present for a given
  // slot can still submit their own separate one for it, but nobody can log the same slot
  // twice for themselves. BCC is a single one-time session per its 3-weekly slot (whichever
  // day it lands on), not a daily-repeatable one — so the whole week is checked for it,
  // rather than just the exact day, or the same session could be logged on two different days.
  const sameSlotQuery = {
    team: teamId,
    week: weekNumber,
    activityType,
    status: { $in: ["submitted", "verified", "flagged"] },
  };
  if (activityType !== BCC_TYPE) sameSlotQuery.dayOfWeek = dayOfWeek;
  const sameSlotActivityIds = await ActivityRecord.find(sameSlotQuery).distinct("_id");
  if (sameSlotActivityIds.length) {
    const alreadyAttended = await AttendanceEntry.exists({
      activityRecord: { $in: sameSlotActivityIds },
      member: { $in: attendees },
    });
    if (alreadyAttended) {
      const scope = activityType === BCC_TYPE ? "this week's session" : "this day";
      return res.status(409).json({ error: `One of the selected attendees already has ${scope} submitted for this activity type` });
    }
  }

  const submittedAt = new Date();
  const dateTime = dateForSlot(weekNumber, dayOfWeek, time);

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
    week: weekNumber,
    dayOfWeek,
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
    .sort("-dateTime")
    .lean();

  // One flag per activity so the list view can color a verified row by attendance
  // without a per-row detail fetch: true = everyone present, false = someone marked absent.
  // attendeeIds rides along too — the Submit Activity picker uses it to work out which
  // weeks/days are already used up for the logged-in member specifically, not the whole team.
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
