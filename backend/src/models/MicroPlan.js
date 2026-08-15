import mongoose from "mongoose";

const weekEntrySchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true },
  date: { type: Date, required: true },
});

const microPlanSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    weeks: {
      type: [weekEntrySchema],
      validate: { validator: (v) => v.length > 0, message: "A micro plan needs at least one week" },
    },
    teams: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }],
      validate: { validator: (v) => v.length > 0, message: "A micro plan must be assigned to at least one team" },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("MicroPlan", microPlanSchema);
