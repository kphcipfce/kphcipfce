import { useEffect, useState } from "react";
import api from "../api/client";
import { useToast } from "../context/ToastContext";

export default function ActivityDetail({ activityId, onClose, onStatusChanged, canModerate }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [reason, setReason] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [busyAction, setBusyAction] = useState(null); // "present" | "flag" | "absent" | null

  useEffect(() => {
    api.get(`/activities/${activityId}`).then((res) => setData(res.data));
  }, [activityId]);

  async function setStatus(status) {
    setBusyAction("flag");
    try {
      await api.patch(`/activities/${activityId}/status`, { status, statusReason: reason });
      const res = await api.get(`/activities/${activityId}`);
      setData(res.data);
      showToast("success", "Record flagged", "Attendance is withheld until this is reviewed.");
      onStatusChanged?.();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to flag record");
    } finally {
      setBusyAction(null);
    }
  }

  async function setAttendance(present) {
    setBusyAction(present ? "present" : "absent");
    try {
      await api.patch(`/activities/${activityId}/attendance`, { present });
      const res = await api.get(`/activities/${activityId}`);
      setData(res.data);
      showToast("success", present ? "Marked present" : "Marked absent", "Attendance updated for this activity.");
      onStatusChanged?.();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to update attendance");
    } finally {
      setBusyAction(null);
    }
  }

  if (!data) return null;
  const { activity, attendance, images } = data;
  const anyAbsent = attendance.some((a) => !a.present);
  const statusClassName =
    activity.status === "flagged"
      ? "status-flagged"
      : activity.status === "verified" && attendance.length > 0
        ? anyAbsent
          ? "status-absent"
          : "status-present"
        : "";
  // "Mark Absent" still sets status to "verified" (it's a completed review either way) —
  // so the label shown needs its own check to say "absent" rather than "verified".
  const statusLabel = activity.status === "verified" && attendance.length > 0 && anyAbsent ? "absent" : activity.status;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <h2>{activity.activityType}</h2>
        <p>
          {new Date(activity.dateTime).toLocaleString()} — {activity.team?.name} / {activity.district?.name}
        </p>
        <p>
          Status: <strong className={statusClassName}>{statusLabel}</strong> {activity.statusReason && `(${activity.statusReason})`}
        </p>

        {activity.microPlan &&
          (() => {
            const week = activity.microPlan.weeks.find((w) => w._id === activity.microPlanWeek);
            return week ? <p>Planned week: {new Date(week.date).toLocaleDateString()}</p> : null;
          })()}
        <p>Health Facility / Community: {activity.healthFacility}</p>
        <p>Planned Activity: {activity.plannedActivity}</p>
        <p>Responsible Person: {activity.responsiblePerson}</p>
        <p>Target Group: {activity.targetGroup}</p>
        <p>Expected Output: {activity.expectedOutput}</p>
        <p>Visit Status: {activity.visitStatus}</p>
        {activity.description && <p>Remarks / Follow-up: {activity.description}</p>}

        {activity.status === "flagged" ? (
          <p className="error">Attendance withheld — this record is flagged and hasn't been confirmed.</p>
        ) : (
          <>
            <h3>Attendance</h3>
            <ul>
              {attendance.map((a) => (
                <li key={a._id}>
                  {a.member?.name} — {a.present ? "present" : "absent"}
                </li>
              ))}
            </ul>
          </>
        )}

        <h3>Photos &amp; metadata</h3>
        <div className="photo-grid">
          {images.map((img) => (
            <div key={img._id} className="photo-card">
              <img src={img.fileUrl} alt="evidence" className="photo-thumb" onClick={() => setPreviewImage(img.fileUrl)} />
              <p>Uploaded: {new Date(img.uploadTimestamp).toLocaleString()}</p>
              <p>{img.exifTimestamp ? `Captured: ${new Date(img.exifTimestamp).toLocaleString()}` : "Capture date unknown (no EXIF)"}</p>
              <p>{img.locationVerified ? `GPS: ${img.gpsLat?.toFixed(4)}, ${img.gpsLong?.toFixed(4)}` : "Location not verified"}</p>
              {img.isDuplicate && <p className="error">Duplicate image</p>}
            </div>
          ))}
        </div>

        {canModerate && (
          <div className="moderation">
            <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button
              disabled={!!busyAction}
              className={busyAction === "present" ? "btn-loading" : ""}
              onClick={() => setAttendance(true)}
            >
              <span className="btn-label">Mark Present</span>
              {busyAction === "present" && <span className="btn-spinner" />}
            </button>
            <button disabled={!!busyAction} className={busyAction === "flag" ? "btn-loading" : ""} onClick={() => setStatus("flagged")}>
              <span className="btn-label">Flag</span>
              {busyAction === "flag" && <span className="btn-spinner" />}
            </button>
            <button
              disabled={!!busyAction}
              className={busyAction === "absent" ? "btn-loading" : ""}
              onClick={() => setAttendance(false)}
            >
              <span className="btn-label">Mark Absent</span>
              {busyAction === "absent" && <span className="btn-spinner" />}
            </button>
          </div>
        )}
      </div>

      {previewImage && (
        <div
          className="lightbox-backdrop"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewImage(null);
          }}
        >
          <button
            className="lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImage(null);
            }}
            aria-label="Close preview"
          >
            ×
          </button>
          <img src={previewImage} alt="Full preview" className="lightbox-image" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
