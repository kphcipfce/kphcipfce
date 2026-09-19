import crypto from "node:crypto";
import { Readable } from "node:stream";
import MonitoringVisit from "../models/MonitoringVisit.js";
import MonitoringPlan from "../models/MonitoringPlan.js";
import Facility from "../models/Facility.js";
import ImageMetadata from "../models/ImageMetadata.js";
import { logAction } from "../middleware/audit.js";
import cloudinary from "../config/cloudinary.js";
import { isWeekExpired } from "../utils/weekExpiry.js";

function checksumBuffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
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

function calculateScorePercentage(data) {
  let yesCount = 0;
  let totalApplicable = 0;

  function processValue(val) {
    if (val === "Yes" || val === true) {
      yesCount++;
      totalApplicable++;
    } else if (val === "No" || val === false) {
      totalApplicable++;
    }
  }

  if (data.prepLogistics) {
    const entries = typeof data.prepLogistics.values === "function" ? Array.from(data.prepLogistics.values()) : Object.values(data.prepLogistics);
    for (const v of entries) processValue(v);
  }

  if (data.sessionDelivery) {
    const entries = typeof data.sessionDelivery.values === "function" ? Array.from(data.sessionDelivery.values()) : Object.values(data.sessionDelivery);
    for (const v of entries) processValue(v);
  }

  if (data.attendanceInclusion) {
    const { registerCompleted, femaleParticipation50Pct, vulnerableGroupsPresent, separateArrangementsWomen } = data.attendanceInclusion;
    [registerCompleted, femaleParticipation50Pct, vulnerableGroupsPresent, separateArrangementsWomen].forEach(processValue);
  }

  if (data.safeguardingConduct) {
    const entries = typeof data.safeguardingConduct.values === "function" ? Array.from(data.safeguardingConduct.values()) : Object.values(data.safeguardingConduct);
    for (const v of entries) processValue(v);
  }

  if (data.activitySpecificChecklist) {
    const entries = typeof data.activitySpecificChecklist.values === "function" ? Array.from(data.activitySpecificChecklist.values()) : Object.values(data.activitySpecificChecklist);
    for (const v of entries) processValue(v);
  }

  if (data.grmCheck) {
    const { boxPresent, membersAware, complaintRaised } = data.grmCheck;
    [boxPresent, membersAware, complaintRaised].forEach(processValue);
  }

  if (totalApplicable === 0) return 100;
  return Math.round((yesCount / totalApplicable) * 100);
}

export async function createMonitoringVisit(req, res) {
  try {
    const body = typeof req.body.data === "string" ? JSON.parse(req.body.data) : req.body;

    const {
      district,
      facility,
      ucVillage,
      targetMobilizer,
      targetMobilizer2,
      plan,
      planWeek,
      dateTime,
      activityObserved,
      prepLogistics,
      sessionDelivery,
      attendanceInclusion,
      safeguardingConduct,
      activitySpecificType,
      activitySpecificChecklist,
      grmCheck,
      evidenceCollected,
      overallRating,
      keyStrengths,
      keyGaps,
      correctiveActionRequired,
      correctiveActionDetails,
      followUpBy,
      followUpDueDate,
      dcmoName,
      signOffDate,
    } = body;

    if (!district || !facility || !ucVillage || !targetMobilizer || !plan || !planWeek || !dcmoName) {
      return res.status(400).json({ error: "Required header fields missing (district, facility, ucVillage, targetMobilizer, plan, planWeek, dcmoName)" });
    }

    if (!req.files || req.files.length < 3) {
      return res.status(400).json({ error: "At least 3 photo evidence files are required" });
    }

    const planDoc = await MonitoringPlan.findById(plan);
    if (!planDoc) return res.status(400).json({ error: "Monitoring Plan not found" });

    const weekEntry = planDoc.weeks.id(planWeek);
    if (!weekEntry) return res.status(400).json({ error: "Invalid week for this monitoring plan" });
    if (isWeekExpired(weekEntry.date)) {
      return res.status(409).json({ error: "This week's date has passed — it must be submitted on its assigned date" });
    }

    const alreadySubmitted = await MonitoringVisit.exists({ planWeek });
    if (alreadySubmitted) {
      return res.status(409).json({ error: "A monitoring visit has already been submitted for this plan week" });
    }

    const scorePercentage = calculateScorePercentage({
      prepLogistics,
      sessionDelivery,
      attendanceInclusion,
      safeguardingConduct,
      activitySpecificChecklist,
      grmCheck,
    });

    const visit = await MonitoringVisit.create({
      district,
      facility,
      ucVillage,
      coordinator: req.user._id,
      targetMobilizer,
      targetMobilizer2: targetMobilizer2 || planDoc.targetMobilizer2 || null,
      plan,
      planWeek,
      dateTime: dateTime || weekEntry.date,
      activityObserved,
      prepLogistics: prepLogistics || {},
      sessionDelivery: sessionDelivery || {},
      attendanceInclusion: attendanceInclusion || {},
      safeguardingConduct: safeguardingConduct || {},
      activitySpecificType,
      activitySpecificChecklist: activitySpecificChecklist || {},
      grmCheck: grmCheck || {},
      evidenceCollected: evidenceCollected || [],
      overallRating,
      keyStrengths: keyStrengths || "",
      keyGaps: keyGaps || "",
      correctiveActionRequired: correctiveActionRequired || "N/A",
      correctiveActionDetails: correctiveActionDetails || "",
      followUpBy: followUpBy || "",
      followUpDueDate: followUpDueDate || "",
      dcmoName,
      signOffDate: signOffDate || new Date(),
      scorePercentage,
      status: "submitted",
    });

    for (const file of req.files) {
      const checksum = checksumBuffer(file.buffer);
      const uploaded = await uploadToCloudinary(file.buffer);

      await ImageMetadata.create({
        monitoringVisit: visit._id,
        fileUrl: uploaded.secure_url,
        checksum,
        fileSize: file.size,
        fileType: file.mimetype,
        locationVerified: true,
      });
    }

    await logAction(req.user._id, "create", "MonitoringVisit", visit._id, { district, scorePercentage });

    const populated = await MonitoringVisit.findById(visit._id)
      .populate("district", "name")
      .populate("facility", "name category")
      .populate("coordinator", "name email")
      .populate("targetMobilizer", "name email gender")
      .populate("targetMobilizer2", "name email gender")
      .populate("reviewedBy", "name email");

    const images = await ImageMetadata.find({ monitoringVisit: visit._id });

    res.status(201).json({ visit: populated, images });
  } catch (err) {
    console.error("Error creating monitoring visit:", err);
    res.status(500).json({ error: err.message || "Failed to create monitoring visit" });
  }
}

