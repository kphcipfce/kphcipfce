import bcrypt from "bcryptjs";
import Member from "../models/Member.js";
import { logAction } from "../middleware/audit.js";

// Executive accounts are full standalone logins like super_admin (no team, no district scope —
// they see every district on the Executive Dashboard), but restricted to that read-only view
// rather than the full Admin Panel. Kept in their own small management surface rather than
// mixed into the Social Mobilizers tab, same reasoning as why super_admin accounts aren't
// listed there either.
export async function listExecutives(req, res) {
  const executives = await Member.find({ role: "executive" }).select("-passwordHash").sort("name");
  res.json(executives);
}

export async function createExecutive(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, password required" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const executive = await Member.create({ name, email: email.toLowerCase(), passwordHash, role: "executive" });
  await logAction(req.user._id, "create", "Member", executive._id, { name, role: "executive" });
  res.status(201).json({ ...executive.toObject(), passwordHash: undefined });
}

export async function updateExecutive(req, res) {
  const executive = await Member.findOne({ _id: req.params.id, role: "executive" });
  if (!executive) return res.status(404).json({ error: "Not found" });

  const { name, active, password } = req.body;
  if (name !== undefined) executive.name = name;
  if (active !== undefined) executive.active = active;
  if (password) executive.passwordHash = await bcrypt.hash(password, 10);

  await executive.save();
  await logAction(req.user._id, "update", "Member", executive._id, req.body);
  res.json({ ...executive.toObject(), passwordHash: undefined });
}
