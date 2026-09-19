import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import Member from "./models/Member.js";

const PASSWORD = "12345";

async function ensureReviewers() {
  await connectDB();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const reviewers = [
    { name: "Mumtaz (TL Reviewer)", email: "mumtaztl@gmail.com" },
    { name: "Sanad (TL Reviewer)", email: "sanadtl@gmail.com" },
  ];

  for (const r of reviewers) {
    const existing = await Member.findOne({ email: r.email });
    if (!existing) {
      await Member.create({
        name: r.name,
        email: r.email,
        passwordHash,
        role: "tl_reviewer",
      });
      console.log(`Created TL reviewer: ${r.email}`);
    } else {
      console.log(`TL reviewer already exists: ${r.email}`);
    }
  }

  await mongoose.disconnect();
}

ensureReviewers().catch((err) => {
  console.error(err);
  process.exit(1);
});
