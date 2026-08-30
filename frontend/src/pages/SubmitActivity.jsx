import { useEffect, useMemo, useRef, useState } from "react";
import { IoDocumentTextOutline } from "react-icons/io5";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Spinner from "../components/Spinner";
import { CameraIcon } from "../components/icons";
import SubmissionSuccess from "../components/SubmissionSuccess";

const ACTIVITY_TYPES = [
  "Community engagement session",
  "Behavioural change and communication campaign",
  "Wash and health hygiene in schools",
];
const BCC_TYPE = "Behavioural change and communication campaign";
const VISIT_STATUSES = ["Pending", "In Progress", "Completed", "Deferred / Rescheduled"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

export default function SubmitActivity() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [teammate, setTeammate] = useState(null);
  const [facilities, setFacilities] = useState(null); // null = still loading
  const [plans, setPlans] = useState(null); // null = still loading, [] = loaded but none assigned
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [facility, setFacility] = useState("");
  const [activityType, setActivityType] = useState(ACTIVITY_TYPES[0]);
  const [attendees, setAttendees] = useState([user.id]);
  const [selectedWeekKey, setSelectedWeekKey] = useState("");
  const [plannedActivity, setPlannedActivity] = useState("");
  const [maleAttendees, setMaleAttendees] = useState("0");
  const [femaleAttendees, setFemaleAttendees] = useState("0");
  const [responsiblePerson, setResponsiblePerson] = useState(user.name);
  const [targetGroup, setTargetGroup] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [visitStatus, setVisitStatus] = useState("Completed");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Guards against an in-flight request (e.g. React StrictMode's duplicate mount effect)
  // resolving after a newer one and clobbering fresher data with stale results.
  const loadSeq = useRef(0);
  function loadPlans() {
    const seq = ++loadSeq.current;
    api.get("/mobilizer-plans").then((res) => {
      if (seq === loadSeq.current) setPlans(res.data);
    });
  }

  useEffect(() => {
    api.get("/members/my-team").then((res) => setTeammate(res.data.teammate));
    api.get("/facilities").then((res) => setFacilities(res.data));
    loadPlans();
  }, []);

  const weekOptions = useMemo(
    () =>
      (plans || []).flatMap((plan) =>
        plan.weeks.map((w) => ({
          key: `${plan._id}:${w._id}`,
          planId: plan._id,
          weekId: w._id,
          date: w.date,
          label: `${MONTH_NAMES[plan.month - 1]} ${plan.year} — Week ${w.weekNumber} (${new Date(w.date).toLocaleDateString("en-GB")}) — ${w.dayOfWeek}`,
        })),
      ),
    [plans],
  );
  const selectedWeek = weekOptions.find((w) => w.key === selectedWeekKey);

  // BCC is a group activity — both teammates always attend together, so the checklist locks
  // to everyone rather than letting one be excluded. Whatever was picked before switching to
  // BCC is remembered and restored when switching to a different activity type, rather than
  // leaving both permanently checked.
  const preBccAttendees = useRef(null);
  useEffect(() => {
    if (activityType === BCC_TYPE) {
      if (preBccAttendees.current === null) preBccAttendees.current = attendees;
      if (teammate) setAttendees([user.id, teammate._id]);
    } else if (preBccAttendees.current !== null) {
      setAttendees(preBccAttendees.current);
      preBccAttendees.current = null;
    }
  }, [activityType, teammate]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleAttendee(id) {
    if (activityType === BCC_TYPE) return;
    setAttendees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addPhotos(e) {
    // Capture the files before clearing the input — by the time React calls the
    // setPhotos updater, e.target.files would already be empty otherwise.
    const newFiles = Array.from(e.target.files);
    e.target.value = ""; // lets the same camera/file be picked again right after
    setPhotos((prev) => [...prev, ...newFiles]);
  }

  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedWeek) return showToast("error", "Select which planned week you're fulfilling.");
    if (photos.length === 0) return showToast("error", "At least one photo is required.");
    setBusy(true);

    try {
      const position = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          (err) => {
            // PERMISSION_DENIED=1, POSITION_UNAVAILABLE=2, TIMEOUT=3 — logged so a failure
            // is diagnosable instead of silently missing GPS with no clue why.
            console.warn(`Geolocation failed (code ${err.code}): ${err.message}`);
            resolve(null);
          },
          { timeout: 15000, maximumAge: 60000, enableHighAccuracy: true },
        );
      });

      const form = new FormData();
      form.append("time", time);
      form.append("activityType", activityType);
      form.append("facility", facility);
      form.append("plan", selectedWeek.planId);
      form.append("planWeek", selectedWeek.weekId);
      form.append("plannedActivity", plannedActivity);
      form.append("maleAttendees", maleAttendees);
      form.append("femaleAttendees", femaleAttendees);
      form.append("responsiblePerson", responsiblePerson);
      form.append("targetGroup", targetGroup);
      form.append("expectedOutput", expectedOutput);
      form.append("visitStatus", visitStatus);
      form.append("description", description);
      attendees.forEach((id) => form.append("attendeeIds", id));
      if (position) {
        form.append("gpsLat", position.latitude);
        form.append("gpsLong", position.longitude);
      }
      photos.forEach((file) => form.append("photos", file));

      await api.post("/activities", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setJustSubmitted(true);

      setPlannedActivity("");
      setMaleAttendees("0");
      setFemaleAttendees("0");
      setTargetGroup("");
      setExpectedOutput("");
      setVisitStatus("Completed");
      setDescription("");
      setPhotos([]);
      setSelectedWeekKey("");
      // The week just submitted is now occupied — refetch so it drops out of the picker
      // immediately instead of only after a manual page reload.
      loadPlans();
      e.target.reset();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  // Checked first, ahead of the empty-state guards below: submitting the last available week
  // makes it refetch to empty, and that "no plan assigned" state must never outrun the success
  // screen for the submission that just happened.
  if (justSubmitted) {
    return (
      <div className="page">
        <h1>Submit Activity</h1>
        <SubmissionSuccess onReturn={() => setJustSubmitted(false)} />
      </div>
    );
  }

  if (facilities === null || plans === null)
    return (
      <div className="page">
        <Spinner />
      </div>
    );

  if (facilities.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <IoDocumentTextOutline />
          <p>No facilities are set up for your district yet.</p>
          <p>Contact your Super Admin.</p>
        </div>
      </div>
    );
  }

  if (weekOptions.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <IoDocumentTextOutline />
          <p>Your team has no plan assigned yet.</p>
          <p>Contact your Super Admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Submit Activity</h1>
      <form className="card" onSubmit={handleSubmit}>
        <fieldset disabled={busy} className="form-disable-wrap">
        <label>
          Health Facility / Community
          <select value={facility} onChange={(e) => setFacility(e.target.value)} required>
            <option value="">Select a facility</option>
            {facilities.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name} ({f.category})
              </option>
            ))}
          </select>
        </label>

        <label>
          Activity type
          <select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend>Attendees</legend>
          <label className="checkbox-row">
            <input type="checkbox" checked disabled /> {user.name} (you)
          </label>
          {teammate && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={activityType === BCC_TYPE ? true : attendees.includes(teammate._id)}
                disabled={activityType === BCC_TYPE}
                onChange={() => toggleAttendee(teammate._id)}
              />
              {teammate.name}
            </label>
          )}
        </fieldset>

        <label>
          Planned week
          <select value={selectedWeekKey} onChange={(e) => setSelectedWeekKey(e.target.value)} required>
            <option value="">Select a planned week</option>
            {weekOptions.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        {selectedWeek && <p>Planned: {new Date(selectedWeek.date).toLocaleDateString()}</p>}

        <label>
          Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>

        <label>
          Planned Activity
          <input value={plannedActivity} onChange={(e) => setPlannedActivity(e.target.value)} required />
        </label>

        <fieldset>
          <legend>Participants</legend>
          <div className="date-time-row">
            <label>
              Male participants
              <input type="number" min="0" value={maleAttendees} onChange={(e) => setMaleAttendees(e.target.value)} required />
            </label>
            <label>
              Female participants
              <input type="number" min="0" value={femaleAttendees} onChange={(e) => setFemaleAttendees(e.target.value)} required />
            </label>
          </div>
        </fieldset>

        <label>
          Responsible Person
          <input value={responsiblePerson} disabled required />
        </label>
        <label>
          Target Group
          <input value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)} required />
        </label>
        <label>
          Expected Output
          <input value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} required />
        </label>
        <label>
          Status
          <select value={visitStatus} onChange={(e) => setVisitStatus(e.target.value)}>
            {VISIT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Remarks / Follow-up (optional)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>

        <div>
          Photo evidence
          <div className="photo-actions">
            <label className="file-btn">
              <CameraIcon />
              Capture
              <input type="file" accept="image/*" capture="environment" onChange={addPhotos} />
            </label>
            <label className="file-btn file-btn-secondary">
              Upload Photo
              <input type="file" accept="image/*" multiple onChange={addPhotos} />
            </label>
          </div>
          {photos.length > 0 && (
            <ul className="photo-list">
              {photos.map((file, i) => (
                <li key={i}>
                  <span>{file.name}</span>
                  <button type="button" onClick={() => removePhoto(i)} aria-label="Remove photo">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </fieldset>

        <button type="submit" disabled={busy} className={busy ? "btn-loading" : ""}>
          <span className="btn-label">Submit</span>
          {busy && <span className="btn-spinner" />}
        </button>
      </form>
    </div>
  );
}
