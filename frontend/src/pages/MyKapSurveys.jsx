import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Spinner from "../components/Spinner";
import SubmissionSuccess from "../components/SubmissionSuccess";
import { KAP_CATEGORIES, KAP_QUESTIONNAIRE, KAP_THEMES } from "../utils/kapQuestionnaire";

export default function MyKapSurveys() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [facilities, setFacilities] = useState(null);
  const [plans, setPlans] = useState(null);
  const [selectedPlanWeekKey, setSelectedPlanWeekKey] = useState("");

  const [facilityId, setFacilityId] = useState("");
  const [respondentCategory, setRespondentCategory] = useState(KAP_CATEGORIES[1]); // Default Community
  const [respondentSex, setRespondentSex] = useState("Female");
  const [responses, setResponses] = useState({});

  const [busy, setBusy] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  function loadData() {
    api.get("/facilities").then((res) => setFacilities(res.data));
    api.get("/kap-plans").then((res) => {
      setPlans(res.data);
      // Auto-select first active plan week if available
      const allWeeks = [];
      res.data.forEach((p) => {
        p.weeks.forEach((w) => {
          allWeeks.push({ planId: p._id, weekId: w._id, key: `${p._id}___${w._id}` });
        });
      });
      if (allWeeks.length > 0) {
        setSelectedPlanWeekKey(allWeeks[0].key);
      }
    });
  }

  useEffect(loadData, []);

  // Compute available active weeks
  const availableWeekOptions = [];
  if (plans) {
    plans.forEach((p) => {
      p.weeks.forEach((w) => {
        availableWeekOptions.push({
          planId: p._id,
          weekId: w._id,
          key: `${p._id}___${w._id}`,
          label: `${p.district?.name} — Week ${w.weekNumber} (${new Date(w.date).toLocaleDateString("en-GB")}, ${w.dayOfWeek})`,
          districtId: p.district?._id,
          date: w.date,
        });
      });
    });
  }

  const selectedWeekObj = availableWeekOptions.find((o) => o.key === selectedPlanWeekKey);

  // Selected category questions
  const currentQuestions = KAP_QUESTIONNAIRE[respondentCategory] || KAP_QUESTIONNAIRE.Community;

  function handleSingleChoice(qId, val) {
    setResponses((prev) => ({ ...prev, [qId]: val }));
  }

  function handleMultiChoice(qId, val, checked) {
    setResponses((prev) => {
      const currentArr = Array.isArray(prev[qId]) ? prev[qId] : [];
      let updated;
      if (checked) {
        updated = [...currentArr, val];
      } else {
        updated = currentArr.filter((item) => item !== val);
      }
      return { ...prev, [qId]: updated };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedWeekObj) {
      showToast("error", "Please select an assigned plan week");
      return;
    }
    if (!facilityId) {
      showToast("error", "Please select a health facility");
      return;
    }
    if (!respondentCategory) {
      showToast("error", "Please select a respondent category");
      return;
    }
    if (!respondentSex) {
      showToast("error", "Please select respondent sex");
      return;
    }

    setBusy(true);
    try {
      await api.post("/kap-surveys", {
        district: selectedWeekObj.districtId,
        facility: facilityId,
        respondentCategory,
        respondentSex,
        plan: selectedWeekObj.planId,
        planWeek: selectedWeekObj.weekId,
        dateTime: selectedWeekObj.date || new Date(),
        responses,
      });

      showToast("success", "KAP Survey submitted successfully");
      setJustSubmitted(true);
      setResponses({});
      loadData();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Failed to submit KAP survey");
    } finally {
      setBusy(false);
    }
  }

  if (justSubmitted) {
    return (
      <div className="page">
        <SubmissionSuccess
          message="KAP Survey Submitted!"
          buttonLabel="Return to submitting other survey"
          onReturn={() => setJustSubmitted(false)}
        />
      </div>
    );
  }

  if (!facilities || !plans) {
    return (
      <div className="page spinner-page">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Knowledge, Attitudes & Practices (KAP) Survey</h1>
      <p className="subtitle">
        Fill out theme-wise KAP questionnaires for assigned health facilities in your district.
      </p>

      {availableWeekOptions.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <h3>No Active KAP Survey Assignments</h3>
          <p style={{ color: "#666" }}>
            You have no pending KAP survey assignments for today. Assigned plans disappear after submission or after their date passes.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form-stack">
          {/* Header Assignment Fields */}
          <div className="card grid-2">
            <label>
              Assigned Plan & Date
              <select
                value={selectedPlanWeekKey}
                onChange={(e) => setSelectedPlanWeekKey(e.target.value)}
                required
              >
                {availableWeekOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Health Facility
              <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)} required>
                <option value="">-- Select Health Facility --</option>
                {facilities.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name} ({f.category})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Respondent Category
              <select
                value={respondentCategory}
                onChange={(e) => {
                  setRespondentCategory(e.target.value);
                  setResponses({});
                }}
                required
              >
                {KAP_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Respondent Sex
              <select value={respondentSex} onChange={(e) => setRespondentSex(e.target.value)} required>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </label>
          </div>

          {/* Theme-wise Questionnaire Questions */}
          {KAP_THEMES.map((theme) => {
            const themeQs = currentQuestions.filter((q) => q.themeId === theme.id);
            if (themeQs.length === 0) return null;

            return (
              <div key={theme.id} className="card" style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ color: "#006644", borderBottom: "2px solid #e0e0e0", paddingBottom: "0.5rem" }}>
                  {theme.titleEn}
                  <div style={{ fontSize: "0.9rem", color: "#555", fontWeight: "normal", direction: "rtl", textAlign: "right" }}>
                    {theme.titleUr}
                  </div>
                </h3>

                {themeQs.map((q) => {
                  // Check conditional rendering
                  if (q.condition) {
                    const parentVal = responses[q.condition.questionId];
                    if (parentVal !== q.condition.value) {
                      return null;
                    }
                  }

                  const userAns = responses[q.id];

                  return (
                    <div key={q.id}>
                      {q.section && (
                        <div style={{ background: "#e8f4f0", padding: "0.5rem 0.75rem", borderRadius: "6px", fontWeight: "bold", color: "#006644", marginTop: "1.25rem", marginBottom: "0.5rem" }}>
                          {q.section}
                        </div>
                      )}
                      <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#fdfdfd", border: "1px solid #eee", borderRadius: "6px" }}>
                      <div style={{ fontWeight: "600", color: "#111" }}>
                        {q.code}: {q.textEn}
                      </div>
                      <div style={{ fontSize: "0.95rem", color: "#005533", fontWeight: "500", marginTop: "0.25rem", direction: "rtl", textAlign: "right" }}>
                        {q.textUr}
                      </div>

                      {/* Single Choice / Radio Buttons / Likert */}
                      {(q.type === "single" || q.type === "likert") && (
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                          {q.options.map((opt) => (
                            <label key={opt} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontWeight: "normal" }}>
                              <input
                                type="radio"
                                name={q.id}
                                value={opt}
                                checked={userAns === opt}
                                onChange={() => handleSingleChoice(q.id, opt)}
                                required={!q.condition}
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Multi Choice / Checkboxes */}
                      {q.type === "multi" && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem", marginTop: "0.5rem" }}>
                          {q.options.map((opt) => {
                            const isChecked = Array.isArray(userAns) && userAns.includes(opt);
                            return (
                              <label key={opt} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontWeight: "normal" }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => handleMultiChoice(q.id, opt, e.target.checked)}
                                />
                                {opt}
                              </label>
                            );
                          })}
                        </div>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <button type="submit" disabled={busy} className={busy ? "btn-loading" : ""} style={{ width: "100%", padding: "0.8rem", fontSize: "1.1rem" }}>
            <span className="btn-label">Submit KAP Survey Questionnaire</span>
            {busy && <span className="btn-spinner" />}
          </button>
        </form>
      )}
    </div>
  );
}
