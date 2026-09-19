import { useState } from "react";

export default function MonitoringVisitDetail({ visit, onClose }) {
  const [previewImage, setPreviewImage] = useState(null);

  if (!visit) return null;

  const images = visit.images || [];

  function formatMapEntries(mapObj) {
    if (!mapObj) return [];
    if (typeof mapObj.entries === "function") {
      return Array.from(mapObj.entries());
    }
    return Object.entries(mapObj);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "850px", width: "90%" }}>
        <div className="modal-scroll card">
          <div className="modal-header">
            <div>
              <h2>Monitoring Visit Checklist (DCMO)</h2>
              <p className="modal-subtitle">
                {visit.district?.name} &bull; {visit.facility?.name} &bull; UC/Village: {visit.ucVillage}
              </p>
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", margin: "12px 0", flexWrap: "wrap" }}>
            <span
              style={{
                backgroundColor: visit.scorePercentage >= 80 ? "#2e7d32" : visit.scorePercentage >= 60 ? "#ed6c02" : "#d32f2f",
                color: "#fff",
                padding: "4px 12px",
                borderRadius: "16px",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              Score: {visit.scorePercentage}%
            </span>
            <span
              className={`status-badge ${
                visit.status === "reviewed" ? "status-present" : "status-flagged"
              }`}
            >
              {visit.status === "reviewed" ? "Reviewed by TL/DTL" : "Pending Review"}
            </span>
          </div>

          {/* Section: Basic Metadata */}
          <div className="detail-grid" style={{ marginBottom: "16px" }}>
            <div className="detail-row">
              <span className="detail-label">District Coordinator</span>
              <span className="detail-value">{visit.coordinator?.name || visit.dcmoName}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Target Social Mobilizer(s)</span>
              <span className="detail-value">
                {visit.targetMobilizer?.name}
                {visit.targetMobilizer2 ? ` & ${visit.targetMobilizer2.name}` : ""}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Date & Time</span>
              <span className="detail-value">{new Date(visit.dateTime).toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Observed Activity</span>
              <span className="detail-value">{visit.activityObserved}</span>
            </div>
          </div>

          {/* Section 2 & 3: Preparation & Session Delivery */}
          <div className="form-grid-2" style={{ marginBottom: "16px" }}>
            <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "12px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#1976d2" }}>Preparation &amp; Logistics</h4>
              {formatMapEntries(visit.prepLogistics).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "3px 0", gap: "8px" }}>
                  <span>{k}</span>
                  <strong style={{ color: v === "Yes" ? "#2e7d32" : v === "No" ? "#d32f2f" : "#666" }}>{v}</strong>
                </div>
              ))}
            </div>

            <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "12px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#1976d2" }}>Session Delivery &amp; Quality</h4>
              {formatMapEntries(visit.sessionDelivery).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "3px 0", gap: "8px" }}>
                  <span>{k}</span>
                  <strong style={{ color: v === "Yes" ? "#2e7d32" : v === "No" ? "#d32f2f" : "#666" }}>{v}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Attendance & Inclusion */}
          <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#1976d2" }}>Attendance &amp; Inclusion</h4>
            <div className="detail-grid">
              <div className="detail-row">
                <span className="detail-label">Register Completed</span>
                <span className="detail-value">{visit.attendanceInclusion?.registerCompleted}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Total Participants</span>
                <span className="detail-value">{visit.attendanceInclusion?.totalParticipants || 0}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Female Participants</span>
                <span className="detail-value">{visit.attendanceInclusion?.femaleParticipants || 0}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">&ge; 50% Female Participation</span>
                <span className="detail-value">{visit.attendanceInclusion?.femaleParticipation50Pct}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Vulnerable Groups Present</span>
                <span className="detail-value">{visit.attendanceInclusion?.vulnerableGroupsPresent}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Separate Arrangements for Women</span>
                <span className="detail-value">{visit.attendanceInclusion?.separateArrangementsWomen}</span>
              </div>
            </div>
          </div>

          {/* Section 5: Safeguarding & Staff Conduct */}
          <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#1976d2" }}>Safeguarding &amp; Staff Conduct</h4>
            {formatMapEntries(visit.safeguardingConduct).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "3px 0", gap: "8px" }}>
                <span>{k}</span>
                <strong style={{ color: v === "Yes" ? "#2e7d32" : v === "No" ? "#d32f2f" : "#666" }}>{v}</strong>
              </div>
            ))}
          </div>

          {/* Section 6 & 7: Activity Specific & GRM */}
          <div className="form-grid-2" style={{ marginBottom: "16px" }}>
            <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "12px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#1976d2" }}>
                Activity Checklist ({visit.activitySpecificType || "Specific"})
              </h4>
              {formatMapEntries(visit.activitySpecificChecklist).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "3px 0", gap: "8px" }}>
                  <span>{k}</span>
                  <strong style={{ color: v ? "#2e7d32" : "#d32f2f" }}>{v ? "Yes / Met" : "No / Unmet"}</strong>
                </div>
              ))}
            </div>

            <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "12px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#1976d2" }}>GRM Check</h4>
              <div style={{ fontSize: "13px" }}>
                <p>GRM Box Present: <strong>{visit.grmCheck?.boxPresent}</strong></p>
                <p>Members Aware: <strong>{visit.grmCheck?.membersAware}</strong></p>
                <p>Complaint Raised: <strong>{visit.grmCheck?.complaintRaised}</strong></p>
                {visit.grmCheck?.complaintNotes && (
                  <p>Notes: <em>{visit.grmCheck.complaintNotes}</em></p>
                )}
              </div>
            </div>
          </div>

          {/* Section 8: Evidence Collected & Photos */}
          <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#1976d2" }}>Evidence Collected & Photos</h4>
            {visit.evidenceCollected && visit.evidenceCollected.length > 0 && (
              <div style={{ marginBottom: "12px", fontSize: "13px" }}>
                <strong>Verified Evidence:</strong> {visit.evidenceCollected.join(", ")}
              </div>
            )}
            <div className="photo-grid">
              {images.map((img) => (
                <div key={img._id} className="photo-card">
                  <img
                    src={img.fileUrl}
                    alt="monitoring evidence"
                    className="photo-thumb"
                    onClick={() => setPreviewImage(img.fileUrl)}
                  />
                  <p>Uploaded: {new Date(img.createdAt || img.uploadTimestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 9: Overall Rating & Observations */}
          <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#1976d2" }}>Overall Rating & Observations</h4>
            <div className="detail-grid">
              <div className="detail-row">
                <span className="detail-label">Rating</span>
                <span className="detail-value" style={{ fontWeight: "bold" }}>{visit.overallRating}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Key Strengths</span>
                <span className="detail-value">{visit.keyStrengths || "N/A"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Key Gaps / Weaknesses</span>
                <span className="detail-value">{visit.keyGaps || "N/A"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Corrective Action</span>
                <span className="detail-value">{visit.correctiveActionRequired} {visit.correctiveActionDetails && `(${visit.correctiveActionDetails})`}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Follow-up By / Due</span>
                <span className="detail-value">{visit.followUpBy || "N/A"} / {visit.followUpDueDate || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Section 10: Certification */}
          <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#1976d2" }}>Certification & Sign-off</h4>
            <p style={{ margin: 0, fontSize: "13px" }}>
              Signed off by <strong>{visit.dcmoName}</strong> on{" "}
              {new Date(visit.signOffDate).toLocaleDateString()}
            </p>
          </div>

          {/* Section 11: TL / DTL Reviewer Verification */}
          {((visit.reviews && visit.reviews.length > 0) || visit.status === "reviewed") && (
            <div style={{ border: "2px solid #2e7d32", borderRadius: "8px", padding: "14px", backgroundColor: "#f1f8e9" }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#2e7d32" }}>TL / DTL Reviewer Verification</h3>

              {visit.reviews && visit.reviews.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {visit.reviews.map((r, idx) => (
                    <div
                      key={r._id || idx}
                      style={{
                        border: "1px solid #c8e6c9",
                        borderRadius: "6px",
                        padding: "12px",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <h4 style={{ margin: "0 0 8px 0", color: "#1b5e20", fontSize: "14px" }}>
                        Reviewer #{idx + 1}: {r.reviewerName}
                      </h4>
                      <div className="detail-grid">
                        <div className="detail-row">
                          <span className="detail-label">Reviewer Name</span>
                          <span className="detail-value">{r.reviewerName}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Review Date</span>
                          <span className="detail-value">{new Date(r.reviewDate).toLocaleDateString()}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Accepted / Complete</span>
                          <span
                            className="detail-value"
                            style={{
                              fontWeight: "bold",
                              color: r.acceptedComplete === "Yes" ? "#2e7d32" : "#d32f2f",
                            }}
                          >
                            {r.acceptedComplete}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Reviewer Remarks</span>
                          <span className="detail-value">{r.reviewerRemarks}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="detail-grid">
                  <div className="detail-row">
                    <span className="detail-label">Reviewer Name</span>
                    <span className="detail-value">{visit.reviewerName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Review Date</span>
                    <span className="detail-value">{visit.reviewDate ? new Date(visit.reviewDate).toLocaleDateString() : "N/A"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Accepted / Complete</span>
                    <span className="detail-value" style={{ fontWeight: "bold", color: visit.acceptedComplete === "Yes" ? "#2e7d32" : "#d32f2f" }}>
                      {visit.acceptedComplete}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Reviewer Remarks</span>
                    <span className="detail-value">{visit.reviewerRemarks}</span>
                  </div>
                </div>
              )}
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
