// Display names only — the stored role values (member, district_viewer, super_admin)
// stay as-is in the database and every role check; this just controls what's shown.
const ROLE_LABELS = {
  member: "Social Mobilizer",
  district_viewer: "District Coordinator",
  super_admin: "Super Admin",
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}
