import mongoose from "mongoose";

const weekEntrySchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true },
  date: { type: Date, required: true },
});

// Same shape as the removed MicroPlan, but scheduling District Coordinator trainings
// (Environmental awareness & HCWM / SEA-SH) instead of social mobilizer field visits —
// assigned to districts rather than teams, since each district has exactly one coordinator.
const coordinatorPlanSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    weeks: {
      type: [weekEntrySchema],
      validate: { validator: (v) => v.length > 0, message: "A plan needs at least one week" },
    },
    districts: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "District" }],
      validate: { validator: (v) => v.length > 0, message: "A plan must be assigned to at least one district" },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("CoordinatorPlan", coordinatorPlanSchema);
