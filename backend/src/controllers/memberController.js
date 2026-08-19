import bcrypt from "bcryptjs";
import Member from "../models/Member.js";
import Team from "../models/Team.js";
import { logAction } from "../middleware/audit.js";

// Super Admin accounts aren't manageable through this list — surfacing one here would let
// a super_admin accidentally deactivate themselves and lock everyone out of the system.
// district_viewer accounts are system-managed alongside their district (Districts tab), not here.
export async function listMembers(req, res) {
  const members = await Member.find({ role: { $nin: ["super_admin", "district_viewer"] } })
    .select("-passwordHash")
    .populate("team")
    .sort("name");
  res.json(members);
}

export async function createMember(req, res) {
  const { name, email, phone, password, gender, role = "member" } = req.body;
  if (!name || !email || !password || !gender) {
    return res.status(400).json({ error: "name, email, password, gender required" });
  }
  if (!["male", "female"].includes(gender)) {
    return res.status(400).json({ error: "gender must be male or female" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const member = await Member.create({ name, email: email.toLowerCase(), phone, passwordHash, gender, role });
  await logAction(req.user._id, "create", "Member", member._id, { name });
  res.status(201).json({ ...member.toObject(), passwordHash: undefined });
}

export async function updateMember(req, res) {
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ error: "Not found" });
  if (member.role === "super_admin" && req.body.active === false) {
    return res.status(400).json({ error: "A super_admin account cannot be deactivated" });
  }

  const { name, phone, role, active, password, gender } = req.body;
  if (name !== undefined) member.name = name;
  if (phone !== undefined) member.phone = phone;
  if (active !== undefined) member.active = active;
  if (role !== undefined) member.role = role;
  if (gender !== undefined) member.gender = gender;
  if (password) member.passwordHash = await bcrypt.hash(password, 10);

  await member.save();
  await logAction(req.user._id, "update", "Member", member._id, req.body);
  res.json({ ...member.toObject(), passwordHash: undefined });
}

// FR-2.7: a member's own "My Team" view — their teammate's name/contact.
export async function myTeam(req, res) {
  if (!req.user.team) return res.json({ team: null, teammate: null });
  const team = await Team.findById(req.user.team).populate("memberIds", "name email phone role");
  const teammate = team.memberIds.find((m) => String(m._id) !== String(req.user._id)) || null;
  res.json({ team: { id: team._id, name: team.name }, teammate });
}
