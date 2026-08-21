import mongoose from "mongoose";

const editLogEntry = new mongoose.Schema(
  {
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
    editedAt: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

// A GRM Focal Person's own training activities — a separate collection again (same reasoning
// as CoordinatorActivityRecord vs ActivityRecord): keeps this data structurally out of the
// Field Tracker export and every other report built around social mobilizers/coordinators.
// Only one activity type exists here, unlike the coordinator's two.
const grmActivityRecordSchema = new mongoose.Schema(
  {
    district: { type: mongoose.Schema.Types.ObjectId, ref: "District", required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    dateTime: { type: Date, required: true },
    activityType: { type: String, enum: ["GRM capacity building of PCMC & HMC"], required: true },
    facility: { type: mongoose.Schema.Types.ObjectId, ref: "Facility", required: true },
    isRefresher: { type: Boolean, default: false },
    plannedActivity: { type: String, required: true, trim: true },
    responsiblePerson: { type: String, required: true, trim: true },
    targetGroup: { type: String, required: true, trim: true },
    expectedOutput: { type: String, required: true, trim: true },
    visitStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Deferred / Rescheduled"],
      default: "Completed",
    },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "GrmPlan", required: true },
    planWeek: { type: mongoose.Schema.Types.ObjectId, required: true }, // matches a weeks[]._id inside `plan`
    description: { type: String, trim: true }, // free-text "Remarks / Follow-up" in the UI
    status: { type: String, enum: ["submitted", "verified", "flagged"], default: "submitted" },
    statusReason: { type: String, trim: true },
    editHistory: [editLogEntry],
  },
  { timestamps: true }
);

export default mongoose.model("GrmActivityRecord", grmActivityRecordSchema);
