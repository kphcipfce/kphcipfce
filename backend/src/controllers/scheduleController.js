import { weekList } from "../config/projectCalendar.js";

// The fixed 18-week calendar, same for every team — replaces per-team micro plan scheduling.
export function listWeeks(req, res) {
  res.json(weekList());
}
