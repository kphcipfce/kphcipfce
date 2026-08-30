import mongoose from "mongoose";

const weekEntrySchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true },
  date: { type: Date, required: true },
  dayOfWeek: { type: String, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], required: true },
});

// Same shape as the removed MicroPlan, but scheduling District Coordinator trainings
// (Environmental awareness & HCWM / SEA-SH) instead of social mobilizer field visits —
// assigned to specific coordinator accounts, not whole districts, since each district now has
// several coordinators (4, as of this change) rather than exactly one.
const coordinatorPlanSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    weeks: {
      type: [weekEntrySchema],
      validate: { validator: (v) => v.length > 0, message: "A plan needs at least one week" },
    },
    coordinators: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }],
      validate: { validator: (v) => v.length > 0, message: "A plan must be assigned to at least one coordinator" },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("CoordinatorPlan", coordinatorPlanSchema);
