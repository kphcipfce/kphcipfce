import mongoose from "mongoose";

const districtSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    adminIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }],
    // The read-only district_viewer account auto-created alongside this district.
    // Password is kept in plaintext here (in addition to the Member's bcrypt hash)
    // specifically so a Super Admin can view/hand out these shared login credentials —
    // unlike regular member passwords, this is a deliberately viewable service credential.
    viewerMember: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null },
    viewerPassword: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("District", districtSchema);
