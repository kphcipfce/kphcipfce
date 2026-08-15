import mongoose from "mongoose";

const editLogEntry = new mongoose.Schema(
  {
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
    editedAt: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const activityRecordSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    district: { type: mongoose.Schema.Types.ObjectId, ref: "District", required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    dateTime: { type: Date, required: true },
    activityType: { type: String, required: true },
    healthFacility: { type: String, required: true, trim: true },
    plannedActivity: { type: String, required: true, trim: true },
    responsiblePerson: { type: String, required: true, trim: true },
    targetGroup: { type: String, required: true, trim: true },
    expectedOutput: { type: String, required: true, trim: true },
    visitStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Deferred / Rescheduled"],
      default: "Completed",
    },
    microPlan: { type: mongoose.Schema.Types.ObjectId, ref: "MicroPlan", required: true },
    microPlanWeek: { type: mongoose.Schema.Types.ObjectId, required: true }, // matches a weeks[]._id inside `microPlan`
    description: { type: String, trim: true }, // free-text "Remarks / Follow-up" in the UI
    status: { type: String, enum: ["submitted", "verified", "flagged"], default: "submitted" },
    statusReason: { type: String, trim: true },
    editHistory: [editLogEntry],
  },
  { timestamps: true }
);

export default mongoose.model("ActivityRecord", activityRecordSchema);
