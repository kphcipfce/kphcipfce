import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ActivityDetail from "../components/ActivityDetail";
import CoordinatorActivityDetail from "../components/CoordinatorActivityDetail";
import GrmActivityDetail from "../components/GrmActivityDetail";
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
  const [monitoring, setMonitoring] = useState(null);
  const [activities, setActivities] = useState([]);
  const [coordinatorActivities, setCoordinatorActivities] = useState([]);
  const [grmActivities, setGrmActivities] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [openCoordinatorId, setOpenCoordinatorId] = useState(null);
  const [openGrmId, setOpenGrmId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportingCoordinator, setExportingCoordinator] = useState(false);
  const [exportDoneCoordinator, setExportDoneCoordinator] = useState(false);
  const [exportingGrm, setExportingGrm] = useState(false);
  const [exportDoneGrm, setExportDoneGrm] = useState(false);

  async function load() {
    const requests = [api.get("/dashboard/monitoring").then((res) => setMonitoring(res.data))];
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
    </div>
  );
}
