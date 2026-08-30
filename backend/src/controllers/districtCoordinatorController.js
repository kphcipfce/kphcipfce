import bcrypt from "bcryptjs";
import Member from "../models/Member.js";
import { logAction } from "../middleware/audit.js";

// District Coordinators are now several accounts per district (not the old one-per-district
// design), so they get the same kind of dedicated management surface as Executive Officials —
// listed/created/updated here rather than folded into the Districts tab's old single-slot
// viewer-password fields.
export async function listDistrictCoordinators(req, res) {
  const coordinators = await Member.find({ role: "district_viewer" }).select("-passwordHash").populate("district", "name").sort("name");
  res.json(coordinators);
}

export async function createDistrictCoordinator(req, res) {
  const { name, email, password, district } = req.body;
  if (!name || !email || !password || !district) {
    return res.status(400).json({ error: "name, email, password, district required" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const coordinator = await Member.create({ name, email: email.toLowerCase(), passwordHash, role: "district_viewer", district });
  await logAction(req.user._id, "create", "Member", coordinator._id, { name, role: "district_viewer", district });
  res.status(201).json({ ...coordinator.toObject(), passwordHash: undefined });
}

export async function updateDistrictCoordinator(req, res) {
  const coordinator = await Member.findOne({ _id: req.params.id, role: "district_viewer" });
  if (!coordinator) return res.status(404).json({ error: "Not found" });

  const { name, active, password } = req.body;
  if (name !== undefined) coordinator.name = name;
  if (active !== undefined) coordinator.active = active;
  if (password) coordinator.passwordHash = await bcrypt.hash(password, 10);

  await coordinator.save();
  await logAction(req.user._id, "update", "Member", coordinator._id, req.body);
  res.json({ ...coordinator.toObject(), passwordHash: undefined });
}
