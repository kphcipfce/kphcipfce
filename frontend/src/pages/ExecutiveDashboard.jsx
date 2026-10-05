import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FiActivity,
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiDownload,
  FiFilter,
  FiTarget,
  FiImage,
  FiMapPin,
  FiCopy,
  FiClock,
  FiRefreshCw,
  FiShield,
  FiTrendingUp,
  FiUsers,
  FiUserCheck,
  FiFileText,
} from "react-icons/fi";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import ActivityDetail from "../components/ActivityDetail";
import CoordinatorActivityDetail from "../components/CoordinatorActivityDetail";
import GrmActivityDetail from "../components/GrmActivityDetail";
import KapSurveyDetail from "../components/KapSurveyDetail";
import "./ExecutiveDashboard.css";

const COLORS = {
  emerald: "#059669",
  navy: "#1e3a8a",
  red: "#dc2626",
  amber: "#d97706",
  blue: "#2563eb",
  slate: "#94a3b8",
};

const PIE_COLORS = [COLORS.emerald, COLORS.navy, COLORS.blue, COLORS.amber, COLORS.red, COLORS.slate];

// Every activity type across all three panels — this dashboard combines Social Mobilizer,
// District Coordinator, and GRM Focal Person data, unlike any single panel's own submission
// form which only ever offers its own subset.
const ACTIVITY_TYPES = [
  "Community engagement session",
  "Behavioural change and communication campaign",
  "Wash and health hygiene in schools",
  "Environmental awareness & HCWM",
  "SEA/SH",
  "GRM capacity building of PCMC & HMC",
];
const STATUSES = [
  { value: "submitted", label: "Submitted (awaiting review)" },
  { value: "verified", label: "Verified" },
  { value: "flagged", label: "Flagged" },
];
const VISIT_STATUSES = ["Pending", "In Progress", "Completed", "Deferred / Rescheduled"];

const pct = (v) => (v === null || v === undefined || Number.isNaN(v) ? "—" : `${Math.round(v * 100)}%`);

