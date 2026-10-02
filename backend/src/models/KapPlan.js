import mongoose from "mongoose";

const weekEntrySchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true },
  date: { type: Date, required: true },
  dayOfWeek: { type: String, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], required: true },
});

const kapPlanSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    weeks: {
      type: [weekEntrySchema],
      validate: { validator: (v) => v.length > 0, message: "A KAP plan needs at least one week" },
    },
    district: { type: mongoose.Schema.Types.ObjectId, ref: "District", required: true },
    targetRole: { type: String, enum: ["member", "district_viewer"], required: true, default: "member" },
    targetMobilizer: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null },
    coordinator: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("KapPlan", kapPlanSchema);
