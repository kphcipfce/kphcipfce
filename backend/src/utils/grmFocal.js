import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import Member from "../models/Member.js";

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function generatePassword() {
  return crypto.randomBytes(6).toString("hex");
}

// Same pattern as attachDistrictViewer — creates the GRM Focal Person account for a newly
// created district and stamps the district doc with the account's id + plaintext password
// (saved by caller). Accepts an explicit password (seed.js uses a fixed simple one); defaults
// to a random one for districts created through the admin panel, matching the coordinator flow.
export async function attachGrmFocal(district, password = generatePassword()) {
  const passwordHash = await bcrypt.hash(password, 10);
  const focal = await Member.create({
    name: `${district.name} GRM Focal Person`,
    email: `${slugify(district.name)}grm@gmail.com`,
    passwordHash,
    role: "grm_focal",
    district: district._id,
  });
  district.grmFocalMember = focal._id;
  district.grmFocalPassword = password;
}
