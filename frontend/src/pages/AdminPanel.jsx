import { useEffect, useState } from "react";
import { MdCancel } from "react-icons/md";
import api from "../api/client";
import { useToast } from "../context/ToastContext";
import Spinner from "../components/Spinner";
import { EyeIcon, EyeOffIcon } from "../components/icons";
import { roleLabel } from "../utils/roleLabel";

const TABS = [
  "Social Mobilizers",
  "Teams",
  "Districts",
  "District Coordinators",
  "Mobilizer Plans",
  "Coordinator Plans",
  "GRM Plans",
  "Executive Officials",
  "Overview",
  "Audit Log",
];

export default function AdminPanel() {
  const [tab, setTab] = useState(TABS[0]);

  return (
    <div className="page">
      <h1>Admin</h1>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? "tab active" : "tab"} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Social Mobilizers" && <MembersTab />}
      {tab === "Teams" && <TeamsTab />}
      {tab === "Districts" && <DistrictsTab />}
      {tab === "District Coordinators" && <DistrictCoordinatorsTab />}
      {tab === "Mobilizer Plans" && <MobilizerPlansTab />}
      {tab === "Coordinator Plans" && <CoordinatorPlansTab />}
      {tab === "GRM Plans" && <GrmPlansTab />}
      {tab === "Executive Officials" && <ExecutiveOfficialsTab />}
      {tab === "Overview" && <OverviewTab />}
      {tab === "Audit Log" && <AuditLogTab />}
    </div>
  );
}

