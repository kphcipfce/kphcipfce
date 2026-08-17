import Team from "../models/Team.js";
import Member from "../models/Member.js";
import { logAction } from "../middleware/audit.js";

export async function listTeams(req, res) {
  const teams = await Team.find({}).populate("memberIds", "name email phone");
  res.json(teams);
}

// FR-1.2a: a team is exactly two members, paired at creation time.
export async function createTeam(req, res) {
  const { name, memberIds } = req.body;
  if (!name || !Array.isArray(memberIds) || memberIds.length !== 2) {
    return res.status(400).json({ error: "name and exactly 2 social mobilizers required" });
  }
  const members = await Member.find({ _id: { $in: memberIds } });
  if (members.length !== 2) return res.status(400).json({ error: "One or both social mobilizers not found" });
  if (members.some((m) => m.role !== "member")) {
    return res.status(400).json({ error: "Only social mobilizers can be paired into a team" });
  }
  if (members.some((m) => m.team)) {
    return res.status(400).json({ error: "One or both social mobilizers already belong to a team" });
  }

  const team = await Team.create({ name, memberIds });
  await Member.updateMany({ _id: { $in: memberIds } }, { team: team._id });
  await logAction(req.user._id, "create", "Team", team._id, { name, memberIds });
  res.status(201).json(team);
}

export async function updateTeam(req, res) {
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ error: "Not found" });

  const { name, memberIds } = req.body;
  if (name !== undefined) team.name = name;

  if (memberIds !== undefined) {
    if (!Array.isArray(memberIds) || memberIds.length !== 2) {
      return res.status(400).json({ error: "Exactly 2 social mobilizers required" });
    }
    const members = await Member.find({ _id: { $in: memberIds } });
    if (members.length !== 2) return res.status(400).json({ error: "One or both social mobilizers not found" });
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
