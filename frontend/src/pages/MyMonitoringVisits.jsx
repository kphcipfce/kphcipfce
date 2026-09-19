import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Spinner from "../components/Spinner";
import MonitoringVisitDetail from "../components/MonitoringVisitDetail";
import { compressImage } from "../utils/compressImage";

const PREP_LOGISTICS_ITEMS = [
  "Session plan available & followed",
  "Venue appropriate, accessible & safe",
  "IEC materials displayed/distributed",
  "Audio/Visual equipment functional",
  "Prior information given to community",
];

const SESSION_DELIVERY_ITEMS = [
  "Clear opening & introductions",
  "Key messages delivered accurately",
  "Participatory methods used",
  "Culturally appropriate language",
  "Addressed questions effectively",
  "Concluded with summary & call to action",
];

const SAFEGUARDING_ITEMS = [
  "Code of conduct respected",
  "Respectful behavior towards community",
  "No political or sensitive propaganda",
  "Informed consent obtained for photos",
];

const EVIDENCE_OPTIONS = [
  "Attendance List",
  "Photos",
  "Handouts / IEC Material",
  "Session Plan",
  "Feedback Forms",
];

const ACTIVITY_TYPES_CHECKLISTS = {
  "Community engagement session": [
    "Target community members actively engaged",
    "Interactive Q&A session conducted",
    "Community feedback and concerns documented",
    "IEC materials handed out to participants",
  ],
  "Behavioural change and communication campaign": [
    "BCC key messages clearly demonstrated",
    "Visual aids/posters/banners displayed",
    "Behavioral change indicators explained",
    "Community pledge/commitment secured",
  ],
  "Wash and health hygiene in schools": [
    "School children engaged in handwashing demonstration",
    "Hygiene kits/soaps distributed",
    "Clean water and sanitation facilities checked",
    "Teacher/School management orientation done",
  ],
  "Environmental awareness & HCWM": [
    "Healthcare waste segregation practice inspected",
    "Color-coded waste bins available and labeled",
    "PPE usage by health staff verified",
    "Environmental hazard awareness briefed",
  ],
  "SEA/SH": [
    "SEA/SH awareness and reporting channels briefed",
    "Confidential reporting mechanisms explained",
    "Code of Conduct against SEA/SH emphasized",
    "Safe space and survivor support guidance provided",
  ],
  "GRM Awareness & Orientation": [
    "Grievance submission process explained",
    "GRM box location and accessibility verified",
    "GRM Focal Person contact shared",
    "Anonymity and non-retaliation assurances given",
  ],
  "Other / Custom Activity": [
    "Objectives of session clearly defined",
    "Participant attendance sheet verified",
    "Relevant materials distributed",
    "Follow-up action points agreed",
  ],
};

