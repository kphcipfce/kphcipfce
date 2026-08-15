import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import District from "./models/District.js";
import Team from "./models/Team.js";
import Member from "./models/Member.js";
import ActivityRecord from "./models/ActivityRecord.js";
import AttendanceEntry from "./models/AttendanceEntry.js";
import ImageMetadata from "./models/ImageMetadata.js";
import AuditLog from "./models/AuditLog.js";
import MicroPlan from "./models/MicroPlan.js";
import { attachDistrictViewer } from "./utils/districtViewer.js";

const PASSWORD = "12345";
const MEMBERS_BY_DISTRICT = {
  Nowshera: ["Ahmad", "Bilal"],
  Swabi: ["Fahad", "Zubair"],
  Haripur: ["Imran", "Kashif"],
  Peshawar: ["Usman", "Hamza"],
};

async function seed() {
  await connectDB();

  await Promise.all([
    ActivityRecord.deleteMany({}),
    AttendanceEntry.deleteMany({}),
    ImageMetadata.deleteMany({}),
    AuditLog.deleteMany({}),
    MicroPlan.deleteMany({}),
    Team.deleteMany({}),
    Member.deleteMany({}),
    District.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const districtNames = Object.keys(MEMBERS_BY_DISTRICT);

  // Districts still exist as the reference list a member picks from at submission time —
  // just no longer owned by any Team or Member. Each also gets its own read-only
  // district_viewer login, same as districts created through the admin panel.
  for (const name of districtNames) {
    const district = await District.create({ name });
    await attachDistrictViewer(district);
    await district.save();
    console.log(`${name} district_viewer password: ${district.viewerPassword}`);
  }

  await Member.create({
    name: "Super Admin",
    email: "super@gmail.com",
    passwordHash,
    role: "super_admin",
  });
  console.log(`super_admin: super@gmail.com`);

  for (const name of districtNames) {
    const [n1, n2] = MEMBERS_BY_DISTRICT[name];
    const m1 = await Member.create({
      name: n1,
      email: `${n1.toLowerCase()}@gmail.com`,
      passwordHash,
      role: "member",
    });
    const m2 = await Member.create({
      name: n2,
      email: `${n2.toLowerCase()}@gmail.com`,
      passwordHash,
      role: "member",
    });

    const team = await Team.create({
      name: `${name} Team`,
      memberIds: [m1._id, m2._id],
    });
    await Member.updateMany({ _id: { $in: [m1._id, m2._id] } }, { team: team._id });

    console.log(`${name}: members=${m1.email}, ${m2.email}`);
  }

  console.log(`\nSeed complete. Password for every account: ${PASSWORD}`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
