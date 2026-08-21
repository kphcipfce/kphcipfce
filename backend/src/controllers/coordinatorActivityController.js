import crypto from "node:crypto";
import { Readable } from "node:stream";
import exifr from "exifr";
import CoordinatorActivityRecord from "../models/CoordinatorActivityRecord.js";
import CoordinatorPlan from "../models/CoordinatorPlan.js";
import Facility from "../models/Facility.js";
import ImageMetadata from "../models/ImageMetadata.js";
import { logAction } from "../middleware/audit.js";
import cloudinary from "../config/cloudinary.js";

function checksumBuffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Same calendar day, ignoring time-of-day — a same-day submission shouldn't get flagged
// just because the coordinator typed 9am and it happened to upload at 9:05am.
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

// A District Coordinator's own training submission — same photo/duplicate/GPS/EXIF handling
// as a social mobilizer's activity, but there's exactly one coordinator per district (no
// team, no attendee list), so occupancy is just "has this exact plan week already been used".
export async function createCoordinatorActivity(req, res) {
  const {
    time,
    activityType,
    description,
    gpsLat,
    gpsLong,
    facility,
    isRefresher,
    plannedActivity,
    responsiblePerson,
    targetGroup,
    expectedOutput,
    visitStatus,
    plan,
    planWeek,
  } = req.body;
  const districtId = req.user.district;

  if (!districtId) return res.status(400).json({ error: "Your account isn't linked to a district" });
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

  // Defense in depth: verify the facility is real and actually in this coordinator's own
  // district, rather than trusting whatever ID the client happens to send.
  const facilityDoc = await Facility.findById(facility);
  if (!facilityDoc) return res.status(400).json({ error: "Facility not found" });
  if (String(facilityDoc.district) !== String(districtId)) {
    return res.status(403).json({ error: "This facility is not in your district" });
  }

  // Defense in depth: verify the referenced plan/week is real and actually assigned to this
  // coordinator's district, rather than trusting whatever IDs the client happens to send.
  const planDoc = await CoordinatorPlan.findById(plan);
  if (!planDoc) return res.status(400).json({ error: "Plan not found" });
  if (!planDoc.districts.some((d) => String(d) === String(districtId))) {
    return res.status(403).json({ error: "This plan is not assigned to your district" });
  }
  const weekEntry = planDoc.weeks.id(planWeek);
  if (!weekEntry) return res.status(400).json({ error: "Invalid week for this plan" });

  // Mirrors the dropdown filtering in listCoordinatorPlans: a week that's already submitted,
  // verified, or flagged is occupied, so this blocks a stale/still-open form from double-using it.
  const alreadyOccupied = await CoordinatorActivityRecord.exists({
    district: districtId,
    planWeek,
    status: { $in: ["submitted", "verified", "flagged"] },
  });
  if (alreadyOccupied) return res.status(409).json({ error: "This week already has an activity submitted for it" });

  const submittedAt = new Date();
  const dateTime = new Date(weekEntry.date);
  if (time) {
    const [hours, minutes] = time.split(":").map(Number);
    dateTime.setHours(hours || 0, minutes || 0, 0, 0);
  }

  const activity = await CoordinatorActivityRecord.create({
    district: districtId,
    submittedBy: req.user._id,
    dateTime,
    activityType,
    facility,
    isRefresher: isRefresher === "true" || isRefresher === true,
    plannedActivity,
    responsiblePerson,
    targetGroup,
    expectedOutput,
    visitStatus,
    plan,
    planWeek,
    description,
  });

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

  await logAction(req.user._id, "create", "CoordinatorActivityRecord", activity._id, {
    anyDuplicate,
    anyLocationUnverified,
    anyCaptureDateMismatch,
  });
  res.status(201).json({ activity, flags: { anyDuplicate, anyLocationUnverified, anyCaptureDateMismatch } });
}

export async function listCoordinatorActivities(req, res) {
  const filter = {};
  if (req.query.district) filter.district = req.query.district;
  if (req.query.status) filter.status = req.query.status;
  // A district_viewer only ever sees their own district's records; super_admin sees everything.
  if (req.user.role === "district_viewer") filter.district = req.user.district;

  const activities = await CoordinatorActivityRecord.find(filter)
    .populate("district", "name")
    .populate("submittedBy", "name")
    .populate("facility", "name category")
    .sort("-dateTime")
    .lean();

  res.json(activities);
}

export async function getCoordinatorActivity(req, res) {
  const activity = await CoordinatorActivityRecord.findById(req.params.id)
    .populate("district", "name")
    .populate("submittedBy", "name")
    .populate("facility", "name category");
  if (!activity) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "district_viewer" && String(activity.district?._id) !== String(req.user.district)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const images = await ImageMetadata.find({ activityRecord: activity._id });
  res.json({ activity, images });
}

// Super Admin verifies or flags a record — same review workflow as social mobilizer activities.
export async function setCoordinatorActivityStatus(req, res) {
  const { status, statusReason } = req.body;
  if (!["submitted", "verified", "flagged"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const activity = await CoordinatorActivityRecord.findById(req.params.id);
  if (!activity) return res.status(404).json({ error: "Not found" });

  activity.editHistory.push({ editedBy: req.user._id, changes: { status: { from: activity.status, to: status } } });
  activity.status = status;
  activity.statusReason = statusReason || "";
  await activity.save();
  await logAction(req.user._id, "status_change", "CoordinatorActivityRecord", activity._id, { status, statusReason });
  res.json(activity);
}
