import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Spinner from "../components/Spinner";
import { CameraIcon } from "../components/icons";

const ACTIVITY_TYPES = [
  "Maternal & Newborn Care",
  "Child Vaccination Services",
  "24/7 Urgent Care",
  "Skilled Doctor Coverage",
  "Other",
];
const VISIT_STATUSES = [
  "Pending",
  "In Progress",
  "Completed",
  "Deferred / Rescheduled",
];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

export default function SubmitActivity() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [teammate, setTeammate] = useState(null);
  const [microPlans, setMicroPlans] = useState(null); // null = still loading, [] = loaded but none assigned
  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [activityType, setActivityType] = useState(ACTIVITY_TYPES[0]);
  const [selectedWeekKey, setSelectedWeekKey] = useState("");
  const [healthFacility, setHealthFacility] = useState("");
  const [plannedActivity, setPlannedActivity] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState(user.name);
  const [targetGroup, setTargetGroup] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [visitStatus, setVisitStatus] = useState("Completed");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [attendees, setAttendees] = useState([user.id]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/members/my-team").then((res) => setTeammate(res.data.teammate));
    api.get("/micro-plans").then((res) => setMicroPlans(res.data));
    api.get("/districts").then((res) => setDistricts(res.data));
  }, []);

  const weekOptions = useMemo(
    () =>
      (microPlans || []).flatMap((plan) =>
        plan.weeks.map((w) => ({
          key: `${plan._id}:${w._id}`,
          planId: plan._id,
          weekId: w._id,
          date: w.date,
          label: `${MONTH_NAMES[plan.month - 1]} ${plan.year} — Week ${w.weekNumber} (${new Date(w.date).toLocaleDateString()})`,
        })),
      ),
    [microPlans],
  );
  const selectedWeek = weekOptions.find((w) => w.key === selectedWeekKey);

  function toggleAttendee(id) {
    setAttendees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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
    if (!selectedWeek)
      return showToast("error", "Select which planned week you're fulfilling.");
    if (!district) return showToast("error", "Select a district.");
    if (photos.length === 0)
      return showToast("error", "At least one photo is required.");
    setBusy(true);

    try {
      const position = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          (err) => {
            // PERMISSION_DENIED=1, POSITION_UNAVAILABLE=2, TIMEOUT=3 — logged so a failure
            // is diagnosable instead of silently missing GPS with no clue why.
            console.warn(
              `Geolocation failed (code ${err.code}): ${err.message}`,
            );
            resolve(null);
          },
          { timeout: 15000, maximumAge: 60000, enableHighAccuracy: true },
        );
      });

      const form = new FormData();
      form.append("dateTime", new Date(`${date}T${time}`).toISOString());
      form.append("activityType", activityType);
      form.append("microPlan", selectedWeek.planId);
      form.append("microPlanWeek", selectedWeek.weekId);
      form.append("district", district);
      form.append("healthFacility", healthFacility);
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
      if (flags.anyDuplicate)
        statusSummary += " Duplicate image flagged for review.";
      if (flags.anyLocationUnverified)
        statusSummary += " Location not verified.";
      if (flags.dateMismatch)
        statusSummary +=
          " Activity date doesn't match today's date, flagged for review.";
      if (flags.anyCaptureDateMismatch)
        statusSummary +=
          " Photo's capture date doesn't match today, flagged for review.";
      showToast(
        "success",
        "Activity submitted please Donot resubmit the same weeks activity twice",
        statusSummary,
      );

      setHealthFacility("");
      setPlannedActivity("");
      setTargetGroup("");
      setExpectedOutput("");
      setVisitStatus("Completed");
      setDescription("");
      setPhotos([]);
      setSelectedWeekKey("");
      // The week just submitted is now occupied — refetch so it drops out of the picker
      // immediately instead of only after a manual page reload.
      api.get("/micro-plans").then((res) => setMicroPlans(res.data));
      e.target.reset();
    } catch (err) {
      showToast("error", err.response?.data?.error || "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  if (microPlans === null)
    return (
      <div className="page">
        <Spinner />
      </div>
    );

  if (weekOptions.length === 0) {
    return (
      <div className="page">
        <h1>Submit Activity</h1>
        <p>
          Your team has no micro plan assigned yet. Contact your Super Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Submit Activity</h1>
      <form className="card" onSubmit={handleSubmit}>
        <div className="date-time-row">
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label>
            Time
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </label>
        </div>
        <label>
          Activity type
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>

        <label>
          Planned week
          <select
            value={selectedWeekKey}
            onChange={(e) => setSelectedWeekKey(e.target.value)}
            required
          >
            <option value="">Select a planned week</option>
            {weekOptions.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        {selectedWeek && (
          <p>Planned: {new Date(selectedWeek.date).toLocaleDateString()}</p>
        )}

        <label>
          District
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            required
          >
            <option value="">Select a district</option>
            {districts.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Health Facility / Community
          <input
            value={healthFacility}
            onChange={(e) => setHealthFacility(e.target.value)}
            required
          />
        </label>
        <label>
          Planned Activity
          <input
            value={plannedActivity}
            onChange={(e) => setPlannedActivity(e.target.value)}
            required
          />
        </label>
        <label>
          Responsible Person
          <input
            value={responsiblePerson}
            onChange={(e) => setResponsiblePerson(e.target.value)}
            required
          />
        </label>
        <label>
          Target Group
          <input
            value={targetGroup}
            onChange={(e) => setTargetGroup(e.target.value)}
            required
          />
        </label>
        <label>
          Expected Output
          <input
            value={expectedOutput}
            onChange={(e) => setExpectedOutput(e.target.value)}
            required
          />
        </label>
        <label>
          Status
          <select
            value={visitStatus}
            onChange={(e) => setVisitStatus(e.target.value)}
          >
            {VISIT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Remarks / Follow-up (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
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
                checked={attendees.includes(teammate._id)}
                onChange={() => toggleAttendee(teammate._id)}
              />
              {teammate.name}
            </label>
          )}
        </fieldset>

        <div>
          Photo evidence
          <div className="photo-actions">
            <label className="file-btn">
              <CameraIcon />
              Capture
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={addPhotos}
              />
            </label>
            <label className="file-btn file-btn-secondary">
              Upload Photo
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={addPhotos}
              />
            </label>
          </div>
          {photos.length > 0 && (
            <ul className="photo-list">
              {photos.map((file, i) => (
                <li key={i}>
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit" disabled={busy}>
          {busy ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
