import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Member from "../models/Member.js";

function signToken(member) {
  return jwt.sign({ id: member._id, role: member.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

function publicMember(member) {
  const { _id, name, email, phone, role, district, team } = member;
  return { id: _id, name, email, phone, role, district, team };
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const member = await Member.findOne({ email: email.toLowerCase() });
  if (!member || !member.active) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await member.comparePassword(password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  res.json({ token: signToken(member), user: publicMember(member) });
}

export async function me(req, res) {
  res.json({ user: publicMember(req.user) });
}

// Bootstraps the very first super_admin when no members exist yet. Locked out afterwards.
export async function bootstrapSuperAdmin(req, res) {
  const anyMember = await Member.findOne({});
  if (anyMember) return res.status(403).json({ error: "Bootstrap already completed" });

  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "name, email, password required" });

  const passwordHash = await bcrypt.hash(password, 10);
  const member = await Member.create({
    name,
    email: email.toLowerCase(),
    phone,
    passwordHash,
    role: "super_admin",
  });

  res.status(201).json({ token: signToken(member), user: publicMember(member) });
}
