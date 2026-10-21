import { isISODate, localISODate } from "./format";
import type {
  PlanOverride,
  Session,
  Weekday,
  WeeklyPlan,
  WeekStart,
} from "./types";

/**
 * Calendar arithmetic stays on local year/month/day.
 * Adding 24 hours crosses a daylight-saving fall-back onto the same date,
 * and `Date.toISOString()` shifts local midnight to the previous day in
 * timezones ahead of UTC.
 */

/** How far past today Home looks for the next training day. */
export const NEXT_TRAINING_HORIZON_DAYS = 21;

export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type TrainingAgenda = {
  /** Local calendar date, YYYY-MM-DD. */
  today: string;
  /** Workout scheduled today after overrides. Null is a rest day. */
  workoutId: string | null;
  /** Next date after today with a workout, inside the horizon. */
  next: { date: string; workoutId: string } | null;
};

export function weekdayOrder(weekStartsOn: WeekStart): Weekday[] {
  const start = weekStartsOn === "sunday" ? 0 : 1;
  return WEEKDAYS.map((offset) => ((start + offset) % 7) as Weekday);
}

/** Local midnight, then `days` on the calendar. Not 24-hour steps. */
export function addCalendarDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(now: Date, weekStartsOn: WeekStart) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = weekStartsOn === "sunday" ? 0 : 1;
  const delta = (date.getDay() - weekStart + 7) % 7;
  date.setDate(date.getDate() - delta);
  return date;
}

function dateFromISO(iso: string) {
  if (!isISODate(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function planFor(plan: WeeklyPlan | null, clientId: string) {
  if (!plan || plan.clientId !== clientId) return null;
  return plan;
}

/** Standing-week workout for this date, before overrides. */
export function planWorkoutId(plan: WeeklyPlan | null, iso: string) {
  if (!plan) return null;
  const date = dateFromISO(iso);
  if (!date) return null;
  const id = plan.days[date.getDay() as Weekday];
  return typeof id === "string" && id.length > 0 ? id : null;
}

function usableMove(override: PlanOverride) {
  return (
    override.kind === "move" &&
    typeof override.toDate === "string" &&
    override.toDate !== override.date &&
    isISODate(override.toDate)
  );
}

/** Last usable override for each source date. Earlier duplicates lose. */
function overridesBySource(overrides: readonly PlanOverride[], clientId: string) {
  const bySource = new Map<string, PlanOverride>();
  for (const override of overrides) {
    if (override.clientId !== clientId) continue;
    if (override.kind === "skip" || usableMove(override)) {
      bySource.set(override.date, override);
    }
  }
  return bySource;
}

/**
 * Workout on one calendar date.
 * A skip or a move clears that date's own planned workout.
 * A move places the source date's planned workout on its destination.
 * When several moves land on the same date, the later override wins.
 * A skip does not block a workout another date moved here.
 * Pass `knownWorkoutIds` to treat a deleted workout as rest.
 */
export function workoutIdOn(
  iso: string,
  clientId: string,
  plan: WeeklyPlan | null,
  overrides: readonly PlanOverride[],
  knownWorkoutIds?: ReadonlySet<string>,
) {
  if (!dateFromISO(iso)) return null;
  const standing = planFor(plan, clientId);
  const bySource = overridesBySource(overrides, clientId);
  const own = bySource.get(iso);
  let workoutId = own ? null : planWorkoutId(standing, iso);

  for (const override of bySource.values()) {
    if (!usableMove(override) || override.toDate !== iso) continue;
    const carried = planWorkoutId(standing, override.date);
    if (carried) workoutId = carried;
  }

  if (!workoutId) return null;
  if (knownWorkoutIds && !knownWorkoutIds.has(workoutId)) return null;
  return workoutId;
}

export function trainingAgenda(input: {
  now: Date;
  clientId: string;
  plan: WeeklyPlan | null;
  overrides: readonly PlanOverride[];
  knownWorkoutIds?: ReadonlySet<string>;
}): TrainingAgenda {
  const todayDate = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate());
  const today = localISODate(todayDate);
  const workoutId = workoutIdOn(
    today,
    input.clientId,
    input.plan,
    input.overrides,
    input.knownWorkoutIds,
  );
  let next: TrainingAgenda["next"] = null;
  for (let offset = 1; offset <= NEXT_TRAINING_HORIZON_DAYS; offset += 1) {
    const date = localISODate(addCalendarDays(todayDate, offset));
    const id = workoutIdOn(
      date,
      input.clientId,
      input.plan,
      input.overrides,
      input.knownWorkoutIds,
    );
    if (id) {
      next = { date, workoutId: id };
      break;
    }
  }
  return { today, workoutId, next };
}

export function plannedDatesInRange(input: {
  start: Date;
  count: number;
  clientId: string;
  plan: WeeklyPlan | null;
  overrides: readonly PlanOverride[];
  knownWorkoutIds?: ReadonlySet<string>;
}) {
  const dates: string[] = [];
  for (let offset = 0; offset < input.count; offset += 1) {
    const iso = localISODate(addCalendarDays(input.start, offset));
    if (
      workoutIdOn(iso, input.clientId, input.plan, input.overrides, input.knownWorkoutIds)
    ) {
      dates.push(iso);
    }
  }
  return dates;
}

function isLoggedTrainingSession(session: Session) {
  if (!isISODate(session.date)) return false;
  return session.exercises.some((exercise) =>
    exercise.sets.some((set) => set.done && !set.isWarmup),
  );
}

/** Dates with a completed working set. Warm-ups and unfinished sets do not count. */
export function loggedTrainingDates(sessions: readonly Session[], clientId: string) {
  const dates = new Set<string>();
  for (const session of sessions) {
    if (session.clientId !== clientId) continue;
    if (!isLoggedTrainingSession(session)) continue;
    dates.add(session.date);
  }
  return [...dates].sort();
}
