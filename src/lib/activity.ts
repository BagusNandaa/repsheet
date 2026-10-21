import { isISODate, localISODate } from "./format";
import { addCalendarDays, startOfWeek, weekdayOrder } from "./schedule";
import type { WeekStart } from "./types";

/** GitHub-style trailing year: 53 week columns ending with the current week. */
export const HEATMAP_WEEKS = 53;

export type StreakSummary = {
  /** Trained weeks in a row, walking back from this week. */
  consecutiveWeeks: number;
  workoutsThisWeek: number;
  totalWorkouts: number;
};

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export type HeatmapDay = {
  date: string;
  count: number;
  level: HeatmapLevel;
};

export type HeatmapWeek = {
  start: string;
  days: HeatmapDay[];
};

export type YearHeatmap = {
  start: string;
  end: string;
  weeks: HeatmapWeek[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function calendarDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Local calendar step. Week boundaries come from `startOfWeek`, not a second copy. */
function shiftISODate(iso: string, days: number) {
  return localISODate(addCalendarDays(calendarDate(iso), days));
}

function weekStartISO(iso: string, weekStartsOn: WeekStart) {
  return localISODate(startOfWeek(calendarDate(iso), weekStartsOn));
}

/**
 * Count saved session dates. The strings are local calendar dates, not instants.
 * An unparsable value is ignored. Two sessions on one date count as two.
 */
export function bucketTrainingDays(dates: readonly string[]) {
  const counts = new Map<string, number>();
  for (const date of dates) {
    if (!isISODate(date)) continue;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return counts;
}

export function heatmapLevel(count: number): HeatmapLevel {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

/**
 * Consecutive weeks with at least one logged session, workouts in the week
 * that contains `today`, and the total session count.
 * The current week stays in the streak until it ends, even with no session yet.
 * A week before that with no session ends the streak. Dates are local calendar days.
 */
export function trainingStreaks(
  dates: readonly string[],
  today: string,
  weekStartsOn: WeekStart = "monday",
): StreakSummary {
  const empty: StreakSummary = { consecutiveWeeks: 0, workoutsThisWeek: 0, totalWorkouts: 0 };
  if (!isISODate(today)) return empty;

  const weeks = new Map<string, number>();
  let totalWorkouts = 0;
  for (const [date, count] of bucketTrainingDays(dates)) {
    totalWorkouts += count;
    const start = weekStartISO(date, weekStartsOn);
    weeks.set(start, (weeks.get(start) ?? 0) + count);
  }

  const thisWeek = weekStartISO(today, weekStartsOn);
  const workoutsThisWeek = weeks.get(thisWeek) ?? 0;
  let cursor = workoutsThisWeek > 0 ? thisWeek : shiftISODate(thisWeek, -7);
  let consecutiveWeeks = 0;
  while ((weeks.get(cursor) ?? 0) > 0) {
    consecutiveWeeks += 1;
    cursor = shiftISODate(cursor, -7);
  }

  return { consecutiveWeeks, workoutsThisWeek, totalWorkouts };
}

/**
 * Fifty-three local weeks ending with the week that contains `today`.
 * Each week is seven calendar dates. Cells outside the window are omitted.
 */
export function yearHeatmap(
  dates: readonly string[],
  today: string,
  weekStartsOn: WeekStart = "monday",
): YearHeatmap {
  if (!isISODate(today)) return { start: "", end: "", weeks: [] };

  const counts = bucketTrainingDays(dates);
  const endWeek = weekStartISO(today, weekStartsOn);
  const start = shiftISODate(endWeek, -(HEATMAP_WEEKS - 1) * 7);
  const weeks: HeatmapWeek[] = [];

  for (let index = 0; index < HEATMAP_WEEKS; index += 1) {
    const weekStart = shiftISODate(start, index * 7);
    const days: HeatmapDay[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = shiftISODate(weekStart, offset);
      const count = counts.get(date) ?? 0;
      days.push({ date, count, level: heatmapLevel(count) });
    }
    weeks.push({ start: weekStart, days });
  }

  return { start, end: shiftISODate(endWeek, 6), weeks };
}

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** One letter on the first, third, and fifth row. Order follows the sheet's week start. */
export function heatmapWeekdayLabels(weekStartsOn: WeekStart = "monday") {
  return weekdayOrder(weekStartsOn).map((weekday, index) => {
    if (index % 2 !== 0 || index > 4) return "";
    return WEEKDAY_LETTERS[weekday] ?? "";
  });
}

/** Month name for the first week that starts in that month. Short English labels. */
export function heatmapMonthLabels(weeks: readonly { start: string }[]) {
  const labels: Array<{ index: number; label: string }> = [];
  let previous = "";
  weeks.forEach((week, index) => {
    if (!isISODate(week.start)) return;
    const label = MONTHS[Number(week.start.slice(5, 7)) - 1] ?? "";
    if (!label || label === previous) return;
    labels.push({ index, label });
    previous = label;
  });
  return labels;
}

/** Spoken date and session count for a heatmap cell. */
export function describeTrainingDay(date: string, count: number) {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const workouts = safe === 1 ? "1 workout" : `${safe} workouts`;
  if (!isISODate(date)) return `Unknown day, ${workouts}`;
  const [year, month, day] = date.split("-").map(Number);
  const spoken = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
  return `${spoken}, ${workouts}`;
}