export default function MyMonitoringVisits() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [plans, setPlans] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");

  // Form State
  const [facilityId, setFacilityId] = useState("");
  const [ucVillage, setUcVillage] = useState("");
  const defaultActivityType = "Community engagement session";
  const [activityObserved, setActivityObserved] = useState(defaultActivityType);

  const [prepLogistics, setPrepLogistics] = useState({});
  const [sessionDelivery, setSessionDelivery] = useState({});
  const [safeguarding, setSafeguarding] = useState({});

  const [attendanceInclusion, setAttendanceInclusion] = useState({
    registerCompleted: "Yes",
    totalParticipants: 0,
    femaleParticipants: 0,
    femaleParticipation50Pct: "Yes",
    vulnerableGroupsPresent: "Yes",
    separateArrangementsWomen: "Yes",
  });

  const [activitySpecificType, setActivitySpecificType] = useState(defaultActivityType);
  const [activityChecklist, setActivityChecklist] = useState(() => {
    const initial = {};
    (ACTIVITY_TYPES_CHECKLISTS[defaultActivityType] || []).forEach((item) => (initial[item] = true));
    return initial;
  });

  function handleActivityObservedChange(type) {
    setActivityObserved(type);
    setActivitySpecificType(type);
    const items = ACTIVITY_TYPES_CHECKLISTS[type] || [];
    const updatedChecklist = {};
    items.forEach((item) => (updatedChecklist[item] = true));
    setActivityChecklist(updatedChecklist);
  }

  const [grmCheck, setGrmCheck] = useState({
    boxPresent: "Yes",
    membersAware: "Yes",
    complaintRaised: "No",
    complaintNotes: "",
  });

  const [evidenceCollected, setEvidenceCollected] = useState([
    "Attendance List",
    "Photos",
  ]);

  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);

  const [overallRating, setOverallRating] = useState("Good");
  const [keyStrengths, setKeyStrengths] = useState("");
  const [keyGaps, setKeyGaps] = useState("");
  const [correctiveActionRequired, setCorrectiveActionRequired] = useState("No");
  const [correctiveActionDetails, setCorrectiveActionDetails] = useState("");
  const [followUpBy, setFollowUpBy] = useState("");
  const [followUpDueDate, setFollowUpDueDate] = useState("");

  const [dcmoName, setDcmoName] = useState(user?.name || "");
  const [signOffDate, setSignOffDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [plansRes, facRes] = await Promise.all([
        api.get("/monitoring-plans"),
        api.get("/facilities"),
      ]);
      setPlans(plansRes.data);
      setFacilities(facRes.data);

      // Initialize radio defaults
      const pDefaults = {};
      PREP_LOGISTICS_ITEMS.forEach((item) => (pDefaults[item] = "Yes"));
      setPrepLogistics(pDefaults);

      const sDefaults = {};
      SESSION_DELIVERY_ITEMS.forEach((item) => (sDefaults[item] = "Yes"));
      setSessionDelivery(sDefaults);

      const sgDefaults = {};
      SAFEGUARDING_ITEMS.forEach((item) => (sgDefaults[item] = "Yes"));
      setSafeguarding(sgDefaults);
    } catch (err) {
      showToast("error", "Failed to load monitoring data");
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setPhotos(files);
    const previews = files.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(previews);
  }

  const selectedPlanObj = plans.find((p) => String(p._id) === selectedPlan);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!selectedPlan || !selectedWeek) {
      showToast("error", "Please select an assigned plan and week");
      return;
    }
    if (!facilityId || !ucVillage) {
      showToast("error", "Facility and UC/Village are required");
      return;
    }
    if (photos.length < 3) {
      showToast("error", "Minimum 3 photos are required for evidence");
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();

      // Compress photos before upload
      for (const file of photos) {
        const compressed = await compressImage(file);
        formData.append("photos", compressed);
      }

      const payload = {
        district: selectedPlanObj.district?._id || selectedPlanObj.district,
        facility: facilityId,
        ucVillage,
        targetMobilizer: selectedPlanObj.targetMobilizer?._id || selectedPlanObj.targetMobilizer,
        plan: selectedPlan,
        planWeek: selectedWeek,
        dateTime: new Date().toISOString(),
        activityObserved,
        prepLogistics,
        sessionDelivery,
        attendanceInclusion,
        safeguardingConduct: safeguarding,
        activitySpecificType,
        activitySpecificChecklist: activityChecklist,
        grmCheck,
        evidenceCollected,
        overallRating,
        keyStrengths,
        keyGaps,
        correctiveActionRequired,
        correctiveActionDetails,
        followUpBy,
        followUpDueDate,
        dcmoName,
        signOffDate,
      };

      formData.append("data", JSON.stringify(payload));

      await api.post("/monitoring-visits", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      showToast("success", "Monitoring Visit Checklist submitted successfully!");
      setSelectedPlan("");
      setSelectedWeek("");
      setPhotos([]);
      setPhotoPreviews([]);
      fetchData();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to submit monitoring visit");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="page">
      <h1>District Coordinator Monitoring Visits</h1>
      <p className="page-subtitle">Submit and track DCMO Monitoring Visit Checklists</p>

      {/* Section 1: Submit New Checklist Form */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <h2>Submit New DCMO Checklist</h2>
        <form onSubmit={handleSubmit}>
          {/* Plan Selection */}
          <div className="form-grid" style={{ marginBottom: "16px" }}>
            <div>
              <label>Select Assigned Monitoring Plan *</label>
              <select
                value={selectedPlan}
                onChange={(e) => {
                  setSelectedPlan(e.target.value);
                  setSelectedWeek("");
                }}
                required
              >
                <option value="">-- Choose Plan --</option>
                {plans
                  .filter((p) => (p.weeks || []).length > 0)
                  .map((p) => {
                    const hasSecond =
                      p.targetMobilizer2 &&
                      String(p.targetMobilizer2._id || p.targetMobilizer2) !==
                        String(p.targetMobilizer?._id || p.targetMobilizer);
                    const mobilizersLabel = hasSecond
                      ? `${p.targetMobilizer?.name} & ${p.targetMobilizer2?.name}`
                      : p.targetMobilizer?.name || "—";
                    return (
                      <option key={p._id} value={p._id}>
                        {p.district?.name} - Mobilizer(s): {mobilizersLabel} ({p.month}/{p.year})
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <label>Select Planned Week *</label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                disabled={!selectedPlanObj || (selectedPlanObj.weeks || []).length === 0}
                required
              >
                <option value="">-- Choose Week --</option>
                {(selectedPlanObj?.weeks || []).map((w) => (
                  <option key={w._id} value={w._id}>
                    Week {w.weekNumber}: {new Date(w.date).toLocaleDateString()} ({w.dayOfWeek})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedWeek && (
            <>
              {/* Header Info */}
              <div className="form-grid" style={{ marginBottom: "16px" }}>
                <div>
                  <label>Health Facility *</label>
                  <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)} required>
                    <option value="">-- Select Facility --</option>
                    {facilities.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.name} ({f.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>UC / Village *</label>
                  <input
                    type="text"
                    value={ucVillage}
                    onChange={(e) => setUcVillage(e.target.value)}
                    placeholder="Enter UC or Village name"
                    required
                  />
                </div>

                <div>
                  <label>Observed Activity Type *</label>
                  <select
                    value={activityObserved}
                    onChange={(e) => handleActivityObservedChange(e.target.value)}
                    required
                  >
                    {Object.keys(ACTIVITY_TYPES_CHECKLISTS).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section 2: Preparation & Logistics */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "16px", borderRadius: "8px", marginBottom: "20px", background: "#ffffff" }}>
                <legend style={{ fontWeight: "bold", color: "var(--primary)", padding: "0 6px" }}>Section 2: Preparation &amp; Logistics</legend>
                {PREP_LOGISTICS_ITEMS.map((item) => (
                  <div key={item} className="checklist-row">
                    <span style={{ fontSize: "14px", fontWeight: "500" }}>{item}</span>
                    <div className="checklist-options">
                      {["Yes", "No", "N/A"].map((opt) => (
                        <label key={opt} style={{ cursor: "pointer", fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <input
                            type="radio"
                            name={`prep_${item}`}
                            value={opt}
                            checked={prepLogistics[item] === opt}
                            onChange={() => setPrepLogistics({ ...prepLogistics, [item]: opt })}
                          />{" "}
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>

              {/* Section 3: Session Delivery & Quality */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "16px", borderRadius: "8px", marginBottom: "20px", background: "#ffffff" }}>
                <legend style={{ fontWeight: "bold", color: "var(--primary)", padding: "0 6px" }}>Section 3: Session Delivery &amp; Quality</legend>
                {SESSION_DELIVERY_ITEMS.map((item) => (
                  <div key={item} className="checklist-row">
                    <span style={{ fontSize: "14px", fontWeight: "500" }}>{item}</span>
                    <div className="checklist-options">
                      {["Yes", "No", "N/A"].map((opt) => (
                        <label key={opt} style={{ cursor: "pointer", fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <input
                            type="radio"
                            name={`session_${item}`}
                            value={opt}
                            checked={sessionDelivery[item] === opt}
                            onChange={() => setSessionDelivery({ ...sessionDelivery, [item]: opt })}
                          />{" "}
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>

              {/* Section 4: Attendance & Inclusion */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "16px", borderRadius: "8px", marginBottom: "20px", background: "#ffffff" }}>
                <legend style={{ fontWeight: "bold", color: "var(--primary)", padding: "0 6px" }}>Section 4: Attendance &amp; Inclusion</legend>
                <div className="form-grid">
                  <div>
                    <label>Register Completed?</label>
                    <select
                      value={attendanceInclusion.registerCompleted}
                      onChange={(e) => setAttendanceInclusion({ ...attendanceInclusion, registerCompleted: e.target.value })}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label>Total Participants</label>
                    <input
                      type="number"
                      min="0"
                      value={attendanceInclusion.totalParticipants}
                      onChange={(e) => setAttendanceInclusion({ ...attendanceInclusion, totalParticipants: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label>Female Participants</label>
                    <input
                      type="number"
                      min="0"
                      value={attendanceInclusion.femaleParticipants}
                      onChange={(e) => setAttendanceInclusion({ ...attendanceInclusion, femaleParticipants: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label>&ge; 50% Female Participation?</label>
                    <select
                      value={attendanceInclusion.femaleParticipation50Pct}
                      onChange={(e) => setAttendanceInclusion({ ...attendanceInclusion, femaleParticipation50Pct: e.target.value })}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label>Vulnerable Groups Present?</label>
                    <select
                      value={attendanceInclusion.vulnerableGroupsPresent}
                      onChange={(e) => setAttendanceInclusion({ ...attendanceInclusion, vulnerableGroupsPresent: e.target.value })}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label>Separate Arrangements for Women?</label>
                    <select
                      value={attendanceInclusion.separateArrangementsWomen}
                      onChange={(e) => setAttendanceInclusion({ ...attendanceInclusion, separateArrangementsWomen: e.target.value })}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Section 5: Safeguarding & Staff Conduct */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "16px", borderRadius: "8px", marginBottom: "20px", background: "#ffffff" }}>
                <legend style={{ fontWeight: "bold", color: "var(--primary)", padding: "0 6px" }}>Section 5: Safeguarding &amp; Staff Conduct</legend>
                {SAFEGUARDING_ITEMS.map((item) => (
                  <div key={item} className="checklist-row">
                    <span style={{ fontSize: "14px", fontWeight: "500" }}>{item}</span>
                    <div className="checklist-options">
                      {["Yes", "No", "N/A"].map((opt) => (
                        <label key={opt} style={{ cursor: "pointer", fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <input
                            type="radio"
                            name={`sg_${item}`}
                            value={opt}
                            checked={safeguarding[item] === opt}
                            onChange={() => setSafeguarding({ ...safeguarding, [item]: opt })}
                          />{" "}
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>

              {/* Section 6: Activity-Specific Checklist */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "16px", borderRadius: "8px", marginBottom: "20px", background: "#ffffff" }}>
                <legend style={{ fontWeight: "bold", color: "var(--primary)", padding: "0 6px" }}>
                  Section 6: Activity-Specific Checklist ({activityObserved})
                </legend>
                {(ACTIVITY_TYPES_CHECKLISTS[activityObserved] || []).map((item) => (
                  <div key={item} className="checklist-row">
                    <span style={{ fontSize: "14px", fontWeight: "500" }}>{item}</span>
                    <label style={{ cursor: "pointer", fontSize: "14px", fontWeight: "bold", color: activityChecklist[item] ? "#2e7d32" : "#d32f2f", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="checkbox"
                        checked={!!activityChecklist[item]}
                        onChange={(e) => setActivityChecklist({ ...activityChecklist, [item]: e.target.checked })}
                      />{" "}
                      {activityChecklist[item] ? "Yes / Met" : "No / Unmet"}
                    </label>
                  </div>
                ))}
              </fieldset>

              {/* Section 7: GRM Check */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "16px", borderRadius: "8px", marginBottom: "20px", background: "#ffffff" }}>
                <legend style={{ fontWeight: "bold", color: "var(--primary)", padding: "0 6px" }}>Section 7: Grievance Redress Mechanism (GRM) Check</legend>
                <div className="form-grid">
                  <div>
                    <label>GRM Box Present?</label>
                    <select value={grmCheck.boxPresent} onChange={(e) => setGrmCheck({ ...grmCheck, boxPresent: e.target.value })}>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label>Community Members Aware?</label>
                    <select value={grmCheck.membersAware} onChange={(e) => setGrmCheck({ ...grmCheck, membersAware: e.target.value })}>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label>Any Complaint Raised Today?</label>
                    <select value={grmCheck.complaintRaised} onChange={(e) => setGrmCheck({ ...grmCheck, complaintRaised: e.target.value })}>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label>Complaint Notes / Details</label>
                    <input
                      type="text"
                      value={grmCheck.complaintNotes}
                      onChange={(e) => setGrmCheck({ ...grmCheck, complaintNotes: e.target.value })}
                      placeholder="Enter notes if complaint was raised"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Section 8: Evidence & Photo Attachments */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "16px", borderRadius: "8px", marginBottom: "20px", background: "#ffffff" }}>
                <legend style={{ fontWeight: "bold", color: "var(--primary)", padding: "0 6px" }}>Section 8: Evidence Collected &amp; Photos (Min 3 photos)</legend>
                <div style={{ display: "flex", gap: "16px", marginBottom: "14px", flexWrap: "wrap" }}>
                  {EVIDENCE_OPTIONS.map((opt) => (
                    <label key={opt} style={{ cursor: "pointer", fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="checkbox"
                        checked={evidenceCollected.includes(opt)}
                        onChange={(e) => {
                          if (e.target.checked) setEvidenceCollected([...evidenceCollected, opt]);
                          else setEvidenceCollected(evidenceCollected.filter((item) => item !== opt));
                        }}
                      />{" "}
                      {opt}
                    </label>
                  ))}
                </div>

                <div>
                  <label>Upload Photos (Minimum 3 required) *</label>
                  <input type="file" accept="image/*" multiple onChange={handlePhotoChange} required />
                  {photoPreviews.length > 0 && (
                    <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                      {photoPreviews.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="preview"
                          style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </fieldset>

              {/* Section 9: Overall Rating & Observations */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "16px", borderRadius: "8px", marginBottom: "20px", background: "#ffffff" }}>
                <legend style={{ fontWeight: "bold", color: "var(--primary)", padding: "0 6px" }}>Section 9: Overall Rating &amp; Observations</legend>
                <div className="form-grid">
                  <div>
                    <label>Overall Rating *</label>
                    <select value={overallRating} onChange={(e) => setOverallRating(e.target.value)}>
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Satisfactory">Satisfactory</option>
                      <option value="Needs Improvement">Needs Improvement</option>
                      <option value="Poor">Poor</option>
                    </select>
                  </div>
                  <div>
                    <label>Corrective Action Required?</label>
                    <select value={correctiveActionRequired} onChange={(e) => setCorrectiveActionRequired(e.target.value)}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label>Follow-up By</label>
                    <input type="text" value={followUpBy} onChange={(e) => setFollowUpBy(e.target.value)} placeholder="Responsible person" />
                  </div>
                  <div>
                    <label>Follow-up Due Date</label>
                    <input type="date" value={followUpDueDate} onChange={(e) => setFollowUpDueDate(e.target.value)} />
                  </div>
                </div>
                <div className="form-grid-2" style={{ marginTop: "12px" }}>
                  <div>
                    <label>Key Strengths</label>
                    <textarea rows="2" value={keyStrengths} onChange={(e) => setKeyStrengths(e.target.value)} placeholder="Notable positive findings" />
                  </div>
                  <div>
                    <label>Key Gaps / Weaknesses</label>
                    <textarea rows="2" value={keyGaps} onChange={(e) => setKeyGaps(e.target.value)} placeholder="Areas needing improvement" />
                  </div>
                </div>
                {correctiveActionRequired === "Yes" && (
                  <div style={{ marginTop: "12px" }}>
                    <label>Corrective Action Details</label>
                    <textarea rows="2" value={correctiveActionDetails} onChange={(e) => setCorrectiveActionDetails(e.target.value)} placeholder="Describe corrective action required" />
                  </div>
                )}
              </fieldset>

              {/* Section 10: Sign-off */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "16px", borderRadius: "8px", marginBottom: "20px", background: "#ffffff" }}>
                <legend style={{ fontWeight: "bold", color: "var(--primary)", padding: "0 6px" }}>Section 10: Certification &amp; Sign-off</legend>
                <div className="form-grid">
                  <div>
                    <label>DCMO Name *</label>
                    <input type="text" value={dcmoName} onChange={(e) => setDcmoName(e.target.value)} required />
                  </div>
                  <div>
                    <label>Sign-off Date *</label>
                    <input type="date" value={signOffDate} onChange={(e) => setSignOffDate(e.target.value)} required />
                  </div>
                </div>
              </fieldset>

              <button type="submit" disabled={submitting} className="btn-primary" style={{ width: "100%", padding: "12px", fontSize: "1rem", fontWeight: "600" }}>
                {submitting ? "Submitting Checklist..." : "Submit Monitoring Visit Checklist"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