export async function getMonitoringVisits(req, res) {
  try {
    const filter = {};
    if (req.query.status === "reviewed") {
      filter.$or = [{ status: "reviewed" }, { "reviews.0": { $exists: true } }];
    } else if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.district) filter.district = req.query.district;
    if (req.query.coordinator) filter.coordinator = req.query.coordinator;

    if (req.user.role === "district_viewer") {
      filter.coordinator = req.user._id;
    }

    const visits = await MonitoringVisit.find(filter)
      .populate("district", "name")
      .populate("facility", "name category")
      .populate("coordinator", "name email")
      .populate("targetMobilizer", "name email gender")
      .populate("targetMobilizer2", "name email gender")
      .populate("reviewedBy", "name email")
      .sort("-createdAt")
      .lean();

    const visitIds = visits.map((v) => v._id);
    const images = await ImageMetadata.find({ monitoringVisit: { $in: visitIds } }).lean();

    const imagesByVisit = {};
    for (const img of images) {
      const vId = String(img.monitoringVisit);
      if (!imagesByVisit[vId]) imagesByVisit[vId] = [];
      imagesByVisit[vId].push(img);
    }

    const results = visits.map((v) => ({
      ...v,
      images: imagesByVisit[String(v._id)] || [],
    }));

    res.json(results);
  } catch (err) {
    console.error("Error fetching monitoring visits:", err);
    res.status(500).json({ error: "Failed to fetch monitoring visits" });
  }
}

export async function getMonitoringVisitById(req, res) {
  try {
    const visit = await MonitoringVisit.findById(req.params.id)
      .populate("district", "name")
      .populate("facility", "name category")
      .populate("coordinator", "name email")
      .populate("targetMobilizer", "name email gender")
      .populate("targetMobilizer2", "name email gender")
      .populate("reviewedBy", "name email");

    if (!visit) return res.status(404).json({ error: "Monitoring Visit not found" });

    const images = await ImageMetadata.find({ monitoringVisit: visit._id });
    res.json({ visit, images });
  } catch (err) {
    console.error("Error fetching monitoring visit:", err);
    res.status(500).json({ error: "Failed to fetch monitoring visit" });
  }
}

export async function reviewMonitoringVisit(req, res) {
  try {
    if (req.user.role !== "tl_reviewer" && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "Only TL/DTL reviewers or Super Admin can review monitoring visits" });
    }

    const { reviewerName, reviewDate, acceptedComplete, reviewerRemarks } = req.body;

    if (!reviewerName || !acceptedComplete || !reviewerRemarks) {
      return res.status(400).json({ error: "Reviewer Name, Accepted/Complete status, and Remarks are required" });
    }

    const visit = await MonitoringVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ error: "Monitoring Visit not found" });

    const newReview = {
      reviewerName,
      reviewDate: reviewDate ? new Date(reviewDate) : new Date(),
      acceptedComplete,
      reviewerRemarks,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
    };

    if (!Array.isArray(visit.reviews)) {
      visit.reviews = [];
    }

    const existingIndex = visit.reviews.findIndex(
      (r) => String(r.reviewedBy) === String(req.user._id)
    );

    if (existingIndex >= 0) {
      visit.reviews[existingIndex] = newReview;
    } else {
      visit.reviews.push(newReview);
    }

    // Keep top-level fields populated with latest review
    visit.reviewerName = reviewerName;
    visit.reviewDate = newReview.reviewDate;
    visit.acceptedComplete = acceptedComplete;
    visit.reviewerRemarks = reviewerRemarks;
    visit.status = "reviewed";
    visit.reviewedBy = req.user._id;
    visit.reviewedAt = new Date();

    visit.editHistory.push({
      editedBy: req.user._id,
      changes: { status: { from: visit.status, to: "reviewed" }, reviewerRemarks, reviewerName },
    });

    await visit.save();
    await logAction(req.user._id, "review", "MonitoringVisit", visit._id, { acceptedComplete, status: "reviewed" });

    const populated = await MonitoringVisit.findById(visit._id)
      .populate("district", "name")
      .populate("facility", "name category")
      .populate("coordinator", "name email")
      .populate("targetMobilizer", "name email gender")
      .populate("targetMobilizer2", "name email gender")
      .populate("reviewedBy", "name email");

    const images = await ImageMetadata.find({ monitoringVisit: visit._id });

    res.json({ visit: populated, images });
  } catch (err) {
    console.error("Error reviewing monitoring visit:", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
}
