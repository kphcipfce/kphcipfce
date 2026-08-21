import mongoose from "mongoose";

const editLogEntry = new mongoose.Schema(
  {
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
    editedAt: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

// A District Coordinator's own training activities — deliberately a separate collection from
// ActivityRecord (social mobilizer field visits), not a shared one with a type flag: it keeps
// this data structurally out of the Field Tracker export and every dashboard aggregation
// built around teams/facilities-per-visit, with no risk of an exclusion filter being missed.
const coordinatorActivityRecordSchema = new mongoose.Schema(
  {
    district: { type: mongoose.Schema.Types.ObjectId, ref: "District", required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    dateTime: { type: Date, required: true },
    activityType: { type: String, enum: ["Environmental awareness & HCWM", "SEA/SH"], required: true },
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
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "CoordinatorPlan", required: true },
    planWeek: { type: mongoose.Schema.Types.ObjectId, required: true }, // matches a weeks[]._id inside `plan`
    description: { type: String, trim: true }, // free-text "Remarks / Follow-up" in the UI
    status: { type: String, enum: ["submitted", "verified", "flagged"], default: "submitted" },
    statusReason: { type: String, trim: true },
    editHistory: [editLogEntry],
  },
  { timestamps: true }
);

export default mongoose.model("CoordinatorActivityRecord", coordinatorActivityRecordSchema);
