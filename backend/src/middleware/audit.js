import AuditLog from "../models/AuditLog.js";

export async function logAction(actorId, action, targetEntity, targetId, details = {}) {
  await AuditLog.create({ actor: actorId, action, targetEntity, targetId, details });
}
