import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import Member from "../models/Member.js";

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function generatePassword() {
  return crypto.randomBytes(6).toString("hex");
}

// Creates the read-only district_viewer account for a newly created district and
// stamps the district doc with the account's id + plaintext password (saved by caller).
export async function attachDistrictViewer(district) {
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const viewer = await Member.create({
    name: `${district.name} District Admin`,
    email: `${slugify(district.name)}@gmail.com`,
    passwordHash,
    role: "district_viewer",
    district: district._id,
  });
  district.viewerMember = viewer._id;
  district.viewerPassword = password;
}
