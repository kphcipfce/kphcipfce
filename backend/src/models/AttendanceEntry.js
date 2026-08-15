import mongoose from "mongoose";

const attendanceEntrySchema = new mongoose.Schema(
  {
    activityRecord: { type: mongoose.Schema.Types.ObjectId, ref: "ActivityRecord", required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    present: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("AttendanceEntry", attendanceEntrySchema);
