import { z } from "zod";
import {
  SESSION_KEY,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  migrateSheet,
  type SheetStorage,
} from "./migrate";
import { REST_STORAGE_KEY } from "./rest-timer";
import { ACCENT_STORAGE_KEY, THEME_STORAGE_KEY } from "./theme";
import { SHEET_VERSION } from "./types";

/**
 * Backup envelope. schemaVersion 1 is this shape. A raw v1 or v2 sheet with
 * no envelope is an older file: it is wrapped, then the sheet is migrated
 * with migrateSheet (the same v1 → v2 path the app uses on startup).
 *
 * Known fields are checked. Unknown fields on those records, and unknown
 * `repsheet.*` keys, are kept. A later weekly plan, e1RM, or progression
 * rule can round-trip without a change here. A newer envelope
 * (schemaVersion > 1) is refused.
 *
 * Conflict rule (merge):
 * Every array of records with a string `id` is matched on that id. This
 * covers users, clients, measurements, sessions, workouts, and any future
 * list stored the same way, on the sheet or under its own key. The imported
 * record replaces the device record with the same id, including nested rows
 * such as sets and workout moves. Nested rows are not matched on their own.
 * Device records whose ids are absent from the file stay. Imported ids that
 * are new are appended. Merging the same file again replaces those ids with
 * the same records and appends nothing.
 * A value that is not an id list (theme, the rest timer, a future object)
 * is replaced by the file when both sides have it. Device-only keys stay,
 * so merge does not delete local data.
 * `repsheet.user` is the exception: when this device already has someone
 * signed in, merge leaves that person in place.
 *
 * Replace writes the file's `repsheet.*` keys after migration and removes
 * device keys the file does not contain. A file that fails validation is
 * refused before either mode writes.
 */
export const BACKUP_SCHEMA_VERSION = 1 as const;

export const STORAGE_PREFIX = "repsheet.";

export type KeyedStorage = SheetStorage & {
  keys: () => string[];
};

export type BackupMode = "merge" | "replace";

export type BackupSummary = {
  exportedAt: string | null;
  users: number;
  clients: number;
  measurements: number;
  sessions: number;
  workouts: number;
  keys: string[];
};

export type PreparedBackup = {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string | null;
  keys: Record<string, unknown>;
  summary: BackupSummary;
};

export type BackupFile = {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  keys: Record<string, unknown>;
};

export type BackupSuccess = { ok: true; backup: PreparedBackup };
export type BackupFailure = { ok: false; error: string };
export type BackupResult = BackupSuccess | BackupFailure;

const KNOWN_KEYS = new Set([
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  REST_STORAGE_KEY,
  SESSION_KEY,
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
]);

const SESSION_FIELDS = new Set([
  "id",
  "clientId",
  "date",
  "title",
  "loggedBy",
  "workoutId",
  "exercises",
]);

const EXERCISE_FIELDS = new Set(["id", "exerciseId", "sets"]);

/** v1 stored weight, reps, and a set count on the exercise. Those are not v2 fields. */
const LEGACY_EXERCISE_FIELDS = new Set(["id", "exerciseId", "sets", "weightKg", "reps"]);

const SET_FIELDS = new Set(["id", "weightKg", "reps", "done", "isWarmup", "completedAt"]);

const idSchema = z.string().min(1);

const userSchema = z.looseObject({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  password: z.string(),
  role: z.enum(["coach", "client"]),
  clientId: z.string().min(1).optional(),
});

const clientSchema = z.looseObject({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  userId: z.string(),
  createdAt: z.string(),
});

const measurementSchema = z.looseObject({
  id: idSchema,
  clientId: z.string(),
  date: z.string(),
  weightKg: z.number().finite(),
  chestCm: z.number().finite().optional(),
  waistCm: z.number().finite().optional(),
  hipsCm: z.number().finite().optional(),
  thighCm: z.number().finite().optional(),
});

const setSchema = z.looseObject({
  id: idSchema,
  weightKg: z.number().finite(),
  reps: z.number().finite(),
  done: z.boolean(),
  isWarmup: z.boolean(),
  completedAt: z.string().nullable(),
});

const sessionExerciseSchema = z.looseObject({
  id: idSchema,
  exerciseId: z.string(),
  sets: z.array(setSchema),
});

