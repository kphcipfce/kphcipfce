import mongoose from "mongoose";

const districtSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    adminIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }],
    // District Coordinators are now several accounts per district (managed in their own
    // "District Coordinators" Admin Panel tab, via the Member model's own district field),
    // not a single account tracked here — unlike the GRM Focal Person account below, which
    // stays one-per-district.
    // Same idea, for the district's GRM Focal Person account.
    grmFocalMember: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null },
    grmFocalPassword: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("District", districtSchema);
