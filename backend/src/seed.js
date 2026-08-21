import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import District from "./models/District.js";
import Team from "./models/Team.js";
import Member from "./models/Member.js";
import Facility from "./models/Facility.js";
import ActivityRecord from "./models/ActivityRecord.js";
import AttendanceEntry from "./models/AttendanceEntry.js";
import ImageMetadata from "./models/ImageMetadata.js";
import AuditLog from "./models/AuditLog.js";
import CoordinatorPlan from "./models/CoordinatorPlan.js";
import CoordinatorActivityRecord from "./models/CoordinatorActivityRecord.js";
import GrmPlan from "./models/GrmPlan.js";
import GrmActivityRecord from "./models/GrmActivityRecord.js";
import { attachDistrictViewer } from "./utils/districtViewer.js";
import { FACILITIES_BY_DISTRICT } from "./data/facilities.js";

const PASSWORD = "12345";
const SUPER_ADMIN_PASSWORD = "88888888";
// One male + one female per team — 4 of each across the 4 districts.
const MEMBERS_BY_DISTRICT = {
  Nowshera: [
    { name: "Ahmad", gender: "male" },
    { name: "Ayesha", gender: "female" },
  ],
  Swabi: [
    { name: "Fahad", gender: "male" },
    { name: "Sana", gender: "female" },
  ],
  Haripur: [
    { name: "Imran", gender: "male" },
    { name: "Hina", gender: "female" },
  ],
  Peshawar: [
    { name: "Usman", gender: "male" },
    { name: "Mehwish", gender: "female" },
  ],
};

async function seed() {
  await connectDB();

  await Promise.all([
    ActivityRecord.deleteMany({}),
    AttendanceEntry.deleteMany({}),
    ImageMetadata.deleteMany({}),
    AuditLog.deleteMany({}),
    CoordinatorPlan.deleteMany({}),
    CoordinatorActivityRecord.deleteMany({}),
    GrmPlan.deleteMany({}),
    GrmActivityRecord.deleteMany({}),
    Facility.deleteMany({}),
    Team.deleteMany({}),
    Member.deleteMany({}),
    District.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const districtNames = Object.keys(MEMBERS_BY_DISTRICT);

  // Each district also gets its own read-only district_viewer login, same as districts
  // created through the admin panel.
  const districtIdByName = {};
  for (const name of districtNames) {
    const district = await District.create({ name });
    districtIdByName[name] = district._id;
    await attachDistrictViewer(district);
    await district.save();
    console.log(`${name} district_viewer password: ${district.viewerPassword}`);
  }

  // One GRM Focal Person account per district, same simple password as social mobilizers
  // (unlike district_viewer's auto-generated one) — 4 accounts total. Also stamped onto the
  // District doc (grmFocalMember/grmFocalPassword) so the admin panel's password viewer
  // works the same way it does for district_viewer.
  for (const name of districtNames) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const email = `${slug}grm@gmail.com`;
    const focal = await Member.create({
      name: `${name} GRM Focal Person`,
      email,
      passwordHash,
      role: "grm_focal",
      district: districtIdByName[name],
    });
    await District.findByIdAndUpdate(districtIdByName[name], { grmFocalMember: focal._id, grmFocalPassword: PASSWORD });
    console.log(`${name} grm_focal: ${email}`);
  }

  let facilityCount = 0;
  for (const name of districtNames) {
    const facilities = (FACILITIES_BY_DISTRICT[name] || []).map(([facilityName, category]) => ({
      name: facilityName,
      category,
      district: districtIdByName[name],
    }));
    await Facility.insertMany(facilities);
    facilityCount += facilities.length;
  }
  console.log(`Facilities seeded: ${facilityCount}`);

  await Member.create({
    name: "Super Admin",
    email: "super@gmail.com",
    passwordHash: await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10),
    role: "super_admin",
  });
  console.log(`super_admin: super@gmail.com / ${SUPER_ADMIN_PASSWORD}`);

  for (const name of districtNames) {
    const [p1, p2] = MEMBERS_BY_DISTRICT[name];
    const m1 = await Member.create({
      name: p1.name,
      email: `${p1.name.toLowerCase()}@gmail.com`,
      passwordHash,
      gender: p1.gender,
      role: "member",
    });
    const m2 = await Member.create({
      name: p2.name,
      email: `${p2.name.toLowerCase()}@gmail.com`,
      passwordHash,
      gender: p2.gender,
      role: "member",
    });

    const team = await Team.create({
      name: `${name} Team`,
      memberIds: [m1._id, m2._id],
      district: districtIdByName[name],
    });
    await Member.updateMany(
      { _id: { $in: [m1._id, m2._id] } },
      { team: team._id },
    );

    console.log(`${name}: members=${m1.email}, ${m2.email}`);
  }

  console.log(
    `\nSeed complete. Social mobilizer password: ${PASSWORD}. Super admin password: ${SUPER_ADMIN_PASSWORD}.`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
