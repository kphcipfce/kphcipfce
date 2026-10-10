import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ActivityDetail from "../components/ActivityDetail";
import CoordinatorActivityDetail from "../components/CoordinatorActivityDetail";
import GrmActivityDetail from "../components/GrmActivityDetail";
import MonitoringVisitDetail from "../components/MonitoringVisitDetail";
import KapSurveyDetail from "../components/KapSurveyDetail";
import { IoMdDownload } from "react-icons/io";
import { MdFileDownloadDone } from "react-icons/md";
import { EyeIcon } from "../components/icons";

// Validated categorical pair for the two fixed attendee-gender series — distinct in both CVD
// and normal vision (run scripts/validate_palette.js from the dataviz skill to re-check).
const GENDER_COLORS = { Male: "#2a78d6", Female: "#e87ba4" };

// Colors just the Status cell, never the whole row.
function statusClassName(a) {
  if (a.status === "flagged") return "status-flagged";
  if (a.status !== "verified" || a.allPresent == null) return "";
  return a.allPresent ? "status-present" : "status-absent";
}

// "Mark Absent" still sets status to "verified" (it's a completed review either way) —
// so the label shown needs its own check to say "absent" rather than "verified".
function statusLabel(a) {
  if (a.status === "verified" && a.allPresent === false) return "absent";
  return a.status;
}

// Same red/amber/green vocabulary as the status colors above, so "danger" means
// the same thing everywhere in the app rather than introducing a second palette.
function severityColor(pct) {
  if (pct == null) return "var(--gray-300)";
  if (pct < 50) return "#e2726e";
  if (pct < 75) return "#b8860b";
  return "#1a7f37";
}

export default function Dashboard() {
  const { user } = useAuth();
  // super_admin and district_viewer share the same monitoring view — the backend scopes
  // a district_viewer's data to their own district, and canModerate hides edit actions for them.
  return user.role === "member" ? <MemberActivityList /> : <MonitoringDashboard />;
}