function Panel({ title, subtitle, icon: Icon, action, children, wide = false }) {
  return (
    <section className={`exec-panel ${wide ? "exec-span-2" : ""}`}>
      <div className="exec-panel-head">
        <div className="exec-panel-title-row">
          {Icon && (
            <span className="exec-panel-icon">
              <Icon size={18} />
            </span>
          )}
          <div>
            <h2 className="exec-panel-title">{title}</h2>
            {subtitle && <p className="exec-panel-subtitle">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone = "emerald" }) {
  return (
    <div className="exec-kpi">
      <div className={`exec-kpi-icon exec-tone-${tone}`}>
        <Icon />
      </div>
      <p className="exec-kpi-label">{label}</p>
      <h3 className="exec-kpi-value">{value}</h3>
      {hint && <p className="exec-kpi-hint">{hint}</p>}
    </div>
  );
}

function Empty({ label = "No data for the selected filters" }) {
  return <div className="exec-empty">{label}</div>;
}

const EVIDENCE_RULES = [
  { key: "duplicate", label: "Duplicate photo", icon: FiCopy, match: /duplicat/i },
  { key: "location", label: "Location unverified", icon: FiMapPin, match: /(location|gps|geo)/i },
  { key: "capture", label: "Capture date mismatch", icon: FiClock, match: /(capture|exif|date mismatch|timestamp)/i },
  { key: "missing", label: "Missing / invalid photo", icon: FiImage, match: /(missing|no photo|no image|invalid)/i },
];

function classifyReason(reason) {
  if (!reason) return ["unspecified"];
  const hits = EVIDENCE_RULES.filter((r) => r.match.test(reason)).map((r) => r.key);
  return hits.length ? hits : ["other"];
}

// Every activity across all three panels resolves to one of these detail components,
// depending which collection it actually came from — same pattern the regular Dashboard uses.
const DETAIL_COMPONENT_BY_PANEL = {
  mobilizer: ActivityDetail,
  coordinator: CoordinatorActivityDetail,
  grm: GrmActivityDetail,
};

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const canModerate = user?.role === "super_admin";

  const [districts, setDistricts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [filters, setFilters] = useState({
    district: "",
    team: "",
    activityType: "",
    status: "",
    from: "",
    to: "",
    visitStatus: "",
  });

  const [activities, setActivities] = useState([]);
  const [overview, setOverview] = useState(null);
  const [kapAnalytics, setKapAnalytics] = useState(null);
  const [kapSurveys, setKapSurveys] = useState([]);
  const [openKapSurvey, setOpenKapSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openActivity, setOpenActivity] = useState(null);
  const [exporting, setExporting] = useState(null); // "field" | "coordinator" | "grm" | "kap" | null

  useEffect(() => {
    Promise.all([api.get("/districts"), api.get("/teams")])
      .then(([d, t]) => {
        setDistricts(Array.isArray(d.data) ? d.data : []);
        setTeams(Array.isArray(t.data) ? t.data : []);
      })
      .catch(() => {
        setDistricts([]);
        setTeams([]);
      });
  }, []);

  // Server-side filters: exactly the query params /dashboard/executive accepts.
  const query = useMemo(() => {
    const params = {};
    ["district", "team", "activityType", "status", "from", "to"].forEach((k) => {
      if (filters[k]) params[k] = filters[k];
    });
    return params;
  }, [filters]);

  const load = () => {
    setLoading(true);
    setError("");

    const kapParams = {};
    if (filters.district) kapParams.district = filters.district;

    Promise.all([
      api.get("/dashboard/executive", { params: query }),
      api.get("/kap-surveys/analytics", { params: kapParams }).catch(() => ({ data: null })),
      api.get("/kap-surveys", { params: kapParams }).catch(() => ({ data: [] })),
    ])
      .then(([resExec, resKapAnalytics, resKapSurveys]) => {
        setActivities(resExec.data.activities || []);
        setOverview(resExec.data);
        setKapAnalytics(resKapAnalytics.data || null);
        setKapSurveys(Array.isArray(resKapSurveys.data) ? resKapSurveys.data : []);
      })
      .catch(() => setError("Could not load executive data. Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [JSON.stringify(query)]); // eslint-disable-line react-hooks/exhaustive-deps

  async function exportTracker(kind) {
    const endpoints = {
      field: ["/dashboard/export.xlsx", "field-tracker.xlsx"],
      coordinator: ["/dashboard/export-coordinator.xlsx", "dcmo-fmo-tracker.xlsx"],
      grm: ["/dashboard/export-grm.xlsx", "grm-tracker.xlsx"],
      kap: ["/kap-surveys/export", "kap-survey-tracker.xlsx"],
    };
    const [url, filename] = endpoints[kind];
    setExporting(kind);
    try {
      const res = await api.get(url, { params: query, responseType: "blob" });
      const blobUrl = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  // Client-side filter for visit status, which /dashboard/executive doesn't accept as a
  // query param (the underlying collections don't share one indexable status enum).
  const rows = useMemo(
    () => activities.filter((a) => !filters.visitStatus || a.visitStatus === filters.visitStatus),
    [activities, filters.visitStatus],
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const verified = rows.filter((a) => a.status === "verified").length;
    const flagged = rows.filter((a) => a.status === "flagged").length;
    const submitted = rows.filter((a) => a.status === "submitted").length;
    const male = rows.reduce((s, a) => s + (a.maleAttendees || 0), 0);
    const female = rows.reduce((s, a) => s + (a.femaleAttendees || 0), 0);
    return {
      total,
      verified,
      flagged,
      submitted,
      male,
      female,
      participants: male + female,
      verifiedRate: total ? verified / total : null,
    };
  }, [rows]);

  const visitStatusMix = useMemo(() => {
    const map = new Map(VISIT_STATUSES.map((s) => [s, 0]));
    for (const a of rows) {
      const key = a.visitStatus || "Pending";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);

  const genderByType = useMemo(() => {
    const map = new Map();
    for (const a of rows) {
      const key = a.activityType || "Unspecified";
      const g = map.get(key) || { activityType: key, Male: 0, Female: 0 };
      g.Male += a.maleAttendees || 0;
      g.Female += a.femaleAttendees || 0;
      map.set(key, g);
    }
    return [...map.values()];
  }, [rows]);

  const districtRows = useMemo(() => [...(overview?.byDistrict || [])].sort((a, b) => (b.activityCount || 0) - (a.activityCount || 0)), [overview]);

  const teamRows = useMemo(
    () =>
      [...(overview?.byTeam || [])]
        .map((t) => ({ ...t, flagRate: t.activityCount ? t.flagged / t.activityCount : 0 }))
        .sort((a, b) => (b.activityCount || 0) - (a.activityCount || 0)),
    [overview],
  );

  const trend = useMemo(() => {
    const byWeek = new Map();
    for (const a of rows) {
      if (!a.week) continue;
      byWeek.set(a.week, (byWeek.get(a.week) || 0) + 1);
    }
    return [...byWeek.entries()].sort((x, y) => x[0] - y[0]).map(([week, count]) => ({ week: `W${week}`, count }));
  }, [rows]);

  const typeMix = useMemo(() => {
    const map = new Map();
    for (const a of rows) {
      const key = a.activityType || "Unspecified";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);

  const flaggedActivities = useMemo(
    () => rows.filter((a) => a.status === "flagged").sort((a, b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0)),
    [rows],
  );

  const evidenceBreakdown = useMemo(() => {
    const counts = new Map();
    for (const a of flaggedActivities) {
      for (const key of classifyReason(a.statusReason)) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const known = EVIDENCE_RULES.map((r) => ({ ...r, count: counts.get(r.key) || 0 }));
    const other = counts.get("other") || 0;
    const unspecified = counts.get("unspecified") || 0;
    return [...known, { key: "other", label: "Other reason", icon: FiShield, count: other }, { key: "unspecified", label: "No reason recorded", icon: FiAlertTriangle, count: unspecified }];
  }, [flaggedActivities]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="exec-page">
      <div className="exec-shell">
        <header className="exec-header">
          <div>
            <p className="exec-eyebrow">KP HCIP · Executive Overview</p>
            <h1 className="exec-title">What&apos;s happening in the field</h1>
            <p className="exec-subtitle">
              Combined performance across Social Mobilizer, District Coordinator, and GRM Focal Person activity — every district, any time.
            </p>
          </div>
          <div className="exec-header-actions">
            <button className="exec-btn" onClick={load}>
              <FiRefreshCw size={16} /> Refresh
            </button>
            <button className="exec-btn exec-btn-primary" onClick={() => exportTracker("field")} disabled={exporting === "field"}>
              <FiDownload size={16} /> {exporting === "field" ? "Exporting…" : "Field Tracker"}
            </button>
            <button className="exec-btn exec-btn-primary" onClick={() => exportTracker("coordinator")} disabled={exporting === "coordinator"}>
              <FiDownload size={16} /> {exporting === "coordinator" ? "Exporting…" : "DCMO/FMO Tracker"}
            </button>
            <button className="exec-btn exec-btn-primary" onClick={() => exportTracker("grm")} disabled={exporting === "grm"}>
              <FiDownload size={16} /> {exporting === "grm" ? "Exporting…" : "GRM Tracker"}
            </button>
          </div>
        </header>

        <Panel
          title="Filters"
          subtitle="Applied to every panel on this screen"
          icon={FiFilter}
          action={
            activeFilterCount > 0 ? (
              <button
                className="exec-panel-action"
                onClick={() => setFilters({ district: "", team: "", activityType: "", status: "", from: "", to: "", visitStatus: "" })}
              >
                Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
              </button>
            ) : null
          }
        >
          <div className="exec-filter-grid">
            <label className="exec-field">
              <span>District</span>
              <select value={filters.district} onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))}>
                <option value="">All districts</option>
                {districts.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="exec-field">
              <span>Team</span>
              <select value={filters.team} onChange={(e) => setFilters((f) => ({ ...f, team: e.target.value }))}>
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="exec-field">
              <span>Activity type</span>
              <select value={filters.activityType} onChange={(e) => setFilters((f) => ({ ...f, activityType: e.target.value }))}>
                <option value="">All activity types</option>
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="exec-field">
              <span>Verification status</span>
              <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="exec-field">
              <span>Visit status</span>
              <select value={filters.visitStatus} onChange={(e) => setFilters((f) => ({ ...f, visitStatus: e.target.value }))}>
                <option value="">All visit statuses</option>
                {VISIT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="exec-field">
              <span>From</span>
              <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
            </label>
            <label className="exec-field">
              <span>To</span>
              <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
            </label>
          </div>
        </Panel>

        {error && <div className="exec-error">{error}</div>}

        <div className="exec-kpi-grid">
          <Kpi
            icon={FiActivity}
            label="Activities (filtered)"
            value={loading ? "…" : stats.total}
            hint={overview ? `${overview.activitiesThisWeek} this week · ${overview.activitiesThisMonth} this month` : "All reported field activities"}
            tone="navy"
          />
          <Kpi
            icon={FiCheckCircle}
            label="Verified share"
            value={loading ? "…" : pct(stats.verifiedRate)}
            hint={`${stats.verified} verified · ${stats.submitted} awaiting review`}
            tone="emerald"
          />
          <Kpi icon={FiTarget} label="Verified rate (combined)" value={loading ? "…" : pct(overview?.attendanceRate ?? null)} hint="Across all three panels" tone="emerald" />
          <Kpi
            icon={FiUsers}
            label="Participants reached"
            value={loading ? "…" : stats.participants.toLocaleString()}
            hint={`${stats.male.toLocaleString()} male · ${stats.female.toLocaleString()} female`}
            tone="navy"
          />
          <Kpi icon={FiUserCheck} label="Districts active" value={loading ? "…" : districtRows.length} hint="Districts with reported activity" tone="emerald" />
          <Kpi
            icon={FiAlertTriangle}
            label="Flagged for review"
            value={loading ? "…" : stats.flagged}
            hint={overview ? `${overview.flaggedNeedingReview} flagged overall` : "Evidence needs attention"}
            tone="red"
          />
        </div>

        <div className="exec-grid-3">
          <Panel title="Participation by activity type" subtitle="Male vs female attendees, all panels combined" icon={FiUsers} wide>
            {genderByType.length === 0 ? (
              <Empty />
            ) : (
              <div className="exec-chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={genderByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="activityType" tick={false} height={12} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Male" fill={COLORS.navy} radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Female" fill={COLORS.emerald} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="Visit progress" subtitle="Reported completion status" icon={FiCalendar}>
            {stats.total === 0 ? (
              <Empty />
            ) : (
              <div>
                {visitStatusMix.map((s) => (
                  <div key={s.name} className="exec-progress-row">
                    <div className="exec-progress-label">
                      <span>{s.name}</span>
                      <span>
                        {s.value} · {pct(stats.total ? s.value / stats.total : null)}
                      </span>
                    </div>
                    <div className="exec-progress-track">
                      <div className="exec-progress-fill" style={{ width: `${stats.total ? (s.value / stats.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="exec-grid-3">
          <Panel title="District performance" subtitle="Activities vs verified vs flagged, all panels combined" icon={FiTrendingUp} wide>
            {districtRows.length === 0 ? (
              <Empty />
            ) : (
              <>
                <div className="exec-chart-box-tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={districtRows.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="district" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0", fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="activityCount" name="Activities" fill={COLORS.navy} radius={[8, 8, 0, 0]} />
                      <Bar dataKey="verified" name="Verified" fill={COLORS.emerald} radius={[8, 8, 0, 0]} />
                      <Bar dataKey="flagged" name="Flagged" fill={COLORS.red} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="exec-table-wrap" style={{ marginTop: "1.25rem" }}>
                  <table className="exec-table">
                    <thead>
                      <tr>
                        <th>District</th>
                        <th className="exec-num">Activities</th>
                        <th className="exec-num">Verified</th>
                        <th className="exec-num">Flagged</th>
                        <th className="exec-num">Verified %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {districtRows.map((d) => (
                        <tr key={d.districtId}>
                          <td className="exec-td-strong">{d.district || "—"}</td>
                          <td className="exec-num">{d.activityCount}</td>
                          <td className="exec-num exec-td-emerald">{d.verified}</td>
                          <td className="exec-num exec-td-red">{d.flagged}</td>
                          <td className="exec-num">{pct(d.activityCount ? d.verified / d.activityCount : null)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>

          <Panel title="Activity type mix" subtitle="Share of reported activities" icon={FiActivity}>
            {typeMix.length === 0 ? (
              <Empty />
            ) : (
              <div className="exec-chart-box-tall">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typeMix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                      {typeMix.map((entry, i) => (
                        <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>

        <div className="exec-grid-3">
          <Panel title="Weekly delivery trend" subtitle="Activities by planned week" icon={FiCalendar} wide>
            {trend.length === 0 ? (
              <Empty />
            ) : (
              <div className="exec-chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke={COLORS.emerald} strokeWidth={3} dot={{ r: 3 }} name="Activities" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="Team leaderboard" subtitle="Social Mobilizer teams — volume and flag rate" icon={FiTrendingUp}>
            {teamRows.length === 0 ? (
              <Empty />
            ) : (
              <div className="exec-leaderboard">
                {teamRows.map((t) => (
                  <div key={t.teamId} className="exec-leaderboard-row">
                    <div className="exec-leaderboard-main">
                      <div className="exec-leaderboard-top">
                        <span className="exec-leaderboard-name">{t.team || "—"}</span>
                        <span className="exec-leaderboard-count">{t.activityCount}</span>
                      </div>
                      <div className="exec-leaderboard-track">
                        <div
                          className="exec-leaderboard-fill"
                          style={{ width: `${teamRows[0].activityCount ? (t.activityCount / teamRows[0].activityCount) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className={`exec-flag-badge ${t.flagRate > 0.2 ? "exec-flag-high" : t.flagRate > 0 ? "exec-flag-some" : "exec-flag-none"}`}>
                      {pct(t.flagRate)} flagged
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* KAP Survey Records & Theme Analytics Panel */}
        <div className="exec-grid-3">
          <Panel
            title="KAP Survey Records & Theme Analytics"
            subtitle="Knowledge, Attitudes & Practices domain breakdown (% scores) and questionnaire records"
            icon={FiFileText}
            wide
            action={
              <button
                className="exec-btn exec-btn-primary"
                disabled={exporting === "kap"}
                onClick={() => exportTracker("kap")}
                style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
              >
                <FiDownload size={14} />
                {exporting === "kap" ? "Exporting…" : "Export KAP Tracker"}
              </button>
            }
          >
            {kapAnalytics && (
              <>
                {/* Metrics Grid Row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "1.25rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "1rem 1.25rem",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>Total KAP Surveys</div>
                    <div style={{ color: "#0f172a", fontSize: "1.6rem", fontWeight: "700", marginTop: "4px" }}>
                      {kapAnalytics.totalSurveys}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "1rem 1.25rem",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>Overall Knowledge [K]</div>
                    <div style={{ color: "#0284c7", fontSize: "1.6rem", fontWeight: "700", marginTop: "4px" }}>
                      {kapAnalytics.overallKap?.knowledgePct != null ? `${kapAnalytics.overallKap.knowledgePct}%` : "—"}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "1rem 1.25rem",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>Overall Attitude [A]</div>
                    <div style={{ color: "#dc2626", fontSize: "1.6rem", fontWeight: "700", marginTop: "4px" }}>
                      {kapAnalytics.overallKap?.attitudePct != null ? `${kapAnalytics.overallKap.attitudePct}%` : "—"}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "1rem 1.25rem",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>Overall Practice [P]</div>
                    <div style={{ color: "#16a34a", fontSize: "1.6rem", fontWeight: "700", marginTop: "4px" }}>
                      {kapAnalytics.overallKap?.practicePct != null ? `${kapAnalytics.overallKap.practicePct}%` : "—"}
                    </div>
                  </div>
                </div>

                {/* Grouped Bar Chart for KAP Domain Scores across Themes */}
                {Array.isArray(kapAnalytics.themeKapData) && kapAnalytics.themeKapData.length > 0 && (
                  <div style={{ marginBottom: "1.5rem", padding: "1.25rem", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "1rem", color: "#1e293b", fontWeight: "600" }}>
                          Theme-wise Knowledge, Attitude &amp; Practice (KAP) % Score Chart
                        </h4>
                        <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                          Grouped % positive score distribution across Themes 1 to 9 and Total aggregate
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", fontWeight: "600", padding: "2px 8px", background: "#e0f2fe", color: "#0369a1", borderRadius: "6px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0284c7" }} /> Knowledge
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", fontWeight: "600", padding: "2px 8px", background: "#ffe4e6", color: "#be123c", borderRadius: "6px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#dc2626" }} /> Attitude
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", fontWeight: "600", padding: "2px 8px", background: "#d1fae5", color: "#047857", borderRadius: "6px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }} /> Practice
                        </span>
                      </div>
                    </div>

                    <div className="exec-chart-box-tall">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kapAnalytics.themeKapData} margin={{ top: 15, right: 15, left: 0, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="themeLabel" interval={0} height={35} tick={{ fontSize: 11, fill: "#475569" }} />
                          <YAxis domain={[0, 100]} unit="%" allowDecimals={false} width={40} tick={{ fontSize: 11, fill: "#475569" }} />
                          <Tooltip
                            formatter={(value, name, item) => {
                              const payload = item.payload;
                              let detailStr = "";
                              if (name === "Knowledge [K]") detailStr = ` (${payload.kPos}/${payload.kTotal} positive)`;
                              else if (name === "Attitude [A]") detailStr = ` (${payload.aPos}/${payload.aTotal} positive)`;
                              else if (name === "Practice [P]") detailStr = ` (${payload.pPos}/${payload.pTotal} positive)`;
                              return [`${value}%${detailStr}`, name];
                            }}
                            labelFormatter={(label, items) => items?.[0]?.payload?.fullTitle || label}
                            contentStyle={{ borderRadius: "12px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                          />
                          <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="Knowledge" fill="#0284c7" name="Knowledge [K]" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Attitude" fill="#dc2626" name="Attitude [A]" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Practice" fill="#16a34a" name="Practice [P]" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Submitted KAP Survey Records Table */}
            <div className="exec-table-wrap">
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", color: "#1e293b", fontWeight: "600" }}>
                Submitted KAP Survey Records ({kapSurveys.length})
              </h4>
              {kapSurveys.length === 0 ? (
                <Empty label="No KAP Survey records submitted yet" />
              ) : (
                <table className="exec-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>District</th>
                      <th>Facility</th>
                      <th>Category</th>
                      <th>Sex</th>
                      <th>Submitted by</th>
                      <th>KAP Score %</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {kapSurveys.map((k) => (
                      <tr key={k._id}>
                        <td className="exec-td-muted" style={{ whiteSpace: "nowrap" }}>
                          {new Date(k.dateTime || k.createdAt).toLocaleDateString("en-GB")}
                        </td>
                        <td className="exec-td-strong">{k.district?.name || "—"}</td>
                        <td className="exec-td-muted">{k.facility?.name || "—"}</td>
                        <td className="exec-td-muted">{k.respondentCategory}</td>
                        <td className="exec-td-muted">{k.respondentSex}</td>
                        <td className="exec-td-muted">{k.submittedBy?.name || "—"}</td>
                        <td>
                          <span
                            style={{
                              fontWeight: "bold",
                              color: k.scorePercentage >= 80 ? "#059669" : k.scorePercentage >= 60 ? "#d97706" : "#dc2626",
                            }}
                          >
                            {k.scorePercentage}%
                          </span>
                        </td>
                        <td>
                          {k.reviews && k.reviews.length > 0 ? (
                            <span style={{ color: "#059669", fontWeight: "600" }}>Reviewed</span>
                          ) : (
                            <span style={{ color: "#d97706" }}>Pending</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button className="exec-link-btn" onClick={() => setOpenKapSurvey(k)}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Panel>
        </div>

        <div className="exec-grid-3">
          <Panel title="Why evidence was rejected" subtitle="Reasons recorded on flagged activities" icon={FiShield}>
            {flaggedActivities.length === 0 ? (
              <Empty label="No flagged activities — evidence quality is clean" />
            ) : (
              <div>
                {evidenceBreakdown.map((r) => (
                  <div key={r.key} className="exec-evidence-row">
                    <span className="exec-evidence-icon">
                      <r.icon size={16} />
                    </span>
                    <span className="exec-evidence-label">{r.label}</span>
                    <span className="exec-evidence-count">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Needs attention" subtitle="Most recent flagged submissions and their reason" icon={FiAlertTriangle} wide>
            {flaggedActivities.length === 0 ? (
              <Empty label="Nothing needs review right now" />
            ) : (
              <div className="exec-table-wrap">
                <table className="exec-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Panel</th>
                      <th>Week</th>
                      <th>District</th>
                      <th>Facility</th>
                      <th>Activity</th>
                      <th>Visit</th>
                      <th>Submitted by</th>
                      <th>Reason</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {flaggedActivities.slice(0, 12).map((a) => (
                      <tr key={a._id}>
                        <td className="exec-td-muted" style={{ whiteSpace: "nowrap" }}>
                          {a.dateTime ? new Date(a.dateTime).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="exec-td-muted" style={{ whiteSpace: "nowrap", textTransform: "capitalize" }}>
                          {a.panel}
                        </td>
                        <td className="exec-td-muted" style={{ whiteSpace: "nowrap" }}>
                          {a.week ? `W${a.week}` : "—"}
                        </td>
                        <td className="exec-td-strong">{a.district?.name || "—"}</td>
                        <td className="exec-td-muted">{a.facility?.name || "—"}</td>
                        <td className="exec-td-muted">{a.activityType || "—"}</td>
                        <td className="exec-td-muted" style={{ whiteSpace: "nowrap" }}>
                          {a.visitStatus || "—"}
                        </td>
                        <td className="exec-td-muted">{a.submittedBy?.name || "—"}</td>
                        <td className="exec-td-red" style={{ maxWidth: "16rem" }}>
                          {a.statusReason || "No reason recorded"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button className="exec-link-btn" onClick={() => setOpenActivity(a)}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {openActivity &&
        (() => {
          const DetailComponent = DETAIL_COMPONENT_BY_PANEL[openActivity.panel];
          return (
            <DetailComponent activityId={openActivity._id} canModerate={canModerate} onClose={() => setOpenActivity(null)} onStatusChanged={load} />
          );
        })()}

      {openKapSurvey && (
        <KapSurveyDetail survey={openKapSurvey} onClose={() => setOpenKapSurvey(null)} onReviewUpdated={load} />
      )}
    </div>
  );
}
