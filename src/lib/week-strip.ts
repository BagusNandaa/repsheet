import { localISODate } from "./format";
import {
  addCalendarDays,
  loggedTrainingDates,
  plannedDatesInRange,
  startOfWeek,
} from "./schedule";
import type { PlanOverride, Session, WeeklyPlan, WeekStart } from "./types";

export type WeekDayStatus = "done" | "planned" | "none";

export type WeekStripDay = {
  /** ISO date, YYYY-MM-DD, in the local calendar. */
  date: string;
  status: WeekDayStatus;
};

/**
 * Seven local calendar days for Home.
 * Done comes from a logged working set. Planned comes from the week plan
 * plus single-date overrides. A day that is both is done. Today is not a
 * status: the strip highlights it separately.
 */
export function getWeekStripDays(input: {
  now: Date;
  weekStartsOn: WeekStart;
  clientId: string;
  plan: WeeklyPlan | null;
  overrides: readonly PlanOverride[];
  sessions: readonly Session[];
  knownWorkoutIds?: ReadonlySet<string>;
}): WeekStripDay[] {
  const start = startOfWeek(input.now, input.weekStartsOn);
  const done = new Set(loggedTrainingDates(input.sessions, input.clientId));
  const planned = new Set(
    plannedDatesInRange({
      start,
      count: 7,
      clientId: input.clientId,
      plan: input.plan,
      overrides: input.overrides,
      knownWorkoutIds: input.knownWorkoutIds,
    }),
  );
  return Array.from({ length: 7 }, (_, offset) => {
    const iso = localISODate(addCalendarDays(start, offset));
    let status: WeekDayStatus = "none";
    if (planned.has(iso)) status = "planned";
    if (done.has(iso)) status = "done";
    return { date: iso, status };
  });
}
