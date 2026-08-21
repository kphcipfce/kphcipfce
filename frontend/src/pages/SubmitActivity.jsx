import { useEffect, useMemo, useRef, useState } from "react";
import { IoDocumentTextOutline } from "react-icons/io5";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Spinner from "../components/Spinner";
import { CameraIcon } from "../components/icons";

// Mirrors backend/src/config/projectCalendar.js's DAYS_BY_ACTIVITY_TYPE — Community
// engagement and BCC campaigns run Mon-Fri; WASH-in-schools runs Mon-Thu only. Each type is
// its own independent track (e.g. WASH and Community engagement can both happen the same day).
const DAYS_BY_ACTIVITY_TYPE = {
  "Community engagement session": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "Behavioural change and communication campaign": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "Wash and health hygiene in schools": ["Monday", "Tuesday", "Wednesday", "Thursday"],
};
const ACTIVITY_TYPES = Object.keys(DAYS_BY_ACTIVITY_TYPE);
const BCC_TYPE = "Behavioural change and communication campaign";
// BCC only runs 6 times across the 18-week project — once every 3 weeks — rather than every
// week like the other two types.
const BCC_WEEKS = [3, 6, 9, 12, 15, 18];
const VISIT_STATUSES = ["Pending", "In Progress", "Completed", "Deferred / Rescheduled"];

function pad(n) {
  return String(n).padStart(2, "0");
}

export default function SubmitActivity() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [teammate, setTeammate] = useState(null);
  const [facilities, setFacilities] = useState(null); // null = still loading
  const [weeks, setWeeks] = useState([]);
  const [teamActivities, setTeamActivities] = useState([]); // this team's active activities, used to derive occupancy
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [facility, setFacility] = useState("");
  const [activityType, setActivityType] = useState(ACTIVITY_TYPES[0]);
  const [attendees, setAttendees] = useState([user.id]);
  const [week, setWeek] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [plannedActivity, setPlannedActivity] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState(user.name);
  const [targetGroup, setTargetGroup] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [visitStatus, setVisitStatus] = useState("Completed");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);

  function loadTeamActivities() {
    api.get("/activities").then((res) => {
      setTeamActivities(res.data.filter((a) => ["submitted", "verified", "flagged"].includes(a.status)));
    });
  }

  useEffect(() => {
    api.get("/members/my-team").then((res) => setTeammate(res.data.teammate));
    api.get("/facilities").then((res) => setFacilities(res.data));
    api.get("/schedule/weeks").then((res) => setWeeks(res.data));
    loadTeamActivities();
  }, []);

  // A day is occupied for ME specifically if I'm recorded as an attendee on an existing
  // activity for that exact (week, day, activity type) — a teammate who wasn't there can
  // still submit their own separate one for that same day/type, and a different activity
  // type on the same day doesn't conflict at all (WASH and Community engagement can coexist).
  const occupied = useMemo(() => {
    const keys = new Set();
    for (const a of teamActivities) {
      if ((a.attendeeIds || []).map(String).includes(user.id)) {
        keys.add(`${a.week}-${a.dayOfWeek}-${a.activityType}`);
      }
    }
    return keys;
  }, [teamActivities, user.id]);

  // BCC is one session per 3-weekly slot, not a daily-repeatable activity — once any day of
  // that week has been submitted (for the group, so it applies to both teammates equally),
  // the whole week is done, not just that specific day.
  const bccWeeksDone = useMemo(() => {
    const done = new Set();
    for (const a of teamActivities) {
      if (a.activityType === BCC_TYPE && (a.attendeeIds || []).map(String).includes(user.id)) {
        done.add(a.week);
      }
    }
    return done;
  }, [teamActivities, user.id]);

  const weekOptions = useMemo(() => {
    if (activityType !== BCC_TYPE) return weeks.map((w) => ({ ...w, label: `Week ${w.weekNumber} (${new Date(w.monday).toLocaleDateString()})`, done: false }));
    return weeks
      .filter((w) => BCC_WEEKS.includes(w.weekNumber))
      .map((w) => {
        const done = bccWeeksDone.has(w.weekNumber);
        return {
          ...w,
          done,
          label: `Session ${BCC_WEEKS.indexOf(w.weekNumber) + 1} of ${BCC_WEEKS.length} — Week ${w.weekNumber} (${new Date(w.monday).toLocaleDateString()})${done ? " — completed" : ""}`,
        };
      });
  }, [weeks, activityType, bccWeeksDone]);

  const dayOptions = useMemo(() => {
    const allDays = DAYS_BY_ACTIVITY_TYPE[activityType] || [];
    if (!week) return allDays.map((d) => ({ day: d, taken: false }));
    return allDays.map((d) => ({ day: d, taken: occupied.has(`${week}-${d}-${activityType}`) }));
  }, [activityType, week, occupied]);

  // Switching activity type can invalidate the currently picked week (BCC only offers 6 of
  // the 18 weeks) or day (e.g. Friday isn't offered for WASH, or the day just became
  // occupied) — clear them rather than submit a stale selection.
  useEffect(() => {
    if (week && !weekOptions.some((w) => String(w.weekNumber) === String(week) && !w.done)) {
      setWeek("");
    }
  }, [weekOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (dayOfWeek && !dayOptions.some((o) => o.day === dayOfWeek && !o.taken)) {
      setDayOfWeek("");
    }
  }, [dayOptions]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!week || !dayOfWeek) return showToast("error", "Select which week and day you're fulfilling.");
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
      form.append("week", week);
      form.append("dayOfWeek", dayOfWeek);
      form.append("plannedActivity", plannedActivity);
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

      const res = await api.post("/activities", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { activity, flags } = res.data;
      let statusSummary = `Status: ${activity.status}.`;
      if (flags.anyDuplicate) statusSummary += " Duplicate image flagged for review.";
      if (flags.anyLocationUnverified) statusSummary += " Location not verified.";
      if (flags.anyCaptureDateMismatch) statusSummary += " Photo's capture date doesn't match today, flagged for review.";
      showToast("success", "Activity submitted please Donot resubmit the same weeks activity twice", statusSummary);

      setPlannedActivity("");
      setTargetGroup("");
      setExpectedOutput("");
      setVisitStatus("Completed");
      setDescription("");
      setPhotos([]);
      setDayOfWeek("");
      // The day just submitted is now occupied — refetch so it drops out of the picker
      // immediately instead of only after a manual page reload.
      loadTeamActivities();
      e.target.reset();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  if (facilities === null)
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

  return (
    <div className="page">
      <h1>Submit Activity</h1>
      <form className="card" onSubmit={handleSubmit}>
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

        <div className="date-time-row">
          <label>
            Week
            <select value={week} onChange={(e) => setWeek(e.target.value)} required>
              <option value="">Select a week</option>
              {weekOptions.map((w) => (
                <option key={w.weekNumber} value={w.weekNumber} disabled={w.done}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Day
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} required disabled={!week}>
              <option value="">Select a day</option>
              {dayOptions.map(({ day, taken }) => (
                <option key={day} value={day} disabled={taken}>
                  {day}
                  {taken ? " — already submitted" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>

        <label>
          Planned Activity
          <input value={plannedActivity} onChange={(e) => setPlannedActivity(e.target.value)} required />
        </label>
        <label>
          Responsible Person
          <input value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)} required />
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

        <button type="submit" disabled={busy} className={busy ? "btn-loading" : ""}>
          <span className="btn-label">Submit</span>
          {busy && <span className="btn-spinner" />}
        </button>
      </form>
    </div>
  );
}
