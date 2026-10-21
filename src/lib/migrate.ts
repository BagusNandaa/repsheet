import { SHEET_VERSION } from "./types";
import type {
  AppData,
  LoggedBy,
  PersistedSheet,
  Session,
  SessionExercise,
  SessionSet,
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

/**
 * Turn a stored sheet into version 2.
 * Pass-through entities (people, measurements, assigned workouts) are copied.
 * Only session exercises change shape. Running this on a version 2 sheet
 * keeps client logs, warm-ups, and completed times as stored.
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
    workouts: arrayOf(record.workouts),
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
