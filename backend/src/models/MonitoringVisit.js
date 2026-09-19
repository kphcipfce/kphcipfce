import mongoose from "mongoose";

const editLogEntry = new mongoose.Schema(
  {
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
    editedAt: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const reviewEntrySchema = new mongoose.Schema(
  {
    reviewerName: { type: String, required: true, trim: true },
    reviewDate: { type: Date, required: true },
    acceptedComplete: { type: String, enum: ["Yes", "No", "N/A"], required: true },
    reviewerRemarks: { type: String, required: true, trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    reviewedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const monitoringVisitSchema = new mongoose.Schema(
  {
    district: { type: mongoose.Schema.Types.ObjectId, ref: "District", required: true },
    facility: { type: mongoose.Schema.Types.ObjectId, ref: "Facility", required: true },
    ucVillage: { type: String, required: true, trim: true },
    coordinator: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    targetMobilizer: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    targetMobilizer2: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "MonitoringPlan", required: true },
    planWeek: { type: mongoose.Schema.Types.ObjectId, required: true },
    dateTime: { type: Date, required: true },

    // Section 1: Type of Activity Observed
    activityObserved: { type: String, required: true },

    // Section 2: Preparation & Logistics (Key-value map: Yes / No / N/A)
    prepLogistics: { type: Map, of: String, default: {} },

    // Section 3: Session Delivery & Quality (Key-value map: Yes / No / N/A)
    sessionDelivery: { type: Map, of: String, default: {} },

    // Section 4: Attendance & Inclusion
    attendanceInclusion: {
      registerCompleted: { type: String, enum: ["Yes", "No", "N/A"], default: "N/A" },
      totalParticipants: { type: Number, default: 0 },
      femaleParticipants: { type: Number, default: 0 },
      femaleParticipation50Pct: { type: String, enum: ["Yes", "No", "N/A"], default: "N/A" },
      vulnerableGroupsPresent: { type: String, enum: ["Yes", "No", "N/A"], default: "N/A" },
      separateArrangementsWomen: { type: String, enum: ["Yes", "No", "N/A"], default: "N/A" },
    },

    // Section 5: Safeguarding & Staff Conduct (Key-value map: Yes / No / N/A)
    safeguardingConduct: { type: Map, of: String, default: {} },

    // Section 6: Activity-Specific Checklist
    activitySpecificType: { type: String, required: true },
    activitySpecificChecklist: { type: Map, of: Boolean, default: {} },

    // Section 7: Grievance Redress Mechanism (GRM) Check
    grmCheck: {
      boxPresent: { type: String, enum: ["Yes", "No", "N/A"], default: "N/A" },
      membersAware: { type: String, enum: ["Yes", "No", "N/A"], default: "N/A" },
      complaintRaised: { type: String, enum: ["Yes", "No", "N/A"], default: "N/A" },
      complaintNotes: { type: String, trim: true, default: "" },
    },

    // Section 8: Evidence Collected (Checkboxes)
    evidenceCollected: [{ type: String }],

    // Section 9: Overall Rating & Observations
    overallRating: {
      type: String,
      enum: ["Excellent", "Good", "Satisfactory", "Needs Improvement", "Poor"],
      required: true,
    },
    keyStrengths: { type: String, trim: true, default: "" },
    keyGaps: { type: String, trim: true, default: "" },
    correctiveActionRequired: { type: String, enum: ["Yes", "No", "N/A"], default: "N/A" },
    correctiveActionDetails: { type: String, trim: true, default: "" },
    followUpBy: { type: String, trim: true, default: "" },
    followUpDueDate: { type: String, trim: true, default: "" },

    // Section 10: Certification & Sign-off
    dcmoName: { type: String, required: true, trim: true },
    signOffDate: { type: Date, required: true },

    // Calculated percentage score of positive "Yes" responses out of total applicable items
    scorePercentage: { type: Number, default: 0 },

    // Multiple reviews by TL / DTL (mumtaztl@gmail.com / sanadtl@gmail.com)
    reviews: [reviewEntrySchema],

    // Status & Latest Review summary
    status: { type: String, enum: ["submitted", "reviewed"], default: "submitted" },
    reviewerName: { type: String, trim: true, default: null },
    reviewDate: { type: Date, default: null },
    acceptedComplete: { type: String, enum: ["Yes", "No", "N/A"], default: null },
    reviewerRemarks: { type: String, trim: true, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null },
    reviewedAt: { type: Date, default: null },

    editHistory: [editLogEntry],
  },
  { timestamps: true }
);

export default mongoose.model("MonitoringVisit", monitoringVisitSchema);
