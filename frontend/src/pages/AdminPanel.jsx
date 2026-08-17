import { useEffect, useState } from "react";
import api from "../api/client";
import { useToast } from "../context/ToastContext";
import Spinner from "../components/Spinner";
import { EyeIcon, EyeOffIcon } from "../components/icons";
import { roleLabel } from "../utils/roleLabel";

const TABS = ["Social Mobilizers", "Teams", "Districts", "Micro Plans", "Overview", "Audit Log"];

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
      {tab === "Micro Plans" && <MicroPlansTab />}
      {tab === "Overview" && <OverviewTab />}
      {tab === "Audit Log" && <AuditLogTab />}
    </div>
  );
}

function MembersTab() {
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [editingPasswordId, setEditingPasswordId] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  function load() {
    api.get("/members").then((res) => setMembers(res.data));
  }
  useEffect(load, []);

  async function createMember(e) {
    e.preventDefault();
    try {
      await api.post("/members", { ...form, role: "member" });
      setForm({ ...form, name: "", email: "", phone: "", password: "" });
      showToast("success", "Social Mobilizer created", "The new social mobilizer can now sign in with their password.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create social mobilizer");
    }
  }

  async function toggleActive(m) {
    await api.patch(`/members/${m._id}`, { active: !m.active });
    load();
  }

  function togglePasswordEdit(id) {
    setNewPassword("");
    setEditingPasswordId((current) => (current === id ? null : id));
  }

  async function savePassword(id) {
    if (!newPassword) return showToast("error", "Enter a new password");
    try {
      await api.patch(`/members/${id}`, { password: newPassword });
      setEditingPasswordId(null);
      setNewPassword("");
      showToast("success", "Password updated", "The social mobilizer can sign in with the new password.");
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to update password");
    }
  }

  return (
    <div>
      <form className="card inline-form" onSubmit={createMember}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button type="submit">Add Social Mobilizer</button>
      </form>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
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
                      <button type="button" onClick={() => savePassword(m._id)}>
                        Save
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
                  <button onClick={() => toggleActive(m)}>{m.active ? "Deactivate" : "Activate"}</button>
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
  const [form, setForm] = useState({ name: "", memberA: "", memberB: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ memberA: "", memberB: "" });

  function load() {
    api.get("/teams").then((res) => setTeams(res.data));
    api.get("/members").then((res) => setMembers(res.data));
  }
  useEffect(load, []);

  // A member has no district of their own until paired — any unteamed member can join
  // any team, and the team's district gets assigned to them at that point (server-side).
  const unassigned = members.filter((m) => !m.team && m.role === "member");
  // Reassignment can pull in any member, including one currently on another team.
  const eligibleMembers = members.filter((m) => m.role === "member");

  async function createTeam(e) {
    e.preventDefault();
    try {
      await api.post("/teams", { name: form.name, memberIds: [form.memberA, form.memberB] });
      setForm({ ...form, name: "", memberA: "", memberB: "" });
      showToast("success", "Team created", "The team is ready to submit activities.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create team");
    }
  }

  function startEdit(t) {
    setEditingId(t._id);
    setEditForm({ memberA: t.memberIds[0]._id, memberB: t.memberIds[1]._id });
  }

  async function saveEdit(t) {
    try {
      await api.patch(`/teams/${t._id}`, { memberIds: [editForm.memberA, editForm.memberB] });
      setEditingId(null);
      showToast("success", "Team updated", "Membership changes saved.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to update team");
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
        <button type="submit">Create team</button>
      </form>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Team</th>
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
                        <button onClick={() => saveEdit(t)}>Save</button> <button onClick={() => setEditingId(null)}>Cancel</button>
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
  const [openViewerId, setOpenViewerId] = useState(null);
  const [viewerPassword, setViewerPassword] = useState("");

  function load() {
    api.get("/districts").then((res) => setDistricts(res.data));
  }
  useEffect(load, []);

  async function createDistrict(e) {
    e.preventDefault();
    try {
      await api.post("/districts", { name });
      setName("");
      showToast("success", "District created", "A read-only viewer login was generated automatically.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create district");
    }
  }

  async function removeDistrict(id) {
    try {
      await api.delete(`/districts/${id}`);
      showToast("success", "District removed");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to delete district");
    }
  }

  function toggleViewer(d) {
    setOpenViewerId((current) => {
      if (current === d._id) return null;
      setViewerPassword(d.viewerPassword || "");
      return d._id;
    });
  }

  async function saveViewerPassword(id) {
    if (!viewerPassword) return showToast("error", "Enter a password");
    try {
      await api.patch(`/districts/${id}/viewer-password`, { password: viewerPassword });
      setOpenViewerId(null);
      showToast("success", "Viewer password updated", "Share the new password with the district viewer.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to update password");
    }
  }

  return (
    <div>
      <form className="card inline-form" onSubmit={createDistrict}>
        <input placeholder="District name" value={name} onChange={(e) => setName(e.target.value)} required />
        <button type="submit">Add district</button>
      </form>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Viewer Login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {districts.map((d) => (
              <tr key={d._id}>
                <td>{d.name}</td>
                <td>
                  {openViewerId === d._id ? (
                    <div className="password-edit">
                      <span>{d.viewerMember?.email}</span>
                      <input type="text" value={viewerPassword} onChange={(e) => setViewerPassword(e.target.value)} autoFocus />
                      <button type="button" onClick={() => saveViewerPassword(d._id)}>
                        Save
                      </button>
                      <button type="button" className="icon-btn" onClick={() => toggleViewer(d)} aria-label={`Close viewer login for ${d.name}`}>
                        <EyeOffIcon />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="icon-btn" onClick={() => toggleViewer(d)} aria-label={`Show viewer login for ${d.name}`}>
                      <EyeIcon />
                    </button>
                  )}
                </td>
                <td>
                  <button type="button" onClick={() => removeDistrict(d._id)} aria-label={`Remove ${d.name}`}>
                    ×
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

function emptyWeek() {
  return { date: "" };
}

function MicroPlansTab() {
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

  function load() {
    api.get("/micro-plans").then((res) => setPlans(res.data));
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
    try {
      await api.post("/micro-plans", {
        month: Number(form.month),
        year: Number(form.year),
        weeks: form.weeks,
        teams: form.teamIds,
      });
      setForm({ month: now.getMonth() + 1, year: now.getFullYear(), weeks: [emptyWeek(), emptyWeek(), emptyWeek(), emptyWeek()], teamIds: [] });
      showToast("success", "Micro plan created", "Assigned teams can now submit against these weeks.");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to create plan");
    }
  }

  async function removeMicroPlan(id) {
    try {
      await api.delete(`/micro-plans/${id}`);
      showToast("success", "Micro plan removed");
      load();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to delete plan");
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
                Week {i + 1} date
                <input type="date" value={w.date} onChange={(e) => updateWeek(i, "date", e.target.value)} required />
              </label>
              {form.weeks.length > 1 && (
                <button type="button" onClick={() => removeWeek(i)} aria-label="Remove week">
                  ×
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
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit">Create plan</button>
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
                      Week {w.weekNumber}: {new Date(w.date).toLocaleDateString()}
                    </div>
                  ))}
                </td>
                <td>{p.createdBy?.name}</td>
                <td>
                  <button type="button" onClick={() => removeMicroPlan(p._id)} aria-label={`Remove ${MONTH_NAMES[p.month - 1]} ${p.year} plan`}>
                    ×
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
