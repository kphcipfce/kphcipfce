import { useEffect, useState } from "react";
import api from "../api/client";
import { useToast } from "../context/ToastContext";

// Mirrors ActivityDetail.jsx's layout for a District Coordinator's own activity record —
// simpler than a social mobilizer's: no team, no attendance list (one person per district),
// just a straightforward verify/flag review.
export default function CoordinatorActivityDetail({ activityId, onClose, onStatusChanged, canModerate }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [reason, setReason] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [busyAction, setBusyAction] = useState(null); // "verify" | "flag" | null

  useEffect(() => {
    api.get(`/coordinator-activities/${activityId}`).then((res) => setData(res.data));
  }, [activityId]);

  async function setStatus(status) {
    setBusyAction(status === "flagged" ? "flag" : "verify");
    try {
      await api.patch(`/coordinator-activities/${activityId}/status`, { status, statusReason: reason });
      const res = await api.get(`/coordinator-activities/${activityId}`);
      setData(res.data);
      showToast("success", status === "flagged" ? "Record flagged" : "Record verified");
      onStatusChanged?.();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to update record");
    } finally {
      setBusyAction(null);
    }
  }

  if (!data) return null;
  const { activity, images } = data;
  const statusClassName = activity.status === "flagged" ? "status-flagged" : activity.status === "verified" ? "status-present" : "";

  const details = [
    ["Refresher training", activity.isRefresher ? "Yes" : "No"],
    ["Health Facility / Community", activity.facility ? `${activity.facility.name} (${activity.facility.category})` : ""],
    ["Planned Activity", activity.plannedActivity],
    ["Responsible Person", activity.responsiblePerson],
    ["Target Group", activity.targetGroup],
    ["Expected Output", activity.expectedOutput],
    ["Visit Status", activity.visitStatus],
    activity.description && ["Remarks / Follow-up", activity.description],
  ].filter(Boolean);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-scroll card">
          <div className="modal-header">
            <div>
              <h2>{activity.activityType}</h2>
              <p className="modal-subtitle">
                {new Date(activity.dateTime).toLocaleString()} — {activity.submittedBy?.name} / {activity.district?.name}
              </p>
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <div>
            <span className={`status-badge ${statusClassName}`}>{activity.status}</span>
            {activity.statusReason && <span className="status-reason">{activity.statusReason}</span>}
          </div>

          <div className="detail-grid">
            {details.map(([label, value]) => (
              <div className="detail-row" key={label}>
                <span className="detail-label">{label}</span>
                <span className="detail-value">{value}</span>
              </div>
            ))}
          </div>

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
              <button disabled={!!busyAction} className={busyAction === "verify" ? "btn-loading" : ""} onClick={() => setStatus("verified")}>
                <span className="btn-label">Verify</span>
                {busyAction === "verify" && <span className="btn-spinner" />}
              </button>
              <button disabled={!!busyAction} className={busyAction === "flag" ? "btn-loading" : ""} onClick={() => setStatus("flagged")}>
                <span className="btn-label">Flag</span>
                {busyAction === "flag" && <span className="btn-spinner" />}
              </button>
            </div>
          )}
        </div>
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
