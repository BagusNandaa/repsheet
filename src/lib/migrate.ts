import { isISODate } from "./format";
import { readProgressionRule, readTargetOverride } from "./progression";
import { SHEET_VERSION } from "./types";
import type {
  AppData,
  LoggedBy,
  PersistedSheet,
  PlanOverride,
  Session,
  SessionExercise,
  SessionSet,
  Weekday,
  WeeklyPlan,
  WeekStart,
  Workout,
  WorkoutMove,
} from "./types";

/** Previous key. One weight, one rep count, and a set count per exercise. */
export const STORAGE_KEY_V1 = "repsheet.v1";

/** Current key. `version` inside the JSON matches SHEET_VERSION. */
export const STORAGE_KEY_V2 = "repsheet.v2";

/**
 * Safety cap when a stored set count is an integer but absurdly large.
 * The coach form only saves 1–20. Counts above this keep the first 100 rows.
 */
export const MAX_EXPANDED_SETS = 100;

export type SheetStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

/** v1 session exercise, before per-set rows. */
export type LegacySessionExercise = {
  id: string;
  exerciseId: string;
  weightKg: number;
  reps: number;
  sets: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A sheet we can migrate. Empty arrays count. A missing sheet does not. */
export function isUsableSheet(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Array.isArray(value.users) && Array.isArray(value.clients);
}

function stringField(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function idField(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function loggedBy(value: unknown): LoggedBy {
  return value === "client" ? "client" : "coach";
}

function optionalId(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * How many rows a v1 `sets` count becomes.
 * A positive integer becomes that many rows, capped at MAX_EXPANDED_SETS.
 * Anything else (missing, zero, fractional, negative, or a non-number) becomes
 * one row so the logged weight and reps are not dropped.
 */
export function expandedSetCount(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return Math.min(value, MAX_EXPANDED_SETS);
  }
  return 1;
}

/** Identical completed working sets. Coach saves and v1 migration both use this. */
export function expandUniformSets(
  count: number,
  weightKg: number,
  reps: number,
  createId: (index: number) => string,
): SessionSet[] {
  return Array.from({ length: count }, (_, index) => ({
    id: createId(index),
    weightKg,
    reps,
    done: true,
    isWarmup: false,
    completedAt: null,
  }));
}

function normalizeSet(raw: unknown, exerciseEntryId: string, index: number): SessionSet {
  const set = isRecord(raw) ? raw : {};
  return {
    id: idField(set.id, `${exerciseEntryId}-set-${index + 1}`),
    weightKg: finiteNumber(set.weightKg, 0),
    reps: finiteNumber(set.reps, 0),
    done: typeof set.done === "boolean" ? set.done : true,
    isWarmup: typeof set.isWarmup === "boolean" ? set.isWarmup : false,
    completedAt: optionalId(set.completedAt),
  };
}

function migrateExercise(raw: unknown, index: number): SessionExercise {
  const exercise = isRecord(raw) ? raw : {};
  const id = idField(exercise.id, `exercise-${index + 1}`);
  const exerciseId = stringField(exercise.exerciseId, "");
  if (Array.isArray(exercise.sets)) {
    return {
      id,
      exerciseId,
      sets: exercise.sets.map((set, setIndex) => normalizeSet(set, id, setIndex)),
    };
  }
  return {
    id,
    exerciseId,
    sets: expandUniformSets(
      expandedSetCount(exercise.sets),
      finiteNumber(exercise.weightKg, 0),
      finiteNumber(exercise.reps, 0),
      (setIndex) => `${id}-set-${setIndex + 1}`,
    ),
  };
}

function migrateSession(raw: unknown, index: number): Session {
  const session = isRecord(raw) ? raw : {};
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  return {
    id: idField(session.id, `session-${index + 1}`),
    clientId: stringField(session.clientId, ""),
    date: stringField(session.date, ""),
    title: stringField(session.title, ""),
    loggedBy: loggedBy(session.loggedBy),
    workoutId: optionalId(session.workoutId),
    exercises: exercises.map(migrateExercise),
  };
}

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function migrateWeekStart(value: unknown): WeekStart {
  return value === "sunday" ? "sunday" : "monday";
}

function normalizePlan(raw: unknown): WeeklyPlan | null {
  if (!isRecord(raw)) return null;
  const clientId = stringField(raw.clientId, "");
  if (!clientId) return null;
  const source = isRecord(raw.days) ? raw.days : {};
  const days: Partial<Record<Weekday, string>> = {};
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const value = source[String(weekday)];
    if (typeof value === "string" && value.length > 0) {
      days[weekday as Weekday] = value;
    }
  }
  return { clientId, days };
}

function migratePlans(raw: unknown): WeeklyPlan[] {
  if (!Array.isArray(raw)) return [];
  const byClient = new Map<string, WeeklyPlan>();
  for (const item of raw) {
    const plan = normalizePlan(item);
    if (plan) byClient.set(plan.clientId, plan);
  }
  return [...byClient.values()];
}

function normalizeOverride(raw: unknown, index: number): PlanOverride | null {
  if (!isRecord(raw)) return null;
  const clientId = stringField(raw.clientId, "");
  const date = stringField(raw.date, "");
  if (!clientId || !isISODate(date)) return null;
  const id = idField(raw.id, `override-${index + 1}`);
  if (raw.kind === "skip") return { id, clientId, date, kind: "skip", toDate: null };
  if (raw.kind !== "move") return null;
  const toDate = stringField(raw.toDate, "");
  if (!isISODate(toDate) || toDate === date) return null;
  return { id, clientId, date, kind: "move", toDate };
}

function migrateMove(raw: unknown, index: number): WorkoutMove {
  const move = isRecord(raw) ? raw : {};
  return {
    id: idField(move.id, `move-${index + 1}`),
    exerciseId: stringField(move.exerciseId, ""),
    sets: typeof move.sets === "number" ? move.sets : 1,
    reps: stringField(move.reps, ""),
    progression: move.progression == null ? null : readProgressionRule(move.progression),
    targetOverride: readTargetOverride(move.targetOverride),
  };
}

function migrateWorkout(raw: unknown, index: number): Workout {
  const workout = isRecord(raw) ? raw : {};
  const moves = Array.isArray(workout.moves) ? workout.moves : [];
  return {
    id: idField(workout.id, `workout-${index + 1}`),
    clientId: stringField(workout.clientId, ""),
    name: stringField(workout.name, ""),
    assignedAt: stringField(workout.assignedAt, ""),
    progression: readProgressionRule(workout.progression),
    moves: moves.map(migrateMove),
  };
}

function migrateWorkouts(raw: unknown): Workout[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(migrateWorkout);
}

function migrateOverrides(raw: unknown): PlanOverride[] {
  if (!Array.isArray(raw)) return [];
  const bySource = new Map<string, PlanOverride>();
  raw.forEach((item, index) => {
    const override = normalizeOverride(item, index);
    if (!override) return;
    bySource.set(`${override.clientId}\0${override.date}`, override);
  });
  return [...bySource.values()];
}

/**
 * Turn a stored sheet into version 2.
 * People, measurements, and assigned workouts are copied.
 * Session exercises stay per-set rows. Running this on a version 2 sheet
 * keeps client logs, warm-ups, and completed times as stored.
 * Week plans, single-date overrides, and the week start are kept when the
 * sheet has them. An older v2 sheet gets an empty plan and Monday.
 * A workout with no progression rule becomes None. A move with no rule
 * follows the workout. A missing target override stays empty.
 */
export function migrateSheet(raw: unknown): PersistedSheet {
  const record = isRecord(raw) ? raw : {};
  const sessions = Array.isArray(record.sessions) ? record.sessions : [];
  return {
    version: SHEET_VERSION,
    users: arrayOf(record.users),
    clients: arrayOf(record.clients),
    measurements: arrayOf(record.measurements),
    sessions: sessions.map(migrateSession),
    workouts: migrateWorkouts(record.workouts),
    plans: migratePlans(record.plans),
    overrides: migrateOverrides(record.overrides),
    weekStartsOn: migrateWeekStart(record.weekStartsOn),
  };
}

export function persistedSheet(data: AppData): PersistedSheet {
  return {
    version: SHEET_VERSION,
    users: data.users,
    clients: data.clients,
    measurements: data.measurements,
    sessions: data.sessions,
    workouts: data.workouts,
    plans: data.plans,
    overrides: data.overrides,
    weekStartsOn: data.weekStartsOn,
  };
}

function parseStored(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Read the sheet from localStorage (or a test double).
 * A usable v2 sheet wins. Otherwise a usable v1 sheet is migrated, written
 * to v2, and the v1 key is removed. Null means there is no sheet: the caller
 * keeps the demo seed.
 */
export function readStoredSheet(storage: SheetStorage): PersistedSheet | null {
  const current = parseStored(storage.getItem(STORAGE_KEY_V2));
  if (isUsableSheet(current)) return migrateSheet(current);

  const legacy = parseStored(storage.getItem(STORAGE_KEY_V1));
  if (!isUsableSheet(legacy)) return null;

  const migrated = migrateSheet(legacy);
  storage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated));
  storage.removeItem(STORAGE_KEY_V1);
  return migrated;
}
