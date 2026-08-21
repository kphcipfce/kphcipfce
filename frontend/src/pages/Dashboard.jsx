import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ActivityDetail from "../components/ActivityDetail";
import { IoMdDownload } from "react-icons/io";
import { MdFileDownloadDone } from "react-icons/md";
import { EyeIcon } from "../components/icons";

// Fixed hue order per activity type — colors identify the type, so they must stay stable
// regardless of which types happen to have data for the current filter (validated categorical
// palette, slots 1-3: blue/orange/aqua).
const ACTIVITY_TYPE_COLORS = {
  "Community engagement session": "#2a78d6",
  "Behavioural change and communication campaign": "#eb6834",
  "Wash and health hygiene in schools": "#1baf7a",
};
const ACTIVITY_TYPES = Object.keys(ACTIVITY_TYPE_COLORS);

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
  const [monitoring, setMonitoring] = useState(null);
  const [activities, setActivities] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  async function load() {
    await Promise.all([
      api.get("/dashboard/monitoring").then((res) => setMonitoring(res.data)),
      api.get("/activities").then((res) => setActivities(res.data)),
    ]);
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A plain <a href> can't carry the Authorization header the API requires, so the file
  // is fetched with the authenticated client and handed to the browser as a blob instead.
  async function exportFieldTracker() {
    setExporting(true);
    try {
      const res = await api.get("/dashboard/export.xlsx", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "field-tracker.xlsx";
      link.click();
      URL.revokeObjectURL(url);
      showToast("success", "Field tracker exported", "The Excel file has started downloading.");
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2000);
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to export field tracker");
    } finally {
      setExporting(false);
    }
  }

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
        </div>
      )}

      {monitoring && (
        <>
          <div className="stat-row">
            <div className="stat">
              <span className="stat-value">{monitoring.attendanceRate != null ? `${Math.round(monitoring.attendanceRate * 100)}%` : "—"}</span>
              <span className="stat-label">Attendance rate</span>
            </div>
          </div>

          <div className="chart-row">
            <div className="chart-col">
              <h3>By District</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monitoring.byDistrict} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
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
              <h3>By Activity Type</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monitoring.byGenderActivityType} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="gender" />
                  <YAxis allowDecimals={false} width={40} />
                  <Tooltip />
                  <Legend height={60} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.75rem" }} />
                  {ACTIVITY_TYPES.map((type) => (
                    <Bar key={type} dataKey={type} fill={ACTIVITY_TYPE_COLORS[type]} name={type} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

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

      <h3>Activity Records</h3>
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

      {openId && <ActivityDetail activityId={openId} canModerate={canModerate} onClose={() => setOpenId(null)} onStatusChanged={load} />}
    </div>
  );
}
