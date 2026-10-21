export type WeekDayStatus = "done" | "planned" | "none";

export type WeekStripDay = {
  /** ISO date, YYYY-MM-DD, in the local calendar. */
  date: string;
  status: WeekDayStatus;
};

// Fixed sample, Monday through Sunday. Not read from sessions or a plan.
const STUB_STATUS: WeekDayStatus[] = [
  "done",
  "done",
  "planned",
  "none",
  "planned",
  "none",
  "none",
];

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayOf(now: Date) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = date.getDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + delta);
  return date;
}

/**
 * Sample week for the Home strip.
 * TODO: SWE will wire this to the session model (done) and the weekly plan (planned).
 */
export function getWeekStripDays(now = new Date()): WeekStripDay[] {
  const monday = mondayOf(now);
  return STUB_STATUS.map((status, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { date: isoDate(date), status };
  });
}
