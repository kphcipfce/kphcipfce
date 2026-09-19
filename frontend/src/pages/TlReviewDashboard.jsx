import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Spinner from "../components/Spinner";
import MonitoringVisitDetail from "../components/MonitoringVisitDetail";

export default function TlReviewDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "reviewed" | "all"

  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Review Form state
  const [reviewerName, setReviewerName] = useState(user?.name || "TL Reviewer");
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().split("T")[0]);
  const [acceptedComplete, setAcceptedComplete] = useState("Yes");
  const [reviewerRemarks, setReviewerRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVisits();
  }, []);

  async function fetchVisits() {
    try {
      setLoading(true);
      const res = await api.get("/monitoring-visits");
      setVisits(res.data);
    } catch (err) {
      showToast("error", "Failed to load monitoring visit records");
    } finally {
      setLoading(false);
    }
  }

  function getReviewForUser(visit) {
    if (!visit || !user) return null;
    const reviews = visit.reviews || [];
    return reviews.find(
      (r) =>
        String(r.reviewedBy) === String(user._id) ||
        (r.reviewerName && user.name && r.reviewerName.toLowerCase().includes(user.name.toLowerCase()))
    );
  }

  function openReviewModal(visit) {
    setSelectedVisit(visit);
    const existing = getReviewForUser(visit);
    setReviewerName(user?.name || "TL Reviewer");
    setReviewDate(
      existing?.reviewDate
        ? new Date(existing.reviewDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    );
    setAcceptedComplete(existing?.acceptedComplete || "Yes");
    setReviewerRemarks(existing?.reviewerRemarks || "");
    setShowReviewModal(true);
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!selectedVisit) return;
    if (!reviewerRemarks.trim()) {
      showToast("error", "Reviewer remarks are required");
      return;
    }

    try {
      setSubmitting(true);
      await api.patch(`/monitoring-visits/${selectedVisit._id}/review`, {
        reviewerName,
        reviewDate,
        acceptedComplete,
        reviewerRemarks,
      });

      showToast("success", "Monitoring Visit Review submitted successfully!");
      setShowReviewModal(false);
      setSelectedVisit(null);
      fetchVisits();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  const pendingVisits = visits.filter((v) => !getReviewForUser(v));
  const myReviewedVisits = visits.filter((v) => !!getReviewForUser(v));

  const filteredVisits = visits.filter((v) => {
    if (activeTab === "pending") return !getReviewForUser(v);
    if (activeTab === "reviewed") return !!getReviewForUser(v);
    return true;
  });

  if (loading) return <Spinner />;

  return (
    <div className="page">
      <h1>TL / DTL Review Dashboard</h1>
      <p className="page-subtitle">Inspect submitted DCMO Monitoring Visit Checklists and provide TL/DTL review sign-offs</p>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Pending My Review ({pendingVisits.length})
        </button>
        <button
          className={`tab ${activeTab === "reviewed" ? "active" : ""}`}
          onClick={() => setActiveTab("reviewed")}
        >
          My Reviewed Records ({myReviewedVisits.length})
        </button>
        <button
          className={`tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All Records ({visits.length})
        </button>
      </div>

      <div className="card">
        <h2>{activeTab === "pending" ? "Pending My Review" : activeTab === "reviewed" ? "My Reviewed Records" : "All Monitoring Visits"}</h2>
        {filteredVisits.length === 0 ? (
          <p>No records found in this view.</p>
        ) : (
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
                  <th>My Review</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisits.map((v) => {
                  const myRev = getReviewForUser(v);
                  const totalReviews = (v.reviews || []).length;
                  return (
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
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            {v.reviews.map((r, i) => (
                              <span
                                key={i}
                                className={`status-badge ${
                                  r.acceptedComplete === "Yes" ? "status-present" : "status-absent"
                                }`}
                                style={{ fontSize: "11px", padding: "2px 6px", whiteSpace: "nowrap" }}
                              >
                                {r.reviewerName}: {r.acceptedComplete}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="status-badge status-flagged">Pending</span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions-cell">
                          <button className="btn-secondary" onClick={() => setSelectedVisit(v)}>
                            Inspect Checklist
                          </button>
                          <button className="btn-primary" onClick={() => openReviewModal(v)}>
                            {myRev ? "Edit My Review" : "Review & Approve"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Checklist Details Modal */}
      {selectedVisit && !showReviewModal && (
        <MonitoringVisitDetail visit={selectedVisit} onClose={() => setSelectedVisit(null)} />
      )}

      {/* Review Modal */}
      {showReviewModal && selectedVisit && (
        <div className="modal-backdrop" onClick={() => setShowReviewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px", width: "90%" }}>
            <div className="modal-scroll card">
              <div className="modal-header">
                <h2>TL / DTL Review &amp; Remarks</h2>
                <button className="modal-close" onClick={() => setShowReviewModal(false)} aria-label="Close">
                  ×
                </button>
              </div>

              <div style={{ marginBottom: "16px", background: "#f8f9fa", padding: "12px", borderRadius: "6px" }}>
                <p style={{ margin: "0 0 4px 0" }}>
                  <strong>District:</strong> {selectedVisit.district?.name} &bull; <strong>Facility:</strong> {selectedVisit.facility?.name}
                </p>
                <p style={{ margin: "0 0 4px 0" }}>
                  <strong>Coordinator:</strong> {selectedVisit.coordinator?.name || selectedVisit.dcmoName} &bull; <strong>Score:</strong> {selectedVisit.scorePercentage}%
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Observed Activity:</strong> {selectedVisit.activityObserved}
                </p>
              </div>

              <form onSubmit={handleReviewSubmit}>
                <div style={{ marginBottom: "14px" }}>
                  <label>Reviewer Name *</label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label>Review Date *</label>
                  <input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label>Accepted / Complete? *</label>
                  <select
                    value={acceptedComplete}
                    onChange={(e) => setAcceptedComplete(e.target.value)}
                    required
                  >
                    <option value="Yes">Yes (Accepted)</option>
                    <option value="No">No (Needs Revision)</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label>Reviewer Remarks &amp; Feedback *</label>
                  <textarea
                    rows="4"
                    value={reviewerRemarks}
                    onChange={(e) => setReviewerRemarks(e.target.value)}
                    placeholder="Provide thorough review notes, observations, or action points"
                    required
                  />
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="submit" disabled={submitting} className="btn-primary" style={{ flex: 1 }}>
                    {submitting ? "Submitting Review..." : "Submit Review"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setShowReviewModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
