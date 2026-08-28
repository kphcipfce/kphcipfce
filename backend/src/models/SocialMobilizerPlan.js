import mongoose from "mongoose";

const weekEntrySchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true },
  date: { type: Date, required: true },
  dayOfWeek: { type: String, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], required: true },
});

// Replaces the fixed 18-week auto-computed calendar (config/projectCalendar.js) — Super Admin
// now schedules social mobilizer field visits explicitly, same shape as CoordinatorPlan/GrmPlan,
// assigned to teams rather than districts since social mobilizers work in teams.
const socialMobilizerPlanSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    weeks: {
      type: [weekEntrySchema],
      validate: { validator: (v) => v.length > 0, message: "A plan needs at least one week" },
    },
    teams: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }],
      validate: { validator: (v) => v.length > 0, message: "A plan must be assigned to at least one team" },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("SocialMobilizerPlan", socialMobilizerPlanSchema);
