import mongoose from "mongoose";

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

const detailedResponseSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    code: { type: String, required: true },
    domain: { type: String, enum: ["Knowledge", "Attitude", "Practice"], required: true },
    themeId: { type: Number, required: true },
    themeTitle: { type: String, required: true },
    response: { type: mongoose.Schema.Types.Mixed },
    isPositive: { type: Boolean, default: false },
  },
  { _id: false }
);

const kapSurveySchema = new mongoose.Schema(
  {
    district: { type: mongoose.Schema.Types.ObjectId, ref: "District", required: true },
    facility: { type: mongoose.Schema.Types.ObjectId, ref: "Facility", required: true },
    respondentCategory: { type: String, enum: ["School", "Community", "Health Staff", "Patients"], required: true },
    respondentSex: { type: String, enum: ["Male", "Female"], required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    submittedByRole: { type: String, enum: ["member", "district_viewer"], required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "KapPlan", required: true },
    planWeek: { type: mongoose.Schema.Types.ObjectId, required: true },
    dateTime: { type: Date, required: true },

    // Structured map of question ID to response value (string or array of strings)
    responses: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Detailed responses storing [K], [A], [P] domain tag and theme details for each question
    responsesDetailed: [detailedResponseSchema],

    scorePercentage: { type: Number, default: 0 },

    // Multiple reviews by TL / DTL
    reviews: [reviewEntrySchema],

    status: { type: String, enum: ["submitted", "reviewed"], default: "submitted" },
    reviewerName: { type: String, trim: true, default: null },
    reviewDate: { type: Date, default: null },
    acceptedComplete: { type: String, enum: ["Yes", "No", "N/A"], default: null },
    reviewerRemarks: { type: String, trim: true, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("KapSurvey", kapSurveySchema);
