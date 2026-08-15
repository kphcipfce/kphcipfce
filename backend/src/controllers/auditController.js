import AuditLog from "../models/AuditLog.js";

// FR-5.5: Super Admin sees the full audit trail.
export async function listAuditLogs(req, res) {
  const logs = await AuditLog.find({}).populate("actor", "name role").sort("-createdAt").limit(500);
  res.json(logs);
}
