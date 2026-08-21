import mongoose from "mongoose";

const facilitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ["BHU", "RHC", "C", "D"], required: true },
    district: { type: mongoose.Schema.Types.ObjectId, ref: "District", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Facility", facilitySchema);