const sessionSchema = z.looseObject({
  id: idSchema,
  clientId: z.string(),
  date: z.string(),
  title: z.string(),
  loggedBy: z.enum(["coach", "client"]),
  workoutId: z.string().nullable(),
  exercises: z.array(sessionExerciseSchema),
});

const moveSchema = z.looseObject({
  id: idSchema,
  exerciseId: z.string(),
  sets: z.number().int(),
  reps: z.string(),
});

const workoutSchema = z.looseObject({
  id: idSchema,
  clientId: z.string(),
  name: z.string(),
  assignedAt: z.string(),
  moves: z.array(moveSchema),
});

const sheetSchema = z.looseObject({
  version: z.literal(SHEET_VERSION),
  users: z.array(userSchema),
  clients: z.array(clientSchema),
  measurements: z.array(measurementSchema),
  sessions: z.array(sessionSchema),
  workouts: z.array(workoutSchema),
});

const restSchema = z.looseObject({
  sessionId: idSchema,
  setId: idSchema,
  status: z.enum(["running", "paused"]),
  endsAt: z.number().finite().nullable(),
  remainingMs: z.number().finite().nullable(),
});

const envelopeSchema = z.looseObject({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.iso.datetime(),
  keys: z.record(z.string(), z.unknown()),
});

const scalarSchemas: Record<string, z.ZodType> = {
  [SESSION_KEY]: z.string().min(1),
  [THEME_STORAGE_KEY]: z.enum(["system", "light", "dark"]),
  [ACCENT_STORAGE_KEY]: z.enum(["rust", "green"]),
  [REST_STORAGE_KEY]: restSchema,
};

function fail(error: string): BackupFailure {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdRecordArray(
  value: unknown,
): value is Array<Record<string, unknown> & { id: string }> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => isRecord(item) && typeof item.id === "string" && item.id.length > 0,
    )
  );
}

function sortRecord(keys: Record<string, unknown>) {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(keys).sort()) sorted[key] = keys[key];
  return sorted;
}

/** Objects and arrays are JSON. Everything else is the raw stored string. */
export function decodeStored(raw: string): unknown {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

export function encodeStored(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function countList(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.length : 0;
}

function summarize(exportedAt: string | null, keys: Record<string, unknown>): BackupSummary {
  const sheet = keys[STORAGE_KEY_V2];
  const record = isRecord(sheet) ? sheet : {};
  return {
    exportedAt,
    users: countList(record, "users"),
    clients: countList(record, "clients"),
    measurements: countList(record, "measurements"),
    sessions: countList(record, "sessions"),
    workouts: countList(record, "workouts"),
    keys: Object.keys(keys).sort(),
  };
}

function withExtras(
  migrated: Record<string, unknown>,
  raw: unknown,
  known: Set<string>,
): Record<string, unknown> {
  if (!isRecord(raw)) return migrated;
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key)) extra[key] = value;
  }
  return { ...extra, ...migrated };
}

/**
 * migrateSheet rebuilds sessions and drops keys it does not know.
 * Copy unknown fields back so an older file can still carry a future field.
 * Legacy exercise fields (weightKg, reps, numeric sets) stay off the v2 row.
 */
function migratePreserving(raw: unknown): unknown {
  const migrated = migrateSheet(raw);
  const merged = withExtras(
    migrated as unknown as Record<string, unknown>,
    raw,
    new Set(Object.keys(migrated)),
  );
  const rawSessions = isRecord(raw) && Array.isArray(raw.sessions) ? raw.sessions : [];
  merged.sessions = migrated.sessions.map((session, index) => {
    const rawSession = rawSessions[index];
    const next = withExtras(session as unknown as Record<string, unknown>, rawSession, SESSION_FIELDS);
    const rawExercises =
      isRecord(rawSession) && Array.isArray(rawSession.exercises) ? rawSession.exercises : [];
    next.exercises = session.exercises.map((exercise, exerciseIndex) => {
      const rawExercise = rawExercises[exerciseIndex];
      const legacy = isRecord(rawExercise) && !Array.isArray(rawExercise.sets);
      const known = legacy ? LEGACY_EXERCISE_FIELDS : EXERCISE_FIELDS;
      const nextExercise = withExtras(
        exercise as unknown as Record<string, unknown>,
        rawExercise,
        known,
      );
      const rawSets = isRecord(rawExercise) && Array.isArray(rawExercise.sets) ? rawExercise.sets : [];
      nextExercise.sets = exercise.sets.map((set, setIndex) =>
        withExtras(set as unknown as Record<string, unknown>, rawSets[setIndex], SET_FIELDS),
      );
      return nextExercise;
    });
    return next;
  });
  return merged;
}

