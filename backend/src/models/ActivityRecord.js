import mongoose from "mongoose";
import { TOTAL_WEEKS } from "../config/projectCalendar.js";

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
    facility: { type: mongoose.Schema.Types.ObjectId, ref: "Facility", required: true },
    plannedActivity: { type: String, required: true, trim: true },
    responsiblePerson: { type: String, required: true, trim: true },
    targetGroup: { type: String, required: true, trim: true },
    expectedOutput: { type: String, required: true, trim: true },
    visitStatus: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Deferred / Rescheduled"],
      default: "Completed",
    },
    // Fixed 18-week project calendar (see config/projectCalendar.js) — every team shares the
    // same week numbering, so this is a plain number/day pair rather than a plan reference.
    week: { type: Number, required: true, min: 1, max: TOTAL_WEEKS },
    dayOfWeek: { type: String, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], required: true },
    // Headcount of the activity's actual audience — distinct from AttendanceEntry, which tracks
    // whether the submitter's own teammates were present, not who showed up to the session.
    maleAttendees: { type: Number, default: 0, min: 0 },
    femaleAttendees: { type: Number, default: 0, min: 0 },
    description: { type: String, trim: true }, // free-text "Remarks / Follow-up" in the UI
    status: { type: String, enum: ["submitted", "verified", "flagged"], default: "submitted" },
    statusReason: { type: String, trim: true },
    editHistory: [editLogEntry],
  },
  { timestamps: true }
);

export default mongoose.model("ActivityRecord", activityRecordSchema);
