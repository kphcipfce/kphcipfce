import mongoose from "mongoose";
import ExcelJS from "exceljs";
import KapSurvey from "../models/KapSurvey.js";
import KapPlan from "../models/KapPlan.js";
import { logAction } from "../middleware/audit.js";
import { isWeekExpired } from "../utils/weekExpiry.js";
import { buildDetailedResponses, findQuestionById, KAP_THEMES } from "../utils/kapQuestionnaireMap.js";

function calculateKapScore(responses) {
  if (!responses || typeof responses !== "object") return 100;
  let positive = 0;
  let total = 0;

  for (const [key, val] of Object.entries(responses)) {
    if (val === "Yes" || val === "Agree" || val === "Satisfied") {
      positive++;
      total++;
    } else if (val === "No" || val === "Disagree" || val === "Dissatisfied") {
      total++;
    } else if (Array.isArray(val)) {
      if (val.length > 0 && !val.includes("Don't know")) {
        positive++;
      }
      total++;
    }
  }

  if (total === 0) return 100;
  return Math.round((positive / total) * 100);
}

export async function createKapSurvey(req, res) {
  try {
    const {
      district,
      facility,
      respondentCategory,
      respondentSex,
      plan,
      planWeek,
      dateTime,
      responses,
    } = req.body;

    if (!district || !facility || !respondentCategory || !respondentSex || !plan || !planWeek || !responses) {
      return res.status(400).json({ error: "Missing required fields (district, facility, respondentCategory, respondentSex, plan, planWeek, responses)" });
    }

    const planDoc = await KapPlan.findById(plan);
    if (!planDoc) return res.status(400).json({ error: "KAP Plan not found" });

    const weekEntry = planDoc.weeks.id(planWeek);
    if (!weekEntry) return res.status(400).json({ error: "Invalid week for this KAP plan" });
    if (isWeekExpired(weekEntry.date)) {
      return res.status(409).json({ error: "This week's date has passed — it must be submitted on its assigned date" });
    }

    const alreadySubmitted = await KapSurvey.exists({ planWeek });
    if (alreadySubmitted) {
      return res.status(409).json({ error: "A KAP Survey has already been submitted for this plan week" });
    }

    const scorePercentage = calculateKapScore(responses);
    const responsesDetailed = buildDetailedResponses(responses, respondentCategory);

    const survey = await KapSurvey.create({
      district,
      facility,
      respondentCategory,
      respondentSex,
      submittedBy: req.user._id,
      submittedByRole: req.user.role === "district_viewer" ? "district_viewer" : "member",
      plan,
      planWeek,
      dateTime: dateTime || weekEntry.date,
      responses,
      responsesDetailed,
      scorePercentage,
      status: "submitted",
    });

    await logAction(req.user._id, "create", "KapSurvey", survey._id, { district, respondentCategory, respondentSex });

    const populated = await KapSurvey.findById(survey._id)
      .populate("district", "name")
      .populate("facility", "name category")
      .populate("submittedBy", "name email role")
      .populate("reviewedBy", "name email");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Error creating KAP survey:", err);
    res.status(500).json({ error: err.message || "Failed to create KAP survey" });
  }
}

export async function getKapSurveys(req, res) {
  try {
    const filter = {};
    if (req.query.status === "reviewed") {
      filter.$or = [{ status: "reviewed" }, { "reviews.0": { $exists: true } }];
    } else if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.district) filter.district = req.query.district;

    if (req.user.role === "member" || req.user.role === "district_viewer") {
      filter.submittedBy = req.user._id;
    }

    const surveys = await KapSurvey.find(filter)
      .populate("district", "name")
      .populate("facility", "name category")
      .populate("submittedBy", "name email role")
      .populate("reviewedBy", "name email")
      .sort("-createdAt")
      .lean();

    res.json(surveys);
  } catch (err) {
    console.error("Error fetching KAP surveys:", err);
    res.status(500).json({ error: "Failed to fetch KAP surveys" });
  }
}

