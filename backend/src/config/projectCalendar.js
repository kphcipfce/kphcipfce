// Every team shares one fixed 18-week submission calendar instead of admin-scheduled micro
// plans — Week 1 starts on PROJECT_START_DATE (set this to the real project kickoff Monday
// in .env), and every later week is computed from it, so no per-team scheduling is needed.
const TOTAL_WEEKS = 18;
// Fallback only — set PROJECT_START_DATE in .env to the real project kickoff Monday.
const START = new Date(process.env.PROJECT_START_DATE || "2026-08-17T00:00:00.000Z");

// Community engagement + BCC campaigns run Mon-Fri; WASH-in-schools runs Mon-Thu only
// (schools are closed Fridays in this context) — enforced here so the server never trusts
// a client-sent day for an activity type that shouldn't offer it.
const DAYS_BY_ACTIVITY_TYPE = {
  "Community engagement session": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "Behavioural change and communication campaign": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "Wash and health hygiene in schools": ["Monday", "Tuesday", "Wednesday", "Thursday"],
};

// BCC only runs 6 times across the 18-week project — once every 3 weeks — rather than every
// week like the other two types. Session number is just week/3, so no separate counter needed.
const BCC_WEEKS = [3, 6, 9, 12, 15, 18];
const BCC_TYPE = "Behavioural change and communication campaign";

export function bccSessionNumber(weekNumber) {
  return weekNumber / 3;
}

const DAY_OFFSET = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 };

function mondayOfWeek(weekNumber) {
  return new Date(START.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
}

export function weekList() {
  return Array.from({ length: TOTAL_WEEKS }, (_, i) => ({ weekNumber: i + 1, monday: mondayOfWeek(i + 1) }));
}

// Combines the fixed calendar date for (week, dayOfWeek) with a client-supplied time-of-day.
export function dateForSlot(weekNumber, dayOfWeek, time) {
  const date = new Date(mondayOfWeek(weekNumber).getTime() + DAY_OFFSET[dayOfWeek] * 24 * 60 * 60 * 1000);
  if (time) {
    const [hours, minutes] = time.split(":").map(Number);
    date.setHours(hours || 0, minutes || 0, 0, 0);
  }
  return date;
}

export function isValidSlot(activityType, weekNumber, dayOfWeek) {
  if (weekNumber < 1 || weekNumber > TOTAL_WEEKS) return false;
  if (activityType === BCC_TYPE && !BCC_WEEKS.includes(weekNumber)) return false;
  const allowedDays = DAYS_BY_ACTIVITY_TYPE[activityType];
  return !!allowedDays && allowedDays.includes(dayOfWeek);
}

export { TOTAL_WEEKS, DAYS_BY_ACTIVITY_TYPE, BCC_WEEKS, BCC_TYPE };
