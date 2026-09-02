import Team from "../models/Team.js";
import Member from "../models/Member.js";
import District from "../models/District.js";
import SocialMobilizerPlan from "../models/SocialMobilizerPlan.js";
import ActivityRecord from "../models/ActivityRecord.js";
import { logAction } from "../middleware/audit.js";

export async function listTeams(req, res) {
  const teams = await Team.find({}).populate("memberIds", "name email phone").populate("district", "name");
  res.json(teams);
}

// FR-1.2a: a team is normally two members, paired at creation time — but a second social
// mobilizer isn't always available, so 1 is also allowed.
export async function createTeam(req, res) {
  const { name, memberIds, district } = req.body;
  if (!name || !Array.isArray(memberIds) || memberIds.length < 1 || memberIds.length > 2) {
    return res.status(400).json({ error: "name and 1 or 2 social mobilizers required" });
  }
  if (!district) return res.status(400).json({ error: "district required" });
  const districtDoc = await District.findById(district);
  if (!districtDoc) return res.status(400).json({ error: "District not found" });

  const members = await Member.find({ _id: { $in: memberIds } });
  if (members.length !== memberIds.length) return res.status(400).json({ error: "One or more social mobilizers not found" });
  if (members.some((m) => m.role !== "member")) {
    return res.status(400).json({ error: "Only social mobilizers can be paired into a team" });
  }
  if (members.some((m) => m.team)) {
    return res.status(400).json({ error: "One or more social mobilizers already belong to a team" });
  }

  const team = await Team.create({ name, memberIds, district });
  await Member.updateMany({ _id: { $in: memberIds } }, { team: team._id });
  await logAction(req.user._id, "create", "Team", team._id, { name, memberIds, district });
  res.status(201).json(team);
}

export async function updateTeam(req, res) {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ error: "Not found" });

  const { name, memberIds, district } = req.body;
  if (name !== undefined) team.name = name;

  if (district !== undefined) {
    const districtDoc = await District.findById(district);
    if (!districtDoc) return res.status(400).json({ error: "District not found" });
    team.district = district;
  }

  if (memberIds !== undefined) {
    if (!Array.isArray(memberIds) || memberIds.length < 1 || memberIds.length > 2) {
      return res.status(400).json({ error: "1 or 2 social mobilizers required" });
    }
    const members = await Member.find({ _id: { $in: memberIds } });
    if (members.length !== memberIds.length) return res.status(400).json({ error: "One or more social mobilizers not found" });
    if (members.some((m) => m.role !== "member")) {
      return res.status(400).json({ error: "Only social mobilizers can be paired into a team" });
    }
    await Member.updateMany({ team: team._id }, { team: null });
    await Member.updateMany({ _id: { $in: memberIds } }, { team: team._id });
    team.memberIds = memberIds;
  }

  await team.save();
  await logAction(req.user._id, "update", "Team", team._id, req.body);
  res.json(team);
}

export async function deleteTeam(req, res) {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ error: "Not found" });

  const inPlan = await SocialMobilizerPlan.exists({ teams: team._id });
  if (inPlan) return res.status(400).json({ error: "Cannot delete a team assigned to a plan — remove the plan first" });

  const hasActivities = await ActivityRecord.exists({ team: team._id });
  if (hasActivities) return res.status(400).json({ error: "Cannot delete a team with activity records" });

  await Member.updateMany({ team: team._id }, { team: null });
  await team.deleteOne();
  await logAction(req.user._id, "delete", "Team", team._id, { name: team.name });
  res.status(204).end();
}