export async function getKapSurveyById(req, res) {
  try {
    const survey = await KapSurvey.findById(req.params.id)
      .populate("district", "name")
      .populate("facility", "name category")
      .populate("submittedBy", "name email role")
      .populate("reviewedBy", "name email");

    if (!survey) return res.status(404).json({ error: "KAP Survey not found" });

    res.json(survey);
  } catch (err) {
    console.error("Error fetching KAP survey:", err);
    res.status(500).json({ error: "Failed to fetch KAP survey" });
  }
}

export async function reviewKapSurvey(req, res) {
  try {
    if (req.user.role !== "tl_reviewer" && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "Only TL/DTL reviewers or Super Admin can review KAP surveys" });
    }

    const { reviewerName, reviewDate, acceptedComplete, reviewerRemarks } = req.body;

    if (!reviewerName || !acceptedComplete || !reviewerRemarks) {
      return res.status(400).json({ error: "Reviewer Name, Accepted/Complete status, and Remarks are required" });
    }

    const survey = await KapSurvey.findById(req.params.id);
    if (!survey) return res.status(404).json({ error: "KAP Survey not found" });

    const newReview = {
      reviewerName,
      reviewDate: reviewDate ? new Date(reviewDate) : new Date(),
      acceptedComplete,
      reviewerRemarks,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
    };

    if (!Array.isArray(survey.reviews)) {
      survey.reviews = [];
    }

    const existingIndex = survey.reviews.findIndex(
      (r) => String(r.reviewedBy) === String(req.user._id)
    );

    if (existingIndex >= 0) {
      survey.reviews[existingIndex] = newReview;
    } else {
      survey.reviews.push(newReview);
    }

    survey.reviewerName = reviewerName;
    survey.reviewDate = newReview.reviewDate;
    survey.acceptedComplete = acceptedComplete;
    survey.reviewerRemarks = reviewerRemarks;
    survey.status = "reviewed";
    survey.reviewedBy = req.user._id;
    survey.reviewedAt = new Date();

    await survey.save();
    await logAction(req.user._id, "review", "KapSurvey", survey._id, { acceptedComplete, status: "reviewed" });

    const populated = await KapSurvey.findById(survey._id)
      .populate("district", "name")
      .populate("facility", "name category")
      .populate("submittedBy", "name email role")
      .populate("reviewedBy", "name email");

    res.json(populated);
  } catch (err) {
    console.error("Error reviewing KAP survey:", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
}

export async function getKapAnalytics(req, res) {
  try {
    const filter = {};
    if (req.query.district) filter.district = req.query.district;
    if (req.query.category) filter.respondentCategory = req.query.category;

    const surveys = await KapSurvey.find(filter).lean();

    // Aggregate theme metrics across surveys
    const totalSurveys = surveys.length;
    const categoryBreakdown = { School: 0, Community: 0, "Health Staff": 0, Patients: 0 };
    const sexBreakdown = { Male: 0, Female: 0 };

    // Theme-wise KAP domain aggregation
    const themeStats = {};
    KAP_THEMES.forEach((t) => {
      themeStats[t.id] = {
        themeId: t.id,
        themeKey: `Theme ${t.id}`,
        themeLabel: `Theme ${t.id}`,
        fullTitle: t.titleEn,
        kPos: 0, kTotal: 0,
        aPos: 0, aTotal: 0,
        pPos: 0, pTotal: 0,
      };
    });

    let globalKPos = 0, globalKTotal = 0;
    let globalAPos = 0, globalATotal = 0;
    let globalPPos = 0, globalPTotal = 0;

    // GRM Theme metrics (Theme 4)
    let grmAwareCount = 0;
    let safeReportingAwareCount = 0;
    let complaintMadeCount = 0;
    let complaintResolvedCount = 0;
    let grmAgreeCount = 0;

    // Medicine & FP metrics
    let freeMedicinesAwareCount = 0;
    let fpCommoditiesAwareCount = 0;
    let solarizationAwareCount = 0;

    for (const s of surveys) {
      if (s.respondentCategory && categoryBreakdown[s.respondentCategory] !== undefined) {
        categoryBreakdown[s.respondentCategory]++;
      }
      if (s.respondentSex && sexBreakdown[s.respondentSex] !== undefined) {
        sexBreakdown[s.respondentSex]++;
      }

      const resps = s.responses || {};

      // Detailed response items
      const detailed = (Array.isArray(s.responsesDetailed) && s.responsesDetailed.length > 0)
        ? s.responsesDetailed
        : buildDetailedResponses(resps, s.respondentCategory);

      for (const item of detailed) {
        const tId = item.themeId || 1;
        if (!themeStats[tId]) continue;

        if (item.domain === "Knowledge") {
          themeStats[tId].kTotal++;
          globalKTotal++;
          if (item.isPositive) {
            themeStats[tId].kPos++;
            globalKPos++;
          }
        } else if (item.domain === "Attitude") {
          themeStats[tId].aTotal++;
          globalATotal++;
          if (item.isPositive) {
            themeStats[tId].aPos++;
            globalAPos++;
          }
        } else if (item.domain === "Practice") {
          themeStats[tId].pTotal++;
          globalPTotal++;
          if (item.isPositive) {
            themeStats[tId].pPos++;
            globalPPos++;
          }
        }
      }
      
      // GRM checks (A8, A9, AT3, A10, A11, S5, ST2, H4, HT2, P4, PT2)
      if (resps.A8 === "Yes" || resps.S5 === "Yes" || resps.H4 === "Yes" || resps.P4 === "Yes") grmAwareCount++;
      if (resps.A9 === "Yes") safeReportingAwareCount++;
      if (resps.A10 === "Yes") complaintMadeCount++;
      if (resps.A11 === "Yes") complaintResolvedCount++;
      if (resps.AT3 === "Agree" || resps.ST2 === "Agree" || resps.HT2 === "Agree" || resps.PT2 === "Agree") grmAgreeCount++;

      if (resps.A3 === "Yes" || resps.S3 === "Yes" || resps.H2 === "Yes" || resps.P2 === "Yes") freeMedicinesAwareCount++;
      if (resps.A5 === "Yes" || resps.H3 === "Yes" || resps.P3 === "Yes") fpCommoditiesAwareCount++;
      if (resps.A13 === "Yes" || resps.S7 === "Yes" || resps.H6 === "Yes" || resps.P6 === "Yes") solarizationAwareCount++;
    }

    const themeKapData = Object.values(themeStats).map((t) => {
      const kPct = t.kTotal > 0 ? Math.round((t.kPos / t.kTotal) * 100) : 0;
      const aPct = t.aTotal > 0 ? Math.round((t.aPos / t.aTotal) * 100) : 0;
      const pPct = t.pTotal > 0 ? Math.round((t.pPos / t.pTotal) * 100) : 0;
      return {
        themeId: t.themeId,
        themeKey: t.themeKey,
        themeLabel: t.themeLabel,
        fullTitle: t.fullTitle,
        Knowledge: kPct,
        Attitude: aPct,
        Practice: pPct,
        kPos: t.kPos, kTotal: t.kTotal,
        aPos: t.aPos, aTotal: t.aTotal,
        pPos: t.pPos, pTotal: t.pTotal,
      };
    });

    // Append grand total bar item
    const overallKnowledgePct = globalKTotal > 0 ? Math.round((globalKPos / globalKTotal) * 100) : 0;
    const overallAttitudePct = globalATotal > 0 ? Math.round((globalAPos / globalATotal) * 100) : 0;
    const overallPracticePct = globalPTotal > 0 ? Math.round((globalPPos / globalPTotal) * 100) : 0;

    themeKapData.push({
      themeId: "total",
      themeKey: "Total",
      themeLabel: "Total",
      fullTitle: "Overall Aggregate Across All Themes",
      Knowledge: overallKnowledgePct,
      Attitude: overallAttitudePct,
      Practice: overallPracticePct,
      kPos: globalKPos, kTotal: globalKTotal,
      aPos: globalAPos, aTotal: globalATotal,
      pPos: globalPPos, pTotal: globalPTotal,
    });

    // District-wise facility coverage and survey type gender breakdown aggregation
    const districtPipeline = [
      ...(req.query.district ? [{ $match: { district: new mongoose.Types.ObjectId(req.query.district) } }] : []),
      {
        $lookup: {
          from: "districts",
          localField: "district",
          foreignField: "_id",
          as: "districtInfo",
        },
      },
      { $unwind: "$districtInfo" },
      {
        $lookup: {
          from: "facilities",
          localField: "facility",
          foreignField: "_id",
          as: "facilityInfo",
        },
      },
      { $unwind: "$facilityInfo" },
      {
        $group: {
          _id: {
            district: "$districtInfo.name",
            surveyType: "$respondentCategory",
            facility: "$facility",
          },
          facilityName: { $first: "$facilityInfo.name" },
          category: { $first: "$facilityInfo.category" },
          female: {
            $sum: { $cond: [{ $eq: ["$respondentSex", "Female"] }, 1, 0] },
          },
          male: {
            $sum: { $cond: [{ $eq: ["$respondentSex", "Male"] }, 1, 0] },
          },
          facilityGrandTotal: { $sum: 1 },
        },
      },
      { $sort: { facilityName: 1 } },
      {
        $group: {
          _id: {
            district: "$_id.district",
            surveyType: "$_id.surveyType",
          },
          facilitiesCoveredCount: { $sum: 1 },
          totalFemale: { $sum: "$female" },
          totalMale: { $sum: "$male" },
          surveyTypeGrandTotal: { $sum: "$facilityGrandTotal" },
          facilities: {
            $push: {
              healthFacility: {
                $concat: ["$facilityName", " (", "$category", ")"],
              },
              female: "$female",
              male: "$male",
              grandTotal: "$facilityGrandTotal",
            },
          },
        },
      },
      { $sort: { "_id.surveyType": 1 } },
      {
        $group: {
          _id: "$_id.district",
          districtTotalFemale: { $sum: "$totalFemale" },
          districtTotalMale: { $sum: "$totalMale" },
          districtGrandTotalSurveys: { $sum: "$surveyTypeGrandTotal" },
          surveyTypesData: {
            $push: {
              surveyType: "$_id.surveyType",
              facilitiesCoveredCount: "$facilitiesCoveredCount",
              femaleCount: "$totalFemale",
              maleCount: "$totalMale",
              grandTotal: "$surveyTypeGrandTotal",
              facilities: "$facilities",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          districtName: "$_id",
          districtTotalFemale: 1,
          districtTotalMale: 1,
          districtGrandTotalSurveys: 1,
          surveyTypesData: 1,
        },
      },
      { $sort: { districtName: 1 } },
    ];

    const districtAnalytics = await KapSurvey.aggregate(districtPipeline);

    res.json({
      totalSurveys,
      categoryBreakdown,
      sexBreakdown,
      overallKap: {
        knowledgePct: overallKnowledgePct,
        attitudePct: overallAttitudePct,
        practicePct: overallPracticePct,
        kPos: globalKPos, kTotal: globalKTotal,
        aPos: globalAPos, aTotal: globalATotal,
        pPos: globalPPos, pTotal: globalPTotal,
      },
      themeKapData,
      districtAnalytics,
      grmTheme: {
        grmAwareCount,
        safeReportingAwareCount,
        complaintMadeCount,
        complaintResolvedCount,
        grmAgreeCount,
      },
      keyThemes: {
        freeMedicinesAwareCount,
        fpCommoditiesAwareCount,
        solarizationAwareCount,
      },
    });
  } catch (err) {
    console.error("Error fetching KAP analytics:", err);
    res.status(500).json({ error: "Failed to fetch KAP analytics" });
  }
}

export async function exportKapSurveysExcel(req, res) {
  try {
    const filter = {};
    if (req.query.district) filter.district = req.query.district;
    if (req.query.category) filter.respondentCategory = req.query.category;

    if (req.user.role === "member" || req.user.role === "district_viewer") {
      filter.submittedBy = req.user._id;
    }

    const surveys = await KapSurvey.find(filter)
      .populate("district", "name")
      .populate("facility", "name category")
      .populate("submittedBy", "name email role")
      .populate("reviewedBy", "name email")
      .sort("-createdAt")
      .lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "KP-HCIP KAP Analytics System";
    workbook.created = new Date();

    // -------------------------------------------------------------
    // Sheet 1: Master Overview & Record Index
    // -------------------------------------------------------------
    const overviewSheet = workbook.addWorksheet("Overview & Records");
    overviewSheet.columns = [
      { header: "Submission Date", key: "date", width: 16 },
      { header: "District", key: "district", width: 16 },
      { header: "Health Facility", key: "facility", width: 28 },
      { header: "Survey Type", key: "category", width: 16 },
      { header: "Respondent Sex", key: "sex", width: 14 },
      { header: "Submitted By", key: "submittedBy", width: 24 },
      { header: "Positive Score %", key: "score", width: 16 },
      { header: "Review Status", key: "status", width: 18 },
    ];

    overviewSheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF006644" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    for (const s of surveys) {
      overviewSheet.addRow({
        date: new Date(s.dateTime || s.createdAt).toLocaleDateString("en-GB"),
        district: s.district?.name || "N/A",
        facility: `${s.facility?.name || "N/A"} (${s.facility?.category || "N/A"})`,
        category: s.respondentCategory,
        sex: s.respondentSex,
        submittedBy: `${s.submittedBy?.name || "N/A"} (${s.submittedByRole === "district_viewer" ? "DC" : "SM"})`,
        score: `${s.scorePercentage}%`,
        status: s.reviews && s.reviews.length > 0 ? "Reviewed" : "Pending",
      });
    }

    // -------------------------------------------------------------
    // Theme-by-Theme Worksheets (Theme 1 to Theme 9)
    // Structure: Main (Theme Name) -> Sub (District) -> Indie Question Rows per Person
    // -------------------------------------------------------------
    for (const theme of KAP_THEMES) {
      const shortTitle = theme.titleEn.split("—")[1]?.trim() || `Theme ${theme.id}`;
      const sheetName = `Theme ${theme.id} - ${shortTitle.substring(0, 18)}`;
      const sheet = workbook.addWorksheet(sheetName);

      // Main Theme Title Banner (Row 1)
      sheet.mergeCells("A1:J1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = `Main Theme: ${theme.titleEn}`;
      titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF006644" } };
      titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      sheet.getRow(1).height = 28;

      // Group surveys by district for this theme
      const districtMap = new Map();
      for (const s of surveys) {
        const dName = s.district?.name || "Unassigned District";
        if (!districtMap.has(dName)) districtMap.set(dName, []);
        districtMap.get(dName).push(s);
      }

      let currentRowIdx = 3;

      if (surveys.length === 0) {
        const emptyRow = sheet.getRow(currentRowIdx);
        emptyRow.getCell(1).value = "No KAP Survey records available in database for this theme.";
        emptyRow.getCell(1).font = { italic: true, color: { argb: "FF666666" } };
        continue;
      }

      for (const [distName, distSurveys] of districtMap.entries()) {
        // Sub District Header Row
        sheet.mergeCells(`A${currentRowIdx}:J${currentRowIdx}`);
        const distCell = sheet.getCell(`A${currentRowIdx}`);
        distCell.value = `Sub District: ${distName}`;
        distCell.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
        distCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
        distCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        sheet.getRow(currentRowIdx).height = 24;
        currentRowIdx++;

        // Table Header Row for District Data
        const headerRow = sheet.getRow(currentRowIdx);
        const headers = [
          "Date",
          "Health Facility",
          "Survey Type",
          "Sex",
          "Submitted By",
          "Question Code",
          "KAP Domain",
          "Question Text",
          "Respondent Answer",
          "Result Status",
        ];

        headers.forEach((h, colIdx) => {
          const cell = headerRow.getCell(colIdx + 1);
          cell.value = h;
          cell.font = { bold: true, color: { argb: "FF334155" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
          cell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          };
        });
        headerRow.height = 20;
        currentRowIdx++;

        // Set column widths
        sheet.getColumn(1).width = 14; // Date
        sheet.getColumn(2).width = 24; // Facility
        sheet.getColumn(3).width = 16; // Category
        sheet.getColumn(4).width = 10; // Sex
        sheet.getColumn(5).width = 22; // Submitted By
        sheet.getColumn(6).width = 14; // Code
        sheet.getColumn(7).width = 14; // Domain
        sheet.getColumn(8).width = 45; // Question Text
        sheet.getColumn(9).width = 28; // Answer
        sheet.getColumn(10).width = 16; // Status

        // Add question-by-question response rows per person in this district
        let hasDataForDistrictTheme = false;

        for (const s of distSurveys) {
          const resps = s.responses || {};
          const detailed = Array.isArray(s.responsesDetailed) && s.responsesDetailed.length > 0
            ? s.responsesDetailed
            : buildDetailedResponses(resps, s.respondentCategory);

          const themeItems = detailed.filter((item) => item.themeId === theme.id);

          for (const item of themeItems) {
            hasDataForDistrictTheme = true;
            const qInfo = findQuestionById(item.questionId);
            const qText = qInfo ? qInfo.textEn : item.questionId;
            const ansStr = Array.isArray(item.response) ? item.response.join(", ") : String(item.response ?? "N/A");

            const dRow = sheet.getRow(currentRowIdx);
            dRow.getCell(1).value = new Date(s.dateTime || s.createdAt).toLocaleDateString("en-GB");
            dRow.getCell(2).value = `${s.facility?.name || "N/A"} (${s.facility?.category || ""})`;
            dRow.getCell(3).value = s.respondentCategory;
            dRow.getCell(4).value = s.respondentSex;
            dRow.getCell(5).value = `${s.submittedBy?.name || "N/A"} (${s.submittedByRole === "district_viewer" ? "DC" : "SM"})`;
            dRow.getCell(6).value = item.code;
            dRow.getCell(7).value = item.domain;
            dRow.getCell(8).value = qText;
            dRow.getCell(9).value = ansStr;

            const resCell = dRow.getCell(10);
            if (item.isPositive) {
              resCell.value = "Positive";
              resCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAD3" } };
              resCell.font = { bold: true, color: { argb: "FF2E7D32" } };
            } else {
              resCell.value = "Negative / Neutral";
              resCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4CCCC" } };
              resCell.font = { bold: true, color: { argb: "FFC00000" } };
            }

            currentRowIdx++;
          }
        }

        if (!hasDataForDistrictTheme) {
          const noDataRow = sheet.getRow(currentRowIdx);
          noDataRow.getCell(1).value = "No question entries recorded for this district under this theme.";
          noDataRow.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };
          currentRowIdx++;
        }

        currentRowIdx++; // Blank line between district blocks
      }
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=kap-survey-tracker.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exporting KAP surveys Excel:", err);
    res.status(500).json({ error: "Failed to export KAP survey records to Excel" });
  }
}