function invalid(key: string) {
  return `This backup file is not valid (${key}). Nothing was changed.`;
}

function acceptSheet(value: unknown, key: string): { sheet: unknown } | { error: string } {
  const parsed = sheetSchema.safeParse(value);
  if (!parsed.success) return { error: invalid(key) };
  return { sheet: parsed.data };
}

function normalizeSheet(
  input: Record<string, unknown>,
): { keys: Record<string, unknown> } | { error: string } {
  const keys: Record<string, unknown> = {};
  const current = input[STORAGE_KEY_V2];
  const legacy = input[STORAGE_KEY_V1];

  if (current !== undefined && isRecord(current) && current.version === SHEET_VERSION) {
    const accepted = acceptSheet(current, STORAGE_KEY_V2);
    if ("error" in accepted) return accepted;
    keys[STORAGE_KEY_V2] = accepted.sheet;
    if (legacy !== undefined) keys[STORAGE_KEY_V1] = legacy;
    return { keys };
  }

  const source = current !== undefined ? current : legacy;
  const sourceKey = current !== undefined ? STORAGE_KEY_V2 : STORAGE_KEY_V1;
  if (source === undefined) return { keys };

  if (!isRecord(source) || !Array.isArray(source.users) || !Array.isArray(source.clients)) {
    return { error: invalid(sourceKey) };
  }

  const accepted = acceptSheet(migratePreserving(source), STORAGE_KEY_V2);
  if ("error" in accepted) return accepted;
  keys[STORAGE_KEY_V2] = accepted.sheet;
  return { keys };
}

function duplicateId(value: unknown): string | null {
  if (Array.isArray(value)) {
    if (isIdRecordArray(value)) {
      const seen = new Set<string>();
      for (const item of value) {
        if (seen.has(item.id)) {
          return `This backup has two records with the id ${item.id}. Nothing was changed.`;
        }
        seen.add(item.id);
        const nested = duplicateId(item);
        if (nested) return nested;
      }
      return null;
    }
    for (const item of value) {
      const nested = duplicateId(item);
      if (nested) return nested;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const nested of Object.values(value)) {
    const found = duplicateId(nested);
    if (found) return found;
  }
  return null;
}

function normalizeKeys(
  input: Record<string, unknown>,
): { keys: Record<string, unknown> } | { error: string } {
  for (const key of Object.keys(input)) {
    if (!key.startsWith(STORAGE_PREFIX)) {
      return {
        error: `This backup has a key that is not Repsheet data (${key}). Nothing was changed.`,
      };
    }
  }

  const keys: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!KNOWN_KEYS.has(key)) keys[key] = value;
  }

  for (const [key, schema] of Object.entries(scalarSchemas)) {
    if (!(key in input)) continue;
    const parsed = schema.safeParse(input[key]);
    if (!parsed.success) return { error: invalid(key) };
    keys[key] = parsed.data;
  }

  const sheet = normalizeSheet(input);
  if ("error" in sheet) return sheet;
  Object.assign(keys, sheet.keys);

  const duplicate = duplicateId(keys);
  if (duplicate) return { error: duplicate };
  return { keys };
}

function wrapLegacySheet(
  raw: Record<string, unknown>,
): { exportedAt: string | null; keys: Record<string, unknown> } | { error: string } {
  if (!Array.isArray(raw.users) || !Array.isArray(raw.clients)) {
    return { error: "This file is not a Repsheet backup. Nothing was changed." };
  }
  const key = raw.version === SHEET_VERSION ? STORAGE_KEY_V2 : STORAGE_KEY_V1;
  return { exportedAt: null, keys: { [key]: raw } };
}

