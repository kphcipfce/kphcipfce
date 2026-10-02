import { useState } from "react";
import api from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { KAP_QUESTIONNAIRE, KAP_THEMES } from "../utils/kapQuestionnaire";

export default function KapSurveyDetail({ survey: initialSurvey, onClose, onReviewUpdated }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [survey, setSurvey] = useState(initialSurvey);
  const [reviewerName, setReviewerName] = useState(user?.name || "");
  const [acceptedComplete, setAcceptedComplete] = useState("Yes");
  const [reviewerRemarks, setReviewerRemarks] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const canReview = user?.role === "tl_reviewer" || user?.role === "super_admin";

  const categoryQuestions = KAP_QUESTIONNAIRE[survey.respondentCategory] || KAP_QUESTIONNAIRE.Community;

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!reviewerName.trim() || !reviewerRemarks.trim()) {
      showToast("error", "Reviewer Name and Remarks are required");
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await api.put(`/kap-surveys/${survey._id}/review`, {
        reviewerName: reviewerName.trim(),
        reviewDate: new Date(),
        acceptedComplete,
        reviewerRemarks: reviewerRemarks.trim(),
      });
      setSurvey(res.data);
      showToast("success", "KAP Survey review submitted successfully");
      if (onReviewUpdated) onReviewUpdated(res.data);
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px", width: "95%" }}>
        <div className="modal-scroll card">
          <div className="modal-header">
            <div>
              <h2>KAP Survey Details</h2>
              <p className="modal-subtitle">
                Survey Type: <strong>{survey.respondentCategory}</strong> | Sex: <strong>{survey.respondentSex}</strong> | District: <strong>{survey.district?.name}</strong>
              </p>
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Close modal">
              ×
            </button>
          </div>

          {/* Header Metadata */}
          <div className="detail-grid">
            <div className="detail-row">
              <span className="detail-label">Facility</span>
              <span className="detail-value">{survey.facility?.name} ({survey.facility?.category})</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Submitted By</span>
              <span className="detail-value">{survey.submittedBy?.name} ({survey.submittedByRole === "district_viewer" ? "District Coordinator" : "Social Mobilizer"})</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Date & Time</span>
              <span className="detail-value">{new Date(survey.dateTime).toLocaleString("en-GB")}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Positive Score</span>
              <span className="status-badge status-present" style={{ fontWeight: "bold" }}>
                {survey.scorePercentage}% Positive
              </span>
            </div>
          </div>

          {/* Theme-wise Responses */}
          <div style={{ marginTop: "1rem" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Questionnaire Responses</h3>
            {KAP_THEMES.map((theme) => {
              const themeQs = categoryQuestions.filter((q) => q.themeId === theme.id);
              if (themeQs.length === 0) return null;

              return (
                <div key={theme.id} className="card" style={{ marginBottom: "1rem", background: "#fcfcfc" }}>
                  <h4 style={{ color: "#006644", margin: "0 0 0.5rem" }}>
                    {theme.titleEn}
                    <div style={{ fontSize: "0.85rem", color: "#555", fontWeight: "normal", direction: "rtl", textAlign: "right" }}>{theme.titleUr}</div>
                  </h4>

                  {themeQs.map((q) => {
                    const ans = survey.responses?.[q.id];
                    let displayAns = ans;
                    if (Array.isArray(ans)) {
                      displayAns = ans.length > 0 ? ans.join(", ") : "None selected";
                    } else if (!ans) {
                      displayAns = "Not answered / Skipped";
                    }

                    return (
                      <div key={q.id}>
                        {q.section && (
                          <div style={{ background: "#e8f4f0", padding: "0.4rem 0.6rem", borderRadius: "4px", fontWeight: "bold", color: "#006644", marginTop: "0.75rem", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
                            {q.section}
                          </div>
                        )}
                        <div style={{ borderBottom: "1px solid #eee", padding: "0.5rem 0" }}>
                          <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                            {q.code}: {q.textEn}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "#444", direction: "rtl", textAlign: "right" }}>
                            {q.textUr}
                          </div>
                          <div style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}>
                            <span style={{ color: "#666" }}>Answer: </span>
                            <span className="status-badge status-present" style={{ fontSize: "0.85rem" }}>{displayAns}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Existing Reviews List */}
          {Array.isArray(survey.reviews) && survey.reviews.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Evaluator Reviews &amp; Verification History</h3>
              {survey.reviews.map((r, idx) => (
                <div key={r._id || idx} className="card" style={{ marginBottom: "0.75rem", background: "#f8f9fa" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <strong>Reviewer: {r.reviewerName}</strong>
                    <span style={{ fontSize: "0.8rem", color: "#666" }}>
                      {new Date(r.reviewDate || r.reviewedAt).toLocaleString("en-GB")}
                    </span>
                  </div>
                  <div>
                    <span>Validation Status: </span>
                    <span className={`status-badge ${r.acceptedComplete === "Yes" ? "status-present" : "status-absent"}`}>
                      {r.acceptedComplete === "Yes" ? "Accepted / Valid" : "Action Required"}
                    </span>
                  </div>
                  <p style={{ marginTop: "0.5rem", fontStyle: "italic", background: "#fff", padding: "0.5rem", borderRadius: "4px", margin: "0.5rem 0 0" }}>
                    "{r.reviewerRemarks}"
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Review Form for TL / DTL / Admin */}
          {canReview && (
            <form className="card" onSubmit={handleReviewSubmit} style={{ marginTop: "1rem", background: "#f0f7f4", border: "1px solid #c2e0d3" }}>
              <h3 style={{ margin: 0 }}>TL / DTL Independent Verification Review</h3>
              <div className="date-time-row">
                <label>
                  Reviewer Name
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Validation Status
                  <select value={acceptedComplete} onChange={(e) => setAcceptedComplete(e.target.value)}>
                    <option value="Yes">Yes (Accepted / Complete)</option>
                    <option value="No">No (Incomplete / Needs Correction)</option>
                    <option value="N/A">N/A</option>
                  </select>
                </label>
              </div>

              <label>
                Reviewer Remarks &amp; Verification Notes
                <textarea
                  rows={3}
                  value={reviewerRemarks}
                  onChange={(e) => setReviewerRemarks(e.target.value)}
                  placeholder="Enter evaluation remarks..."
                  required
                />
              </label>

              <button type="submit" disabled={submittingReview} className={submittingReview ? "btn-loading" : ""}>
                <span className="btn-label">Submit Verification Review</span>
                {submittingReview && <span className="btn-spinner" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
