import bcrypt from "bcryptjs";
import District from "../models/District.js";
import ActivityRecord from "../models/ActivityRecord.js";
import Member from "../models/Member.js";
import { logAction } from "../middleware/audit.js";
import { attachGrmFocal } from "../utils/grmFocal.js";

// Viewer credentials (email/password) are only meaningful to a Super Admin managing
// them — stripped out for anyone else fetching the plain district list/dropdown. District
// Coordinators aren't tracked here anymore (see districtCoordinatorController.js) — only the
// GRM Focal Person account stays one-per-district.
export async function listDistricts(req, res) {
  const districts = await District.find({}).sort("name").populate("grmFocalMember", "email");
  if (req.user.role !== "super_admin") {
    return res.json(districts.map((d) => ({ _id: d._id, name: d.name })));
  }
  res.json(districts);
}

export async function createDistrict(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const district = await District.create({ name });
  await attachGrmFocal(district);
  await district.save();
  await logAction(req.user._id, "create", "District", district._id, { name });
  await district.populate("grmFocalMember", "email");
  res.status(201).json(district);
}

export async function updateDistrict(req, res) {
  const district = await District.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!district) return res.status(404).json({ error: "Not found" });
  await logAction(req.user._id, "update", "District", district._id, req.body);
  res.json(district);
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

  // District Coordinators are several per-district accounts now, found by their own district
  // field rather than a single reference on the district itself.
  await Member.deleteMany({ role: "district_viewer", district: district._id });
  if (district.grmFocalMember) await Member.findByIdAndDelete(district.grmFocalMember);
  await district.deleteOne();
  await logAction(req.user._id, "delete", "District", district._id, { name: district.name });
  res.status(204).end();
}
