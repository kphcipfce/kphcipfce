import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    // Plaintext mirror of passwordHash, same pattern as District.grmFocalPassword — lets the
    // Admin Panel show a social mobilizer's current password again, not just set a new one.
    password: { type: String, default: null },
    role: { type: String, enum: ["member", "super_admin", "district_viewer", "grm_focal", "executive"], default: "member" },
    gender: { type: String, enum: ["male", "female"], default: null },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    // Only set for district_viewer/grm_focal accounts — scopes them to one district.
    district: { type: mongoose.Schema.Types.ObjectId, ref: "District", default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

memberSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

export default mongoose.model("Member", memberSchema);