function MembersTab() {
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", gender: "" });
  const [editingPasswordId, setEditingPasswordId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  function load() {
    api.get("/members").then((res) => setMembers(res.data));
  }
  useEffect(load, []);

  async function createMember(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/members", { ...form, role: "member" });
      setForm({ ...form, name: "", email: "", phone: "", password: "", gender: "" });
      showToast("success", "Social Mobilizer created", "The new social mobilizer can now sign in with their password.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create social mobilizer");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(m) {
    if (m.active && !confirm(`Deactivate ${m.name}? They won't be able to sign in until reactivated.`)) return;
    await api.patch(`/members/${m._id}`, { active: !m.active });
    load();
  }

  function togglePasswordEdit(id) {
    setNewPassword("");
    setEditingPasswordId((current) => (current === id ? null : id));
  }

  async function savePassword(id) {
    if (!newPassword) return showToast("error", "Enter a new password");
    setSavingPassword(true);
    try {
      await api.patch(`/members/${id}`, { password: newPassword });
      setEditingPasswordId(null);
      setNewPassword("");
      showToast("success", "Password updated", "The social mobilizer can sign in with the new password.");
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div>
      <form className="card inline-form" onSubmit={createMember}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} required>
          <option value="">Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <button type="submit" disabled={creating} className={creating ? "btn-loading" : ""}>
          <span className="btn-label">Add Social Mobilizer</span>
          {creating && <span className="btn-spinner" />}
        </button>
      </form>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Gender</th>
              <th>Role</th>
              <th>Team</th>
              <th>Password</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m._id}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>{m.gender ? m.gender[0].toUpperCase() + m.gender.slice(1) : "—"}</td>
                <td>{roleLabel(m.role)}</td>
                <td>{m.team?.name || "—"}</td>
                <td>
                  {editingPasswordId === m._id ? (
                    <div className="password-edit">
                      <input
                        type="password"
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={savingPassword}
                        className={savingPassword ? "btn-loading" : ""}
                        onClick={() => savePassword(m._id)}
                      >
                        <span className="btn-label">Save</span>
                        {savingPassword && <span className="btn-spinner" />}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => togglePasswordEdit(m._id)}
                        aria-label={`Close password editor for ${m.name}`}
                      >
                        <EyeOffIcon />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => togglePasswordEdit(m._id)}
                      aria-label={`Edit ${m.name}'s password`}
                    >
                      <EyeIcon />
                    </button>
                  )}
                </td>
                <td>
                  <button className={m.active ? "btn-deactivate" : "btn-activate"} onClick={() => toggleActive(m)}>
                    {m.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Executive accounts are full standalone logins like super_admin (no team, no gender, no
// district scope — they see every district on the Executive Dashboard), so this mirrors
// MembersTab's create/password-edit/deactivate pattern but without the fields that don't apply.
function ExecutiveOfficialsTab() {
  const { showToast } = useToast();
  const [executives, setExecutives] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [editingPasswordId, setEditingPasswordId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  function load() {
    api.get("/executives").then((res) => setExecutives(res.data));
  }
  useEffect(load, []);

  async function createExecutive(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/executives", form);
      setForm({ name: "", email: "", password: "" });
      showToast("success", "Executive official created", "They can now sign in with their password.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create executive official");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(m) {
    if (m.active && !confirm(`Deactivate ${m.name}? They won't be able to sign in until reactivated.`)) return;
    await api.patch(`/executives/${m._id}`, { active: !m.active });
    load();
  }

  function togglePasswordEdit(id) {
    setNewPassword("");
    setEditingPasswordId((current) => (current === id ? null : id));
  }

  async function savePassword(id) {
    if (!newPassword) return showToast("error", "Enter a new password");
    setSavingPassword(true);
    try {
      await api.patch(`/executives/${id}`, { password: newPassword });
      setEditingPasswordId(null);
      setNewPassword("");
      showToast("success", "Password updated", "The executive official can sign in with the new password.");
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div>
      <form className="card inline-form" onSubmit={createExecutive}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <button type="submit" disabled={creating} className={creating ? "btn-loading" : ""}>
          <span className="btn-label">Add Executive Official</span>
          {creating && <span className="btn-spinner" />}
        </button>
      </form>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Password</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {executives.map((m) => (
              <tr key={m._id}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>
                  {editingPasswordId === m._id ? (
                    <div className="password-edit">
                      <input
                        type="password"
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={savingPassword}
                        className={savingPassword ? "btn-loading" : ""}
                        onClick={() => savePassword(m._id)}
                      >
                        <span className="btn-label">Save</span>
                        {savingPassword && <span className="btn-spinner" />}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => togglePasswordEdit(m._id)}
                        aria-label={`Close password editor for ${m.name}`}
                      >
                        <EyeOffIcon />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => togglePasswordEdit(m._id)}
                      aria-label={`Edit ${m.name}'s password`}
                    >
                      <EyeIcon />
                    </button>
                  )}
                </td>
                <td>
                  <button className={m.active ? "btn-deactivate" : "btn-activate"} onClick={() => toggleActive(m)}>
                    {m.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// District Coordinators are now several accounts per district (4, seeded), so this mirrors
// ExecutiveOfficialsTab's create/password-edit/deactivate pattern but with a required district
// picker, and lists every coordinator across every district (not scoped to one).
function DistrictCoordinatorsTab() {
  const { showToast } = useToast();
  const [coordinators, setCoordinators] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", district: "" });
  const [editingPasswordId, setEditingPasswordId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  function load() {
    api.get("/district-coordinators").then((res) => setCoordinators(res.data));
    api.get("/districts").then((res) => setDistricts(res.data));
  }
  useEffect(load, []);

  async function createCoordinator(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/district-coordinators", form);
      setForm({ name: "", email: "", password: "", district: "" });
      showToast("success", "District Coordinator created", "They can now sign in with their password.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create district coordinator");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(m) {
    if (m.active && !confirm(`Deactivate ${m.name}? They won't be able to sign in until reactivated.`)) return;
    await api.patch(`/district-coordinators/${m._id}`, { active: !m.active });
    load();
  }

  function togglePasswordEdit(id) {
    setNewPassword("");
    setEditingPasswordId((current) => (current === id ? null : id));
  }

  async function savePassword(id) {
    if (!newPassword) return showToast("error", "Enter a new password");
    setSavingPassword(true);
    try {
      await api.patch(`/district-coordinators/${id}`, { password: newPassword });
      setEditingPasswordId(null);
      setNewPassword("");
      showToast("success", "Password updated", "The district coordinator can sign in with the new password.");
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div>
      <form className="card inline-form" onSubmit={createCoordinator}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required>
          <option value="">District</option>
          {districts.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={creating} className={creating ? "btn-loading" : ""}>
          <span className="btn-label">Add District Coordinator</span>
          {creating && <span className="btn-spinner" />}
        </button>
      </form>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>District</th>
              <th>Password</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {coordinators.map((m) => (
              <tr key={m._id}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>{m.district?.name || "—"}</td>
                <td>
                  {editingPasswordId === m._id ? (
                    <div className="password-edit">
                      <input
                        type="password"
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={savingPassword}
                        className={savingPassword ? "btn-loading" : ""}
                        onClick={() => savePassword(m._id)}
                      >
                        <span className="btn-label">Save</span>
                        {savingPassword && <span className="btn-spinner" />}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => togglePasswordEdit(m._id)}
                        aria-label={`Close password editor for ${m.name}`}
                      >
                        <EyeOffIcon />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => togglePasswordEdit(m._id)}
                      aria-label={`Edit ${m.name}'s password`}
                    >
                      <EyeIcon />
                    </button>
                  )}
                </td>
                <td>
                  <button className={m.active ? "btn-deactivate" : "btn-activate"} onClick={() => toggleActive(m)}>
                    {m.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamsTab() {
  const { showToast } = useToast();
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [form, setForm] = useState({ name: "", memberA: "", memberB: "", district: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ memberA: "", memberB: "", district: "" });
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  function load() {
    api.get("/teams").then((res) => setTeams(res.data));
    api.get("/members").then((res) => setMembers(res.data));
    api.get("/districts").then((res) => setDistricts(res.data));
  }
  useEffect(load, []);

  // A member has no district of their own until paired — any unteamed member can join
  // any team, and the team's district gets assigned to them at that point (server-side).
  const unassigned = members.filter((m) => !m.team && m.role === "member");
  // Reassignment can pull in any member, including one currently on another team.
  const eligibleMembers = members.filter((m) => m.role === "member");

  async function createTeam(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/teams", { name: form.name, memberIds: [form.memberA, form.memberB], district: form.district });
      setForm({ ...form, name: "", memberA: "", memberB: "", district: "" });
      showToast("success", "Team created", "The team is ready to submit activities.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create team");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(t) {
    setEditingId(t._id);
    setEditForm({ memberA: t.memberIds[0]._id, memberB: t.memberIds[1]._id, district: t.district?._id || "" });
  }

  async function saveEdit(t) {
    setSavingEdit(true);
    try {
      await api.patch(`/teams/${t._id}`, { memberIds: [editForm.memberA, editForm.memberB], district: editForm.district });
      setEditingId(null);
      showToast("success", "Team updated", "Membership changes saved.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to update team");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div>
      <form className="card inline-form" onSubmit={createTeam}>
        <input placeholder="Team name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select value={form.memberA} onChange={(e) => setForm({ ...form, memberA: e.target.value })} required>
          <option value="">Social Mobilizer 1</option>
          {unassigned
            .filter((m) => m._id !== form.memberB)
            .map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
        </select>
        <select value={form.memberB} onChange={(e) => setForm({ ...form, memberB: e.target.value })} required>
          <option value="">Social Mobilizer 2</option>
          {unassigned
            .filter((m) => m._id !== form.memberA)
            .map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
        </select>
        <select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required>
          <option value="">District</option>
          {districts.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={creating} className={creating ? "btn-loading" : ""}>
          <span className="btn-label">Create team</span>
          {creating && <span className="btn-spinner" />}
        </button>
      </form>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Team</th>
              <th>District</th>
              <th>Social Mobilizers</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
                <tr key={t._id}>
                  <td>{t.name}</td>
                  <td>
                    {editingId === t._id ? (
                      <select value={editForm.district} onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}>
                        {districts.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      t.district?.name || "—"
                    )}
                  </td>
                  <td>
                    {editingId === t._id ? (
                      <div className="inline-form">
                        <select value={editForm.memberA} onChange={(e) => setEditForm({ ...editForm, memberA: e.target.value })}>
                          {eligibleMembers
                            .filter((m) => m._id !== editForm.memberB)
                            .map((m) => (
                              <option key={m._id} value={m._id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                        <select value={editForm.memberB} onChange={(e) => setEditForm({ ...editForm, memberB: e.target.value })}>
                          {eligibleMembers
                            .filter((m) => m._id !== editForm.memberA)
                            .map((m) => (
                              <option key={m._id} value={m._id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : (
                      t.memberIds.map((m) => m.name).join(" & ")
                    )}
                  </td>
                  <td>
                    {editingId === t._id ? (
                      <>
                        <button disabled={savingEdit} className={savingEdit ? "btn-loading" : ""} onClick={() => saveEdit(t)}>
                          <span className="btn-label">Save</span>
                          {savingEdit && <span className="btn-spinner" />}
                        </button>{" "}
                        <button disabled={savingEdit} onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(t)}>Edit</button>
                    )}
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DistrictsTab() {
  const { showToast } = useToast();
  const [districts, setDistricts] = useState([]);
  const [name, setName] = useState("");
  const [openGrmId, setOpenGrmId] = useState(null);
  const [grmFocalPassword, setGrmFocalPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [savingGrmFocalPassword, setSavingGrmFocalPassword] = useState(false);

  function load() {
    api.get("/districts").then((res) => setDistricts(res.data));
  }
  useEffect(load, []);

  async function createDistrict(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/districts", { name });
      setName("");
      showToast("success", "District created", "A GRM Focal Person login was generated automatically — add District Coordinators from the District Coordinators tab.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create district");
    } finally {
      setCreating(false);
    }
  }

  async function removeDistrict(id, name) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    setRemovingId(id);
    try {
      await api.delete(`/districts/${id}`);
      showToast("success", "District removed");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to delete district");
    } finally {
      setRemovingId(null);
    }
  }

  function toggleGrmFocal(d) {
    setOpenGrmId((current) => {
      if (current === d._id) return null;
      setGrmFocalPassword(d.grmFocalPassword || "");
      return d._id;
    });
  }

  async function saveGrmFocalPassword(id) {
    if (!grmFocalPassword) return showToast("error", "Enter a password");
    setSavingGrmFocalPassword(true);
    try {
      await api.patch(`/districts/${id}/grm-focal-password`, { password: grmFocalPassword });
      setOpenGrmId(null);
      showToast("success", "GRM focal password updated", "Share the new password with the GRM focal person.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to update password");
    } finally {
      setSavingGrmFocalPassword(false);
    }
  }

  return (
    <div>
      <form className="card inline-form" onSubmit={createDistrict}>
        <input placeholder="District name" value={name} onChange={(e) => setName(e.target.value)} required />
        <button type="submit" disabled={creating} className={creating ? "btn-loading" : ""}>
          <span className="btn-label">Add district</span>
          {creating && <span className="btn-spinner" />}
        </button>
      </form>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>GRM Focal Person Login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {districts.map((d) => (
              <tr key={d._id}>
                <td>{d.name}</td>
                <td>
                  {openGrmId === d._id ? (
                    <div className="password-edit">
                      <span>{d.grmFocalMember?.email}</span>
                      <input type="text" value={grmFocalPassword} onChange={(e) => setGrmFocalPassword(e.target.value)} autoFocus />
                      <button
                        type="button"
                        disabled={savingGrmFocalPassword}
                        className={savingGrmFocalPassword ? "btn-loading" : ""}
                        onClick={() => saveGrmFocalPassword(d._id)}
                      >
                        <span className="btn-label">Save</span>
                        {savingGrmFocalPassword && <span className="btn-spinner" />}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => toggleGrmFocal(d)}
                        aria-label={`Close GRM focal login for ${d.name}`}
                      >
                        <EyeOffIcon />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="icon-btn" onClick={() => toggleGrmFocal(d)} aria-label={`Show GRM focal login for ${d.name}`}>
                      <EyeIcon />
                    </button>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    disabled={removingId === d._id}
                    className={`btn-delete-icon ${removingId === d._id ? "btn-loading" : ""}`}
                    onClick={() => removeDistrict(d._id, d.name)}
                    aria-label={`Remove ${d.name}`}
                  >
                    <span className="btn-label">
                      <MdCancel />
                    </span>
                    {removingId === d._id && <span className="btn-spinner" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_NUMBERS = Array.from({ length: 18 }, (_, i) => i + 1);

function emptyWeek() {
  return { weekNumber: "", date: "", dayOfWeek: "" };
}

function MobilizerPlansTab() {
  const { showToast } = useToast();
  const now = new Date();
  const [plans, setPlans] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    weeks: [emptyWeek(), emptyWeek(), emptyWeek(), emptyWeek()],
    teamIds: [],
  });
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  function load() {
    api.get("/mobilizer-plans").then((res) => setPlans(res.data));
    api.get("/teams").then((res) => setTeams(res.data));
  }
  useEffect(load, []);

  function updateWeek(i, field, value) {
    setForm((f) => ({ ...f, weeks: f.weeks.map((w, idx) => (idx === i ? { ...w, [field]: value } : w)) }));
  }

  function addWeek() {
    setForm((f) => ({ ...f, weeks: [...f.weeks, emptyWeek()] }));
  }

  function removeWeek(i) {
    setForm((f) => ({ ...f, weeks: f.weeks.filter((_, idx) => idx !== i) }));
  }

  async function createPlan(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/mobilizer-plans", {
        month: Number(form.month),
        year: Number(form.year),
        weeks: form.weeks,
        teams: form.teamIds,
      });
      setForm({ month: now.getMonth() + 1, year: now.getFullYear(), weeks: [emptyWeek(), emptyWeek(), emptyWeek(), emptyWeek()], teamIds: [] });
      showToast("success", "Plan created", "Assigned teams can now submit against these weeks.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create plan");
    } finally {
      setCreating(false);
    }
  }

  async function removePlan(id, label) {
    if (!confirm(`Delete the ${label} plan? This cannot be undone.`)) return;
    setRemovingId(id);
    try {
      await api.delete(`/mobilizer-plans/${id}`);
      showToast("success", "Plan removed");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to delete plan");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <form className="card" onSubmit={createPlan}>
        <div className="date-time-row">
          <label>
            Month
            <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required />
          </label>
        </div>

        <fieldset>
          <legend>Weeks</legend>
          {form.weeks.map((w, i) => (
            <div className="date-time-row" key={i}>
              <label>
                Week
                <select value={w.weekNumber} onChange={(e) => updateWeek(i, "weekNumber", e.target.value)} required>
                  <option value="" disabled>
                    Select week
                  </option>
                  {WEEK_NUMBERS.map((n) => (
                    <option key={n} value={n}>
                      Week {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input type="date" value={w.date} onChange={(e) => updateWeek(i, "date", e.target.value)} required />
              </label>
              <label>
                Day
                <select value={w.dayOfWeek} onChange={(e) => updateWeek(i, "dayOfWeek", e.target.value)} required>
                  <option value="" disabled>
                    Select day
                  </option>
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              {form.weeks.length > 1 && (
                <button type="button" className="btn-delete-icon" onClick={() => removeWeek(i)} aria-label="Remove week">
                  <MdCancel />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addWeek}>
            + Add week
          </button>
        </fieldset>

        <label>
          Assign to teams
          <select
            multiple
            value={form.teamIds}
            onChange={(e) => setForm({ ...form, teamIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
            required
          >
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name} ({t.district?.name})
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={creating} className={creating ? "btn-loading" : ""}>
          <span className="btn-label">Create plan</span>
          {creating && <span className="btn-spinner" />}
        </button>
      </form>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Month/Year</th>
              <th>Assigned Teams</th>
              <th>Weeks</th>
              <th>Created By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p._id}>
                <td>
                  {MONTH_NAMES[p.month - 1]} {p.year}
                </td>
                <td>{p.teams.map((t) => t.name).join(" & ")}</td>
                <td>
                  {p.weeks.map((w) => (
                    <div key={w._id}>
                      Week {w.weekNumber}: {new Date(w.date).toLocaleDateString("en-GB")} ({w.dayOfWeek})
                    </div>
                  ))}
                </td>
                <td>{p.createdBy?.name}</td>
                <td>
                  <button
                    type="button"
                    disabled={removingId === p._id}
                    className={`btn-delete-icon ${removingId === p._id ? "btn-loading" : ""}`}
                    onClick={() => removePlan(p._id, `${MONTH_NAMES[p.month - 1]} ${p.year}`)}
                    aria-label={`Remove ${MONTH_NAMES[p.month - 1]} ${p.year} plan`}
                  >
                    <span className="btn-label">
                      <MdCancel />
                    </span>
                    {removingId === p._id && <span className="btn-spinner" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoordinatorPlansTab() {
  const { showToast } = useToast();
  const now = new Date();
  const [plans, setPlans] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [form, setForm] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    weeks: [emptyWeek(), emptyWeek(), emptyWeek(), emptyWeek()],
    coordinatorIds: [],
  });
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  function load() {
    api.get("/coordinator-plans").then((res) => setPlans(res.data));
    api.get("/district-coordinators").then((res) => setCoordinators(res.data));
  }
  useEffect(load, []);

  function updateWeek(i, field, value) {
    setForm((f) => ({ ...f, weeks: f.weeks.map((w, idx) => (idx === i ? { ...w, [field]: value } : w)) }));
  }

  function addWeek() {
    setForm((f) => ({ ...f, weeks: [...f.weeks, emptyWeek()] }));
  }

  function removeWeek(i) {
    setForm((f) => ({ ...f, weeks: f.weeks.filter((_, idx) => idx !== i) }));
  }

  async function createPlan(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/coordinator-plans", {
        month: Number(form.month),
        year: Number(form.year),
        weeks: form.weeks,
        coordinators: form.coordinatorIds,
      });
      setForm({ month: now.getMonth() + 1, year: now.getFullYear(), weeks: [emptyWeek(), emptyWeek(), emptyWeek(), emptyWeek()], coordinatorIds: [] });
      showToast("success", "Plan created", "Assigned coordinators can now submit against these weeks.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create plan");
    } finally {
      setCreating(false);
    }
  }

  async function removePlan(id, label) {
    if (!confirm(`Delete the ${label} plan? This cannot be undone.`)) return;
    setRemovingId(id);
    try {
      await api.delete(`/coordinator-plans/${id}`);
      showToast("success", "Plan removed");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to delete plan");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <form className="card" onSubmit={createPlan}>
        <div className="date-time-row">
          <label>
            Month
            <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required />
          </label>
        </div>

        <fieldset>
          <legend>Weeks</legend>
          {form.weeks.map((w, i) => (
            <div className="date-time-row" key={i}>
              <label>
                Week
                <select value={w.weekNumber} onChange={(e) => updateWeek(i, "weekNumber", e.target.value)} required>
                  <option value="" disabled>
                    Select week
                  </option>
                  {WEEK_NUMBERS.map((n) => (
                    <option key={n} value={n}>
                      Week {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input type="date" value={w.date} onChange={(e) => updateWeek(i, "date", e.target.value)} required />
              </label>
              <label>
                Day
                <select value={w.dayOfWeek} onChange={(e) => updateWeek(i, "dayOfWeek", e.target.value)} required>
                  <option value="" disabled>
                    Select day
                  </option>
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              {form.weeks.length > 1 && (
                <button type="button" className="btn-delete-icon" onClick={() => removeWeek(i)} aria-label="Remove week">
                  <MdCancel />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addWeek}>
            + Add week
          </button>
        </fieldset>

        <label>
          Assign to coordinators
          <select
            multiple
            value={form.coordinatorIds}
            onChange={(e) => setForm({ ...form, coordinatorIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
            required
          >
            {coordinators.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.district?.name})
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={creating} className={creating ? "btn-loading" : ""}>
          <span className="btn-label">Create plan</span>
          {creating && <span className="btn-spinner" />}
        </button>
      </form>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Month/Year</th>
              <th>Assigned Coordinators</th>
              <th>Weeks</th>
              <th>Created By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p._id}>
                <td>
                  {MONTH_NAMES[p.month - 1]} {p.year}
                </td>
                <td>{p.coordinators.map((c) => c.name).join(" & ")}</td>
                <td>
                  {p.weeks.map((w) => (
                    <div key={w._id}>
                      Week {w.weekNumber}: {new Date(w.date).toLocaleDateString("en-GB")} ({w.dayOfWeek})
                    </div>
                  ))}
                </td>
                <td>{p.createdBy?.name}</td>
                <td>
                  <button
                    type="button"
                    disabled={removingId === p._id}
                    className={`btn-delete-icon ${removingId === p._id ? "btn-loading" : ""}`}
                    onClick={() => removePlan(p._id, `${MONTH_NAMES[p.month - 1]} ${p.year}`)}
                    aria-label={`Remove ${MONTH_NAMES[p.month - 1]} ${p.year} plan`}
                  >
                    <span className="btn-label">
                      <MdCancel />
                    </span>
                    {removingId === p._id && <span className="btn-spinner" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GrmPlansTab() {
  const { showToast } = useToast();
  const now = new Date();
  const [plans, setPlans] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [form, setForm] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    weeks: [emptyWeek(), emptyWeek(), emptyWeek(), emptyWeek()],
    districtIds: [],
  });
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  function load() {
    api.get("/grm-plans").then((res) => setPlans(res.data));
    api.get("/districts").then((res) => setDistricts(res.data));
  }
  useEffect(load, []);

  function updateWeek(i, field, value) {
    setForm((f) => ({ ...f, weeks: f.weeks.map((w, idx) => (idx === i ? { ...w, [field]: value } : w)) }));
  }

  function addWeek() {
    setForm((f) => ({ ...f, weeks: [...f.weeks, emptyWeek()] }));
  }

  function removeWeek(i) {
    setForm((f) => ({ ...f, weeks: f.weeks.filter((_, idx) => idx !== i) }));
  }

  async function createPlan(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/grm-plans", {
        month: Number(form.month),
        year: Number(form.year),
        weeks: form.weeks,
        districts: form.districtIds,
      });
      setForm({ month: now.getMonth() + 1, year: now.getFullYear(), weeks: [emptyWeek(), emptyWeek(), emptyWeek(), emptyWeek()], districtIds: [] });
      showToast("success", "Plan created", "Assigned focal persons can now submit against these weeks.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create plan");
    } finally {
      setCreating(false);
    }
  }

  async function removePlan(id, label) {
    if (!confirm(`Delete the ${label} plan? This cannot be undone.`)) return;
    setRemovingId(id);
    try {
      await api.delete(`/grm-plans/${id}`);
      showToast("success", "Plan removed");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to delete plan");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <form className="card" onSubmit={createPlan}>
        <div className="date-time-row">
          <label>
            Month
            <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required />
          </label>
        </div>

        <fieldset>
          <legend>Weeks</legend>
          {form.weeks.map((w, i) => (
            <div className="date-time-row" key={i}>
              <label>
                Week
                <select value={w.weekNumber} onChange={(e) => updateWeek(i, "weekNumber", e.target.value)} required>
                  <option value="" disabled>
                    Select week
                  </option>
                  {WEEK_NUMBERS.map((n) => (
                    <option key={n} value={n}>
                      Week {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input type="date" value={w.date} onChange={(e) => updateWeek(i, "date", e.target.value)} required />
              </label>
              <label>
                Day
                <select value={w.dayOfWeek} onChange={(e) => updateWeek(i, "dayOfWeek", e.target.value)} required>
                  <option value="" disabled>
                    Select day
                  </option>
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              {form.weeks.length > 1 && (
                <button type="button" className="btn-delete-icon" onClick={() => removeWeek(i)} aria-label="Remove week">
                  <MdCancel />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addWeek}>
            + Add week
          </button>
        </fieldset>

        <label>
          Assign to districts
          <select
            multiple
            value={form.districtIds}
            onChange={(e) => setForm({ ...form, districtIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
            required
          >
            {districts.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={creating} className={creating ? "btn-loading" : ""}>
          <span className="btn-label">Create plan</span>
          {creating && <span className="btn-spinner" />}
        </button>
      </form>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Month/Year</th>
              <th>Assigned Districts</th>
              <th>Weeks</th>
              <th>Created By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p._id}>
                <td>
                  {MONTH_NAMES[p.month - 1]} {p.year}
                </td>
                <td>{p.districts.map((d) => d.name).join(" & ")}</td>
                <td>
                  {p.weeks.map((w) => (
                    <div key={w._id}>
                      Week {w.weekNumber}: {new Date(w.date).toLocaleDateString("en-GB")} ({w.dayOfWeek})
                    </div>
                  ))}
                </td>
                <td>{p.createdBy?.name}</td>
                <td>
                  <button
                    type="button"
                    disabled={removingId === p._id}
                    className={`btn-delete-icon ${removingId === p._id ? "btn-loading" : ""}`}
                    onClick={() => removePlan(p._id, `${MONTH_NAMES[p.month - 1]} ${p.year}`)}
                    aria-label={`Remove ${MONTH_NAMES[p.month - 1]} ${p.year} plan`}
                  >
                    <span className="btn-label">
                      <MdCancel />
                    </span>
                    {removingId === p._id && <span className="btn-spinner" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OverviewTab() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/dashboard/super-admin").then((res) => setData(res.data));
  }, []);
  if (!data) return <Spinner />;

  return (
    <div>
      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{data.activitiesThisWeek}</span>
          <span className="stat-label">Activities this week</span>
        </div>
        <div className="stat">
          <span className="stat-value">{data.activitiesThisMonth}</span>
          <span className="stat-label">Activities this month</span>
        </div>
        <div className="stat">
          <span className="stat-value">{data.flaggedNeedingReview}</span>
          <span className="stat-label">Flagged, needs review</span>
        </div>
        <div className="stat">
          <span className="stat-value">{data.overallAttendanceRate != null ? `${Math.round(data.overallAttendanceRate * 100)}%` : "—"}</span>
          <span className="stat-label">Overall attendance</span>
        </div>
      </div>

      <h3>District comparison</h3>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>District</th>
              <th>Activities</th>
              <th>Flagged</th>
            </tr>
          </thead>
          <tbody>
            {data.districtBreakdown.map((d) => (
              <tr key={d.district}>
                <td>{d.district}</td>
                <td>{d.count}</td>
                <td>{d.flagged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    api.get("/audit-logs").then((res) => setLogs(res.data));
  }, []);

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Entity</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l._id}>
              <td>{new Date(l.createdAt).toLocaleString()}</td>
              <td>{l.actor?.name}</td>
              <td>{l.action}</td>
              <td>{l.targetEntity === "Member" ? "Social Mobilizer" : l.targetEntity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