function MemberActivityList() {
  const [activities, setActivities] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api.get("/activities").then((res) => setActivities(res.data));
  }, []);

  return (
    <div className="page">
      <h1>My Team's Activities</h1>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a._id} onClick={() => setOpenId(a._id)} className="clickable">
                <td>{new Date(a.dateTime).toLocaleDateString()}</td>
                <td>{a.activityType}</td>
                <td className={statusClassName(a)}>{statusLabel(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openId && <ActivityDetail activityId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function MonitoringDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canModerate = user.role === "super_admin";
  // A GRM Focal Person only ever submits GRM activities — the social mobilizer and
  // coordinator tables are irrelevant to them and stay hidden (and unfetched) here.
  const isGrmFocal = user.role === "grm_focal";
  // A District Coordinator's own work is unrelated to GRM Focal Person activities — their
  // table stays hidden (and unfetched) for the same reason, just the other way around.
  const hideGrmTable = user.role === "district_viewer";
  const hideMonitoringVisitsTable = user.role === "district_viewer";
  const [monitoring, setMonitoring] = useState(null);
  const [activities, setActivities] = useState([]);
  const [coordinatorActivities, setCoordinatorActivities] = useState([]);
  const [grmActivities, setGrmActivities] = useState([]);
  const [monitoringVisits, setMonitoringVisits] = useState([]);
  const [kapSurveys, setKapSurveys] = useState([]);
  const [kapAnalytics, setKapAnalytics] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [openCoordinatorId, setOpenCoordinatorId] = useState(null);
  const [openGrmId, setOpenGrmId] = useState(null);
  const [openMonitoringVisit, setOpenMonitoringVisit] = useState(null);
  const [openKapSurvey, setOpenKapSurvey] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportingCoordinator, setExportingCoordinator] = useState(false);
  const [exportDoneCoordinator, setExportDoneCoordinator] = useState(false);
  const [exportingGrm, setExportingGrm] = useState(false);
  const [exportDoneGrm, setExportDoneGrm] = useState(false);
  const [exportingKap, setExportingKap] = useState(false);
  const [exportDoneKap, setExportDoneKap] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(() => {
    return typeof window !== "undefined" && window.innerWidth <= 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function load() {
    const requests = [
      api.get("/dashboard/monitoring").then((res) => setMonitoring(res.data)),
      api.get("/monitoring-visits").then((res) => setMonitoringVisits(res.data)),
      api.get("/kap-surveys").then((res) => setKapSurveys(res.data)),
      api.get("/kap-surveys/analytics").then((res) => setKapAnalytics(res.data)),
    ];
    if (!hideGrmTable) requests.push(api.get("/grm-activities").then((res) => setGrmActivities(res.data)));
    if (!isGrmFocal) {
      requests.push(
        api.get("/activities").then((res) => setActivities(res.data)),
        api.get("/coordinator-activities").then((res) => setCoordinatorActivities(res.data)),
      );
    }
    await Promise.all(requests);
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A plain <a href> can't carry the Authorization header the API requires, so the file
  // is fetched with the authenticated client and handed to the browser as a blob instead.
  async function downloadTracker(endpoint, filename, label, setBusy, setDone) {
    setBusy(true);
    try {
      const res = await api.get(endpoint, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      showToast("success", `${label} exported`, "The Excel file has started downloading.");
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch (err) {
      showToast("error", err.response?.data?.error || `Failed to export ${label.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  }

  const exportFieldTracker = () =>
    downloadTracker("/dashboard/export.xlsx", "field-tracker.xlsx", "Field tracker", setExporting, setExportDone);
  const exportCoordinatorTracker = () =>
    downloadTracker(
      "/dashboard/export-coordinator.xlsx",
      "dcmo-fmo-tracker.xlsx",
      "DCMO/FMO tracker",
      setExportingCoordinator,
      setExportDoneCoordinator,
    );
  const exportGrmTracker = () =>
    downloadTracker("/dashboard/export-grm.xlsx", "grm-tracker.xlsx", "GRM tracker", setExportingGrm, setExportDoneGrm);
  const exportKapTracker = () =>
    downloadTracker("/kap-surveys/export", "kap-survey-tracker.xlsx", "KAP Survey Tracker", setExportingKap, setExportDoneKap);

  return (
    <div className="page">
      <h1>Monitoring Dashboard</h1>

      {canModerate && (
        <div className="filters">
          <button
            type="button"
            className={`btn-export ${exporting ? "btn-loading" : ""}`}
            disabled={exporting}
            onClick={exportFieldTracker}
          >
            <span className="btn-label">
              {exportDone ? <MdFileDownloadDone /> : <IoMdDownload />}
              Export Field Tracker
            </span>
            {exporting && <span className="btn-spinner" />}
          </button>

          <button
            type="button"
            className={`btn-export ${exportingCoordinator ? "btn-loading" : ""}`}
            disabled={exportingCoordinator}
            onClick={exportCoordinatorTracker}
          >
            <span className="btn-label">
              {exportDoneCoordinator ? <MdFileDownloadDone /> : <IoMdDownload />}
              Export DCMO/FMO Tracker
            </span>
            {exportingCoordinator && <span className="btn-spinner" />}
          </button>

          <button
            type="button"
            className={`btn-export ${exportingGrm ? "btn-loading" : ""}`}
            disabled={exportingGrm}
            onClick={exportGrmTracker}
          >
            <span className="btn-label">
              {exportDoneGrm ? <MdFileDownloadDone /> : <IoMdDownload />}
              Export GRM Tracker
            </span>
            {exportingGrm && <span className="btn-spinner" />}
          </button>
        </div>
      )}

      {monitoring && (
        <>
          {/* Attendance rate is a social mobilizer concept (present/absent per activity) —
              meaningless for a GRM Focal Person, so it's hidden for that role. */}
          {!isGrmFocal &&
            (() => {
              const pct = monitoring.attendanceRate != null ? Math.round(monitoring.attendanceRate * 100) : null;
              const color = severityColor(pct);
              return (
                <div className="stat-row">
                  <div className="stat stat-attendance">
                    <span className="stat-value" style={{ color }}>
                      {pct != null ? `${pct}%` : "—"}
                    </span>
                    <span className="stat-label">Attendance rate</span>
                  </div>
                </div>
              );
            })()}

          <div className="chart-row">
            <div className="chart-col">
              <h3>By District</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monitoring.byDistrict} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="district" />
                  <YAxis allowDecimals={false} width={40} />
                  <Tooltip />
                  <Legend height={60} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.75rem" }} />
                  <Bar dataKey="activityCount" fill="#2f6feb" name="Activities" />
                  <Bar dataKey="flagged" fill="#d1453b" name="Flagged" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-col">
              {/* Male/Female counts come from the attendees section on the submission form
                  itself (the activity's actual audience), not the submitter's own gender —
                  combined across Social Mobilizer, Coordinator, and GRM Focal Person panels:
                  district-scoped for those two roles' own dashboards, global for Super Admin. */}
              <h3>By Activity Type</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monitoring.byActivityTypeGender} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  {/* Type names are dropped from the axis — a hover tooltip already names each
                      bar's activity type, so a repeated label underneath is redundant. */}
                  <XAxis dataKey="activityType" tick={false} height={30} />
                  <YAxis allowDecimals={false} width={40} />
                  <Tooltip />
                  <Legend height={60} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.75rem" }} />
                  <Bar dataKey="Male" fill={GENDER_COLORS.Male} name="Male" />
                  <Bar dataKey="Female" fill={GENDER_COLORS.Female} name="Female" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overall Monitoring Visit Score (Average) Pie Chart */}
          {!hideMonitoringVisitsTable && (() => {
            const validVisits = (monitoringVisits || []).filter((v) => typeof v.scorePercentage === "number");
            const avgScore = validVisits.length > 0
              ? Math.round(validVisits.reduce((acc, v) => acc + v.scorePercentage, 0) / validVisits.length)
              : null;

            const highScores = validVisits.filter((v) => v.scorePercentage >= 80).length;
            const modScores = validVisits.filter((v) => v.scorePercentage >= 60 && v.scorePercentage < 80).length;
            const lowScores = validVisits.filter((v) => v.scorePercentage < 60).length;

            const pieScoreData = validVisits.length > 0 ? [
              { name: "Excellent / High (≥80%)", value: highScores, color: "#2e7d32" },
              { name: "Satisfactory (60-79%)", value: modScores, color: "#ed6c02" },
              { name: "Needs Improvement (<60%)", value: lowScores, color: "#d32f2f" },
            ].filter((d) => d.value > 0) : [];

            return (
              <div className="card" style={{ marginTop: "1.25rem", padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Overall Monitoring Visit Score (Average)</h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--gray-600)" }}>
                      Calculated across all submitted DCMO monitoring visit checklists ({validVisits.length} record{validVisits.length === 1 ? "" : "s"})
                    </p>
                  </div>
                  {avgScore !== null && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 16px",
                        borderRadius: "999px",
                        backgroundColor: avgScore >= 80 ? "rgba(46, 125, 50, 0.12)" : avgScore >= 60 ? "rgba(237, 108, 2, 0.12)" : "rgba(211, 47, 47, 0.12)",
                        color: avgScore >= 80 ? "#2e7d32" : avgScore >= 60 ? "#ed6c02" : "#d32f2f",
                        fontWeight: "bold",
                        fontSize: "1.05rem",
                      }}
                    >
                      <span>Average Score:</span>
                      <span style={{ fontSize: "1.3rem" }}>{avgScore}%</span>
                    </div>
                  )}
                </div>

                {validVisits.length === 0 ? (
                  <p style={{ color: "var(--gray-600)", textAlign: "center", margin: "2rem 0" }}>
                    No monitoring visit checklist scores recorded yet.
                  </p>
                ) : (
                  <div style={{ width: "100%", height: "260px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieScoreData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={4}
                          dataKey="value"
                          nameKey="name"
                        >
                          {pieScoreData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val, name) => [`${val} visit(s)`, name]}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.85rem" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })()}

          {!isGrmFocal && (
            <>
              <h3>Attendance rate</h3>
              {(() => {
                const pct = monitoring.attendanceRate != null ? Math.round(monitoring.attendanceRate * 100) : null;
                return (
                  <div className="meter" role="img" aria-label={`Attendance rate ${pct != null ? `${pct}%` : "unavailable"}`}>
                    <div className="meter-track">
                      <div className="meter-fill" style={{ width: `${pct ?? 0}%`, backgroundColor: severityColor(pct) }} />
                    </div>
                    <span className="meter-value">{pct != null ? `${pct}%` : "—"}</span>
                  </div>
                );
              })()}
            </>
          )}
        </>
      )}

      {!isGrmFocal && (
        <>
          <h3>Social Mobilizer Activity Records</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>District</th>
                  <th>Team</th>
                  <th>Type</th>
                  <th>Review</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a._id}>
                    <td>{new Date(a.dateTime).toLocaleDateString()}</td>
                    <td>{a.district?.name}</td>
                    <td>{a.team?.name}</td>
                    <td>{a.activityType}</td>
                    <td>
                      <button type="button" className="icon-btn" onClick={() => setOpenId(a._id)} aria-label="Preview activity record">
                        <EyeIcon />
                      </button>
                    </td>
                    <td className={statusClassName(a)}>{statusLabel(a)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kept in a separate table (and a separate collection server-side) so these never mix
              into the Field Tracker export or any of the charts/stats above, which are all built
              around social mobilizer team/facility visits. */}
          <h3>District Coordinator Activity Records</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>District</th>
                  <th>Type</th>
                  <th>Refresher</th>
                  <th>Review</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {coordinatorActivities.map((a) => (
                  <tr key={a._id}>
                    <td>{new Date(a.dateTime).toLocaleDateString()}</td>
                    <td>{a.district?.name}</td>
                    <td>{a.activityType}</td>
                    <td>{a.isRefresher ? "Yes" : "No"}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setOpenCoordinatorId(a._id)}
                        aria-label="Preview coordinator activity record"
                      >
                        <EyeIcon />
                      </button>
                    </td>
                    <td className={a.status === "flagged" ? "status-flagged" : a.status === "verified" ? "status-present" : ""}>{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!hideGrmTable && (
        <>
          {/* Same isolation as the coordinator table above — its own collection, so GRM data
              never touches the Field Tracker export or the social mobilizer charts/stats. */}
          <h3>GRM Focal Person Activity Records</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>District</th>
                  <th>Type</th>
                  <th>Refresher</th>
                  <th>Review</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {grmActivities.map((a) => (
                  <tr key={a._id}>
                    <td>{new Date(a.dateTime).toLocaleDateString()}</td>
                    <td>{a.district?.name}</td>
                    <td>{a.activityType}</td>
                    <td>{a.isRefresher ? "Yes" : "No"}</td>
                    <td>
                      <button type="button" className="icon-btn" onClick={() => setOpenGrmId(a._id)} aria-label="Preview GRM activity record">
                        <EyeIcon />
                      </button>
                    </td>
                    <td className={a.status === "flagged" ? "status-flagged" : a.status === "verified" ? "status-present" : ""}>{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!hideMonitoringVisitsTable && monitoringVisits.length > 0 && (
        <>
          <h3>Reviewed Monitoring Visit Records</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>District</th>
                  <th>Facility</th>
                  <th>UC / Village</th>
                  <th>District Coordinator</th>
                  <th>Target Mobilizer</th>
                  <th>Score %</th>
                  <th>TL/DTL Reviewer</th>
                  <th>Accepted/Complete</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {monitoringVisits.map((v) => (
                  <tr key={v._id}>
                    <td>{new Date(v.dateTime).toLocaleDateString()}</td>
                    <td>{v.district?.name}</td>
                    <td>{v.facility?.name}</td>
                    <td>{v.ucVillage}</td>
                    <td>{v.coordinator?.name || v.dcmoName}</td>
                    <td>
                      {v.targetMobilizer?.name}
                      {v.targetMobilizer2 ? ` & ${v.targetMobilizer2.name}` : ""}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: "bold",
                          color: v.scorePercentage >= 80 ? "#2e7d32" : v.scorePercentage >= 60 ? "#ed6c02" : "#d32f2f",
                        }}
                      >
                        {v.scorePercentage}%
                      </span>
                    </td>
                    <td>
                      {v.reviews && v.reviews.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {v.reviews.map((r, i) => (
                            <div key={i} style={{ whiteSpace: "nowrap" }}>
                              {r.reviewerName}
                            </div>
                          ))}
                        </div>
                      ) : (
                        v.reviewerName || "—"
                      )}
                    </td>
                    <td>
                      {v.reviews && v.reviews.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {v.reviews.map((r, i) => (
                            <div
                              key={i}
                              style={{
                                fontWeight: "bold",
                                color: r.acceptedComplete === "Yes" ? "#2e7d32" : "#d32f2f",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {r.acceptedComplete}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span
                          style={{
                            fontWeight: "bold",
                            color: v.acceptedComplete === "Yes" ? "#2e7d32" : "#d32f2f",
                          }}
                        >
                          {v.acceptedComplete || "—"}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setOpenMonitoringVisit(v)}
                        aria-label="Preview monitoring visit record"
                      >
                        <EyeIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* KAP Survey Records & Theme-wise Analytics */}
      {!isGrmFocal && (
        <div
          style={{
            marginTop: "2.5rem",
            background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "1.5rem",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
          }}
        >
          {/* Header Title Section */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#0f172a", fontWeight: "700" }}>
                  KAP Survey Records &amp; Theme Analytics
                </h2>
                <span style={{ background: "#e0f2fe", color: "#0369a1", fontSize: "0.75rem", padding: "3px 10px", borderRadius: "999px", fontWeight: "600", border: "1px solid #bae6fd" }}>
                  Knowledge • Attitudes • Practices
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                Comprehensive theme-wise domain breakdown (% positive scores) and submitted questionnaire records
              </p>
            </div>

            {canModerate && (
              <button
                type="button"
                className={`btn-export ${exportingKap ? "btn-loading" : ""}`}
                disabled={exportingKap}
                onClick={exportKapTracker}
                style={{ background: "#006644", color: "#ffffff", borderColor: "#005236" }}
              >
                <span className="btn-label">
                  {exportDoneKap ? <MdFileDownloadDone /> : <IoMdDownload />}
                  Export KAP Tracker
                </span>
                {exportingKap && <span className="btn-spinner" />}
              </button>
            )}
          </div>

          {kapAnalytics && (
            <>
              {/* Metrics Grid Row */}
              <div
                className="metrics"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "1.5rem",
                  marginBottom: "2rem",
                }}
              >
                <div
                  className="metric card"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "1.25rem",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div className="metric-label" style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: "500" }}>
                    Total KAP Surveys
                  </div>
                  <div className="metric-value" style={{ color: "#0f172a", fontSize: "1.8rem", fontWeight: "700", marginTop: "6px" }}>
                    {kapAnalytics.totalSurveys}
                  </div>
                </div>

                <div
                  className="metric card"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "1.25rem",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div className="metric-label" style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: "500" }}>
                    Overall Knowledge [K]
                  </div>
                  <div className="metric-value" style={{ color: "#0284c7", fontSize: "1.8rem", fontWeight: "700", marginTop: "6px" }}>
                    {kapAnalytics.overallKap?.knowledgePct != null ? `${kapAnalytics.overallKap.knowledgePct}%` : "—"}
                  </div>
                </div>

                <div
                  className="metric card"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "1.25rem",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div className="metric-label" style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: "500" }}>
                    Overall Attitude [A]
                  </div>
                  <div className="metric-value" style={{ color: "#dc2626", fontSize: "1.8rem", fontWeight: "700", marginTop: "6px" }}>
                    {kapAnalytics.overallKap?.attitudePct != null ? `${kapAnalytics.overallKap.attitudePct}%` : "—"}
                  </div>
                </div>

                <div
                  className="metric card"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "1.25rem",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div className="metric-label" style={{ color: "#64748b", fontSize: "0.85rem", fontWeight: "500" }}>
                    Overall Practice [P]
                  </div>
                  <div className="metric-value" style={{ color: "#16a34a", fontSize: "1.8rem", fontWeight: "700", marginTop: "6px" }}>
                    {kapAnalytics.overallKap?.practicePct != null ? `${kapAnalytics.overallKap.practicePct}%` : "—"}
                  </div>
                </div>
              </div>

              {/* Grouped Bar Chart for KAP Domain Scores across Themes */}
              {Array.isArray(kapAnalytics.themeKapData) && kapAnalytics.themeKapData.length > 0 && (
                <div className="card" style={{ marginBottom: "1.25rem", padding: isSmallScreen ? "0.85rem" : "1.25rem", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#1e293b", fontWeight: "600" }}>
                        Theme-wise Knowledge, Attitude &amp; Practice (KAP) % Score Chart
                      </h3>
                      <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                        Grouped % positive score distribution across Themes 1 to 9 {isSmallScreen ? "(T1–T9) " : ""}and Total aggregate
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", fontWeight: "600", padding: "3px 8px", background: "#e0f2fe", color: "#0369a1", borderRadius: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0284c7" }} /> Knowledge
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", fontWeight: "600", padding: "3px 8px", background: "#ffe4e6", color: "#be123c", borderRadius: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#dc2626" }} /> Attitude
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", fontWeight: "600", padding: "3px 8px", background: "#d1fae5", color: "#047857", borderRadius: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }} /> Practice
                      </span>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={isSmallScreen ? 320 : 380}>
                    <BarChart
                      data={kapAnalytics.themeKapData}
                      margin={{
                        top: 20,
                        right: isSmallScreen ? 10 : 20,
                        left: isSmallScreen ? -15 : 0,
                        bottom: isSmallScreen ? 20 : 35,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="themeLabel"
                        interval={0}
                        height={isSmallScreen ? 30 : 40}
                        tick={{ fontSize: isSmallScreen ? 10 : 12, fill: "#475569" }}
                        tickFormatter={(label) =>
                          isSmallScreen ? String(label).replace(/^Theme\s+/i, "T") : label
                        }
                      />
                      <YAxis
                        domain={[0, 100]}
                        unit="%"
                        allowDecimals={false}
                        width={isSmallScreen ? 32 : 45}
                        tick={{ fontSize: isSmallScreen ? 10 : 12, fill: "#475569" }}
                      />
                      <Tooltip
                        formatter={(value, name, item) => {
                          const payload = item.payload;
                          let detailStr = "";
                          if (name === "Knowledge [K]") detailStr = ` (${payload.kPos}/${payload.kTotal} positive)`;
                          else if (name === "Attitude [A]") detailStr = ` (${payload.aPos}/${payload.aTotal} positive)`;
                          else if (name === "Practice [P]") detailStr = ` (${payload.pPos}/${payload.pTotal} positive)`;
                          return [`${value}%${detailStr}`, name];
                        }}
                        labelFormatter={(label, items) => {
                          const full = items?.[0]?.payload?.fullTitle;
                          if (full) return full;
                          return String(label).startsWith("T") ? label.replace(/^T(\d+)/, "Theme $1") : label;
                        }}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={isSmallScreen ? { fontSize: "11px" } : undefined} />
                      <Bar dataKey="Knowledge" fill="#0284c7" name="Knowledge [K]" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Attitude" fill="#dc2626" name="Attitude [A]" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Practice" fill="#16a34a" name="Practice [P]" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Four District-wise KAP Survey Analytics Graphs */}
              {Array.isArray(kapAnalytics.districtAnalytics) && kapAnalytics.districtAnalytics.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div style={{ marginBottom: "1rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#1e293b", fontWeight: "600" }}>
                      District-wise KAP Survey Analytics &amp; Facility Coverage
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                      District-specific facility coverage and survey type breakdown by male and female counts
                    </p>
                  </div>

                  <div className="district-kap-grid">
                    {kapAnalytics.districtAnalytics.map((dist) => {
                      const chartData = (dist.surveyTypesData || []).map((st) => ({
                        surveyType: st.surveyType,
                        Male: st.maleCount,
                        Female: st.femaleCount,
                        Total: st.grandTotal,
                        facilitiesCovered: st.facilitiesCoveredCount,
                      }));

                      const totalFacilitiesCovered = (dist.surveyTypesData || []).reduce(
                        (sum, st) => sum + (st.facilitiesCoveredCount || 0),
                        0
                      );

                      return (
                        <div key={dist.districtName} className="district-kap-card">
                          {/* District Header & Badges */}
                          <div className="district-kap-header">
                            <div>
                              <h4 style={{ margin: 0, fontSize: "1.05rem", color: "#0f172a", fontWeight: "700" }}>
                                {dist.districtName} District
                              </h4>
                              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                                {dist.districtGrandTotalSurveys} surveys across {totalFacilitiesCovered} facility sessions
                              </span>
                            </div>

                            <div className="district-kap-badges">
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: "600",
                                  padding: "3px 8px",
                                  background: "#e0f2fe",
                                  color: "#0369a1",
                                  borderRadius: "6px",
                                }}
                              >
                                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#0284c7" }} />
                                Male: {dist.districtTotalMale}
                              </span>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: "600",
                                  padding: "3px 8px",
                                  background: "#fce7f3",
                                  color: "#be185d",
                                  borderRadius: "6px",
                                }}
                              >
                                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#ec4899" }} />
                                Female: {dist.districtTotalFemale}
                              </span>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: "600",
                                  padding: "3px 8px",
                                  background: "#f1f5f9",
                                  color: "#334155",
                                  borderRadius: "6px",
                                }}
                              >
                                Total: {dist.districtGrandTotalSurveys}
                              </span>
                            </div>
                          </div>

                          {/* Grouped Bar Chart for this District */}
                          <div className="district-kap-chart-container">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="surveyType" interval={0} tick={{ fontSize: 10, fill: "#475569" }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#475569" }} width={30} />
                                <Tooltip
                                  content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div
                                          style={{
                                            background: "#ffffff",
                                            padding: "8px 10px",
                                            border: "1px solid #cbd5e1",
                                            borderRadius: "8px",
                                            fontSize: "11px",
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                          }}
                                        >
                                          <div style={{ fontWeight: "700", marginBottom: "3px", color: "#0f172a" }}>
                                            {label}
                                          </div>
                                          <div style={{ color: "#0284c7" }}>Male: <strong>{data.Male}</strong></div>
                                          <div style={{ color: "#ec4899" }}>Female: <strong>{data.Female}</strong></div>
                                          <div style={{ color: "#0f172a", marginTop: "2px" }}>Grand Total: <strong>{data.Total}</strong></div>
                                          <div style={{ color: "#64748b", marginTop: "3px", borderTop: "1px solid #e2e8f0", paddingTop: "3px" }}>
                                            Facilities Covered: <strong>{data.facilitiesCovered}</strong>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend verticalAlign="top" height={28} iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                                <Bar dataKey="Male" fill="#0284c7" name="Male" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Female" fill="#ec4899" name="Female" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Breakdown Table without details by person */}
                          <div className="district-kap-table-wrap">
                            <table className="district-kap-table">
                              <thead>
                                <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                                  <th style={{ padding: "5px 8px" }}>Survey Type</th>
                                  <th style={{ padding: "5px 8px", textAlign: "center" }}>Facilities Covered</th>
                                  <th style={{ padding: "5px 8px", textAlign: "right" }}>Female</th>
                                  <th style={{ padding: "5px 8px", textAlign: "right" }}>Male</th>
                                  <th style={{ padding: "5px 8px", textAlign: "right" }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(dist.surveyTypesData || []).map((st) => (
                                  <tr key={st.surveyType} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ padding: "5px 8px", fontWeight: "600", color: "#1e293b" }}>{st.surveyType}</td>
                                    <td style={{ padding: "5px 8px", textAlign: "center", color: "#0369a1", fontWeight: "600" }}>{st.facilitiesCoveredCount}</td>
                                    <td style={{ padding: "5px 8px", textAlign: "right", color: "#be185d" }}>{st.femaleCount}</td>
                                    <td style={{ padding: "5px 8px", textAlign: "right", color: "#0284c7" }}>{st.maleCount}</td>
                                    <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "700", color: "#0f172a" }}>{st.grandTotal}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* KAP Survey Records Table */}
          <div className="card" style={{ padding: "1.25rem", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
            <div style={{ marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#1e293b", fontWeight: "600" }}>Submitted KAP Survey Records</h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748b" }}>Inspect questionnaire details and review status</p>
            </div>

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th>Date</th>
                    <th>District</th>
                    <th>Facility</th>
                    <th>Survey Type</th>
                    <th>Sex</th>
                    <th>Submitted By</th>
                    <th>Positive Score %</th>
                    <th>Review Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {kapSurveys.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                        No KAP Survey records submitted yet.
                      </td>
                    </tr>
                  ) : (
                    kapSurveys.map((k) => {
                      // Category badge colors
                      const catBg = k.respondentCategory === "School" ? "#f3e8ff" : k.respondentCategory === "Community" ? "#fef3c7" : k.respondentCategory === "Health Staff" ? "#dbeafe" : "#d1fae5";
                      const catColor = k.respondentCategory === "School" ? "#7e22ce" : k.respondentCategory === "Community" ? "#b45309" : k.respondentCategory === "Health Staff" ? "#1d4ed8" : "#047857";

                      return (
                        <tr key={k._id}>
                          <td style={{ fontWeight: "500", whiteSpace: "nowrap" }}>{new Date(k.dateTime || k.createdAt).toLocaleDateString("en-GB")}</td>
                          <td><strong>{k.district?.name}</strong></td>
                          <td>{k.facility?.name}</td>
                          <td>
                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", background: catBg, color: catColor }}>
                              {k.respondentCategory}
                            </span>
                          </td>
                          <td>
                            <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "600", background: "#f1f5f9", color: "#475569" }}>
                              {k.respondentSex}
                            </span>
                          </td>
                          <td>
                            {k.submittedBy?.name} <span style={{ fontSize: "11px", color: "#64748b" }}>({k.submittedByRole === "district_viewer" ? "DC" : "SM"})</span>
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontWeight: "bold",
                                fontSize: "12px",
                                background: k.scorePercentage >= 80 ? "rgba(46, 125, 50, 0.12)" : k.scorePercentage >= 60 ? "rgba(237, 108, 2, 0.12)" : "rgba(211, 47, 47, 0.12)",
                                color: k.scorePercentage >= 80 ? "#2e7d32" : k.scorePercentage >= 60 ? "#ed6c02" : "#d32f2f",
                              }}
                            >
                              {k.scorePercentage}%
                            </span>
                          </td>
                          <td>
                            {k.reviews && k.reviews.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                {k.reviews.map((r, i) => (
                                  <span key={i} style={{ fontSize: "11px", color: r.acceptedComplete === "Yes" ? "#2e7d32" : "#d32f2f", fontWeight: "bold" }}>
                                    ✓ {r.reviewerName}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", background: "#fff7ed", color: "#c2410c", border: "1px solid #ffedd5" }}>
                                Pending Review
                              </span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => setOpenKapSurvey(k)}
                              aria-label="Preview KAP Survey record"
                            >
                              <EyeIcon />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {openId && <ActivityDetail activityId={openId} canModerate={canModerate} onClose={() => setOpenId(null)} onStatusChanged={load} />}
      {openCoordinatorId && (
        <CoordinatorActivityDetail
          activityId={openCoordinatorId}
          canModerate={canModerate}
          onClose={() => setOpenCoordinatorId(null)}
          onStatusChanged={load}
        />
      )}
      {openGrmId && (
        <GrmActivityDetail activityId={openGrmId} canModerate={canModerate} onClose={() => setOpenGrmId(null)} onStatusChanged={load} />
      )}
      {openMonitoringVisit && (
        <MonitoringVisitDetail visit={openMonitoringVisit} onClose={() => setOpenMonitoringVisit(null)} />
      )}
      {openKapSurvey && (
        <KapSurveyDetail
          survey={openKapSurvey}
          onClose={() => setOpenKapSurvey(null)}
          onReviewUpdated={load}
        />
      )}
    </div>
  );
}
