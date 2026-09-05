// A plan week can only be submitted against on its own assigned calendar date — once that
// date has passed (the next day onward), it's expired: gone from every submitter's picker,
// and rejected server-side even if a stale form still has it selected.
export function isWeekExpired(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekDate = new Date(date);
  weekDate.setHours(0, 0, 0, 0);
  return weekDate < today;
}
