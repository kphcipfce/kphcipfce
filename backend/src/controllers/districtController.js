import bcrypt from "bcryptjs";
import District from "../models/District.js";
import ActivityRecord from "../models/ActivityRecord.js";
import Member from "../models/Member.js";
import { logAction } from "../middleware/audit.js";
import { attachDistrictViewer } from "../utils/districtViewer.js";
import { attachGrmFocal } from "../utils/grmFocal.js";

// Viewer credentials (email/password) are only meaningful to a Super Admin managing
// them — stripped out for anyone else fetching the plain district list/dropdown.
export async function listDistricts(req, res) {
  const districts = await District.find({}).sort("name").populate("viewerMember", "email").populate("grmFocalMember", "email");
  if (req.user.role !== "super_admin") {
    return res.json(districts.map((d) => ({ _id: d._id, name: d.name })));
  }
  res.json(districts);
}

export async function createDistrict(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const district = await District.create({ name });
  await attachDistrictViewer(district);
  await attachGrmFocal(district);
  await district.save();
  await logAction(req.user._id, "create", "District", district._id, { name });
  await district.populate("viewerMember", "email");
  await district.populate("grmFocalMember", "email");
  res.status(201).json(district);
}

export async function updateDistrict(req, res) {
  const district = await District.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!district) return res.status(404).json({ error: "Not found" });
  await logAction(req.user._id, "update", "District", district._id, req.body);
  res.json(district);
}

export async function updateViewerPassword(req, res) {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "password required" });
  const district = await District.findById(req.params.id);
  if (!district || !district.viewerMember) return res.status(404).json({ error: "Not found" });

  const passwordHash = await bcrypt.hash(password, 10);
  await Member.findByIdAndUpdate(district.viewerMember, { passwordHash });
  district.viewerPassword = password;
  await district.save();
  await logAction(req.user._id, "update", "District", district._id, { viewerPasswordChanged: true });
  res.json({ viewerPassword: district.viewerPassword });
}

export async function updateGrmFocalPassword(req, res) {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "password required" });
  const district = await District.findById(req.params.id);
  if (!district || !district.grmFocalMember) return res.status(404).json({ error: "Not found" });

  const passwordHash = await bcrypt.hash(password, 10);
  await Member.findByIdAndUpdate(district.grmFocalMember, { passwordHash });
  district.grmFocalPassword = password;
  await district.save();
  await logAction(req.user._id, "update", "District", district._id, { grmFocalPasswordChanged: true });
  res.json({ grmFocalPassword: district.grmFocalPassword });
}

export async function deleteDistrict(req, res) {
  const district = await District.findById(req.params.id);
  if (!district) return res.status(404).json({ error: "Not found" });

  const inUse = await ActivityRecord.exists({ district: district._id });
  if (inUse) return res.status(400).json({ error: "Cannot delete a district that has activity records referencing it" });

  if (district.viewerMember) await Member.findByIdAndDelete(district.viewerMember);
  if (district.grmFocalMember) await Member.findByIdAndDelete(district.grmFocalMember);
  await district.deleteOne();
  await logAction(req.user._id, "delete", "District", district._id, { name: district.name });
  res.status(204).end();
}