function upgradeEnvelope(
  raw: unknown,
): { exportedAt: string | null; keys: Record<string, unknown> } | { error: string } {
  if (!isRecord(raw)) {
    return { error: "This file is not a Repsheet backup. Nothing was changed." };
  }
  if (raw.schemaVersion === undefined) return wrapLegacySheet(raw);
  if (typeof raw.schemaVersion === "number" && raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { error: "This backup was made by a newer Repsheet. Nothing was changed." };
  }
  const parsed = envelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "This backup file is not valid (schemaVersion). Nothing was changed." };
  }
  return { exportedAt: parsed.data.exportedAt, keys: parsed.data.keys };
}

export function prepareImport(text: string): BackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, "").trim()) as unknown;
  } catch {
    return fail("That file is not valid JSON. Nothing was changed.");
  }
  const upgraded = upgradeEnvelope(parsed);
  if ("error" in upgraded) return fail(upgraded.error);
  const normalized = normalizeKeys(upgraded.keys);
  if ("error" in normalized) return fail(normalized.error);
  const keys = sortRecord(normalized.keys);
  return {
    ok: true,
    backup: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: upgraded.exportedAt,
      keys,
      summary: summarize(upgraded.exportedAt, keys),
    },
  };
}

function mergeById(
  device: Array<Record<string, unknown> & { id: string }>,
  incoming: Array<Record<string, unknown> & { id: string }>,
) {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const merged: Array<Record<string, unknown> & { id: string }> = [];
  for (const item of device) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(incomingById.get(item.id) ?? item);
  }
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function mergeValue(device: unknown, incoming: unknown): unknown {
  if (isIdRecordArray(device) && isIdRecordArray(incoming)) {
    return mergeById(device, incoming);
  }
  if (isRecord(device) && isRecord(incoming)) {
    const next: Record<string, unknown> = { ...device };
    for (const [key, value] of Object.entries(incoming)) {
      next[key] = key in device ? mergeValue(device[key], value) : value;
    }
    return next;
  }
  return incoming;
}

function mergeKeys(device: Record<string, unknown>, incoming: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...device };
  for (const [key, value] of Object.entries(incoming)) {
    if (key === SESSION_KEY && device[SESSION_KEY] !== undefined) continue;
    if (!(key in device)) {
      next[key] = value;
      continue;
    }
    next[key] = mergeValue(device[key], value);
  }
  return next;
}

function readDevice(storage: KeyedStorage) {
  const names = storage.keys().filter((key) => key.startsWith(STORAGE_PREFIX));
  const values: Record<string, unknown> = {};
  for (const key of names) {
    const raw = storage.getItem(key);
    if (raw !== null) values[key] = decodeStored(raw);
  }
  return { names, values };
}

function writeDevice(storage: KeyedStorage, previous: string[], next: Record<string, unknown>) {
  const encoded = new Map<string, string>();
  for (const [key, value] of Object.entries(next)) encoded.set(key, encodeStored(value));
  for (const [key, value] of encoded) storage.setItem(key, value);
  for (const key of previous) {
    if (!encoded.has(key)) storage.removeItem(key);
  }
}

export function applyImport(storage: KeyedStorage, prepared: PreparedBackup, mode: BackupMode) {
  const device = readDevice(storage);
  const next = mode === "replace" ? { ...prepared.keys } : mergeKeys(device.values, prepared.keys);
  writeDevice(storage, device.names, next);
}

/** Validate first. A bad file returns before localStorage is touched. */
export function restoreBackup(storage: KeyedStorage, text: string, mode: BackupMode): BackupResult {
  const prepared = prepareImport(text);
  if (!prepared.ok) return prepared;
  applyImport(storage, prepared.backup, mode);
  return prepared;
}

export function exportBackup(storage: KeyedStorage, now: Date): BackupFile {
  const keys: Record<string, unknown> = {};
  for (const key of storage.keys()) {
    if (!key.startsWith(STORAGE_PREFIX)) continue;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    keys[key] = decodeStored(raw);
  }
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    keys: sortRecord(keys),
  };
}

export function serializeBackup(file: BackupFile) {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function backupFilename(exportedAt: string) {
  return `repsheet-backup-${exportedAt.slice(0, 10)}.json`;
}

export function browserStorage(): KeyedStorage {
  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
    keys: () => {
      const names: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key) names.push(key);
      }
      return names;
    },
  };
}
