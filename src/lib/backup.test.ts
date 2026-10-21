import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BACKUP_SCHEMA_VERSION,
  applyImport,
  backupFilename,
  decodeStored,
  exportBackup,
  prepareImport,
  restoreBackup,
  serializeBackup,
  type KeyedStorage,
} from "./backup";
import {
  SESSION_KEY,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  migrateSheet,
  persistedSheet,
} from "./migrate";
import { REST_STORAGE_KEY } from "./rest-timer";
import { createSeed } from "./seed";
import { ACCENT_STORAGE_KEY, THEME_STORAGE_KEY } from "./theme";
import { SHEET_VERSION } from "./types";

const NOW = new Date("2026-10-21T18:00:00.000Z");

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  let writes = 0;
  const storage = {
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      writes += 1;
      items.set(key, value);
    },
    removeItem(key: string) {
      writes += 1;
      items.delete(key);
    },
    keys() {
      return [...items.keys()];
    },
    snapshot() {
      return Object.fromEntries([...items.entries()].sort(([a], [b]) => a.localeCompare(b)));
    },
    get writes() {
      return writes;
    },
  };
  return storage satisfies KeyedStorage & {
    snapshot: () => Record<string, string>;
    writes: number;
  };
}

function sheet(extra: Record<string, unknown> = {}) {
  return { ...persistedSheet(createSeed()), ...extra };
}

function user(id: string, name: string) {
  return {
    id,
    name,
    email: `${id}@repsheet.app`,
    password: "secret",
    role: "client" as const,
    clientId: `client-${id}`,
  };
}

function client(id: string, name: string) {
  return {
    id,
    name,
    email: `${id}@repsheet.app`,
    userId: `user-${id}`,
    createdAt: "2026-10-01",
  };
}

function setRow(id: string) {
  return {
    id,
    weightKg: 100,
    reps: 5,
    done: true,
    isWarmup: false,
    completedAt: null,
  };
}

function session(id: string, clientId: string) {
  return {
    id,
    clientId,
    date: "2026-10-01",
    title: id,
    loggedBy: "coach" as const,
    workoutId: null,
    exercises: [
      {
        id: `${id}-ex`,
        exerciseId: "ex-back-squat",
        sets: [setRow(`${id}-set`)],
      },
    ],
  };
}

function emptyLists() {
  return { measurements: [], sessions: [], workouts: [] };
}

function envelope(keys: Record<string, unknown>, exportedAt = NOW.toISOString()) {
  return JSON.stringify({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt, keys });
}

function legacySheet() {
  return {
    users: [user("user-jordan", "Jordan Hale")],
    clients: [client("client-jordan", "Jordan Hale")],
    measurements: [
      {
        id: "m-1",
        clientId: "client-jordan",
        date: "2026-09-23",
        weightKg: 72.8,
        waistCm: 81,
      },
    ],
    workouts: [
      {
        id: "workout-1",
        clientId: "client-jordan",
        name: "Strength A",
        assignedAt: "2026-09-30",
        moves: [{ id: "wm-1", exerciseId: "ex-back-squat", sets: 4, reps: "5" }],
      },
    ],
    sessions: [
      {
        id: "session-1",
        clientId: "client-jordan",
        date: "2026-09-23",
        title: "Lower body",
        note: "belt",
        exercises: [
          { id: "se-1", exerciseId: "ex-back-squat", weightKg: 100.25, reps: 5, sets: 3, tempo: "20X1" },
        ],
      },
    ],
    weeklyPlans: [{ id: "plan-1", title: "Cut" }],
  };
}

function decodedSheet(storage: { getItem: (key: string) => string | null }) {
  const raw = storage.getItem(STORAGE_KEY_V2);
  assert.ok(raw);
  return decodeStored(raw) as Record<string, unknown>;
}

test("round trip exports every repsheet key and restores it", () => {
  const storedSheet = sheet();
  const firstUser = storedSheet.users[0];
  const firstSet = storedSheet.sessions[0]?.exercises[0]?.sets[0];
  assert.ok(firstUser && firstSet);
  Object.assign(firstUser, { coachNotes: "keep" });
  Object.assign(firstSet, { e1rm: 140 });

  const storage = memoryStorage({
    [STORAGE_KEY_V2]: JSON.stringify(storedSheet),
    [REST_STORAGE_KEY]: JSON.stringify({
      sessionId: "session-jordan-lower",
      setId: "se-1-set-1",
      status: "paused",
      endsAt: null,
      remainingMs: 15000,
      cue: "breathe",
    }),
    [SESSION_KEY]: "user-alex",
    [THEME_STORAGE_KEY]: "dark",
    [ACCENT_STORAGE_KEY]: "green",
    "repsheet.weekly": JSON.stringify({ plans: [{ id: "week-1", focus: "squat" }] }),
    "repsheet.flag": "on",
    "other.app": "leave me",
  });

  const file = exportBackup(storage, NOW);
  assert.equal(file.schemaVersion, BACKUP_SCHEMA_VERSION);
  assert.equal(file.exportedAt, NOW.toISOString());
  assert.equal(backupFilename(file.exportedAt), "repsheet-backup-2026-10-21.json");
  assert.equal("other.app" in file.keys, false);
  assert.equal(file.keys["repsheet.flag"], "on");
  assert.deepEqual(Object.keys(file.keys), [
    ACCENT_STORAGE_KEY,
    "repsheet.flag",
    REST_STORAGE_KEY,
    THEME_STORAGE_KEY,
    SESSION_KEY,
    STORAGE_KEY_V2,
    "repsheet.weekly",
  ]);

  const text = serializeBackup(file);
  const empty = memoryStorage({ "other.app": "leave me" });
  const restored = restoreBackup(empty, text, "replace");
  assert.equal(restored.ok, true);
  if (!restored.ok) return;
  assert.equal(restored.backup.summary.clients, storedSheet.clients.length);
  assert.equal(restored.backup.summary.workouts, storedSheet.workouts.length);
  assert.equal(restored.backup.summary.sessions, storedSheet.sessions.length);
  assert.equal(restored.backup.summary.measurements, storedSheet.measurements.length);
  assert.equal(restored.backup.summary.users, storedSheet.users.length);

  assert.equal(empty.getItem("other.app"), "leave me");
  assert.equal(empty.getItem(SESSION_KEY), "user-alex");
  assert.equal(empty.getItem(THEME_STORAGE_KEY), "dark");
  assert.equal(empty.getItem(ACCENT_STORAGE_KEY), "green");
  assert.equal(empty.getItem("repsheet.flag"), "on");
  const weekly = empty.getItem("repsheet.weekly");
  assert.ok(weekly);
  assert.deepEqual(JSON.parse(weekly), { plans: [{ id: "week-1", focus: "squat" }] });
  const rest = empty.getItem(REST_STORAGE_KEY);
  assert.ok(rest);
  assert.equal(JSON.parse(rest).cue, "breathe");
  const saved = decodedSheet(empty);
  assert.equal((saved.users as Array<{ coachNotes?: string }>)[0]?.coachNotes, "keep");
  const set = (
    saved.sessions as Array<{ exercises: Array<{ sets: Array<{ e1rm?: number }> }> }>
  )[0]?.exercises[0]?.sets[0];
  assert.equal(set?.e1rm, 140);
  assert.equal(saved.version, SHEET_VERSION);
});

test("invalid and corrupt files do not change stored data", () => {
  const storage = memoryStorage({
    [STORAGE_KEY_V2]: JSON.stringify(sheet()),
    [SESSION_KEY]: "user-alex",
    [THEME_STORAGE_KEY]: "dark",
  });
  const before = storage.snapshot();
  const badFiles = [
    "",
    "{",
    "null",
    "[]",
    JSON.stringify({ hello: "world" }),
    JSON.stringify({ schemaVersion: 2, exportedAt: NOW.toISOString(), keys: {} }),
    JSON.stringify({ schemaVersion: 1, keys: {} }),
    JSON.stringify({ schemaVersion: 1, exportedAt: "yesterday", keys: {} }),
    envelope({ "not-repsheet": { id: "x" } }),
    envelope({
      [STORAGE_KEY_V2]: {
        ...sheet(),
        users: [{ ...sheet().users[0], role: "admin" }],
      },
    }),
    envelope({
      [STORAGE_KEY_V2]: {
        ...sheet(),
        sessions: [
          {
            ...sheet().sessions[0],
            exercises: [
              {
                ...sheet().sessions[0]?.exercises[0],
                sets: [{ ...sheet().sessions[0]?.exercises[0]?.sets[0], reps: "eight" }],
              },
            ],
          },
        ],
      },
    }),
    envelope({
      [STORAGE_KEY_V2]: {
        ...sheet(),
        sessions: [sheet().sessions[0], sheet().sessions[0]],
      },
    }),
    envelope({
      [REST_STORAGE_KEY]: { status: "done", endsAt: 1, remainingMs: null, sessionId: "s", setId: "t" },
    }),
    envelope({ [THEME_STORAGE_KEY]: "blue" }),
    envelope({ [ACCENT_STORAGE_KEY]: "blue" }),
    envelope({ [SESSION_KEY]: "" }),
    envelope({ [STORAGE_KEY_V2]: "not-a-sheet" }),
  ];

  for (const text of badFiles) {
    const prepared = prepareImport(text);
    assert.equal(prepared.ok, false, text.slice(0, 80));
    if (!prepared.ok) assert.match(prepared.error, /Nothing was changed/);
    const restored = restoreBackup(storage, text, "replace");
    assert.equal(restored.ok, false);
    assert.deepEqual(storage.snapshot(), before);
  }
  assert.equal(storage.writes, 0);
});

test("a version 2 sheet with a bad known field is not repaired", () => {
  const broken = sheet();
  const sessionRow = broken.sessions[0];
  assert.ok(sessionRow);
  broken.sessions[0] = {
    ...sessionRow,
    exercises: sessionRow.exercises.map((exercise, index) =>
      index === 0
        ? {
            ...exercise,
            sets: exercise.sets.map((set, setIndex) =>
              setIndex === 0 ? { ...set, reps: "eight" as unknown as number } : set,
            ),
          }
        : exercise,
    ),
  };
  const storage = memoryStorage({ [STORAGE_KEY_V2]: JSON.stringify(sheet()) });
  const before = storage.snapshot();
  const result = restoreBackup(storage, envelope({ [STORAGE_KEY_V2]: broken }), "replace");
  assert.equal(result.ok, false);
  assert.deepEqual(storage.snapshot(), before);
  const saved = decodedSheet(storage);
  const reps = (
    saved.sessions as Array<{ exercises: Array<{ sets: Array<{ reps: number }> }> }>
  )[0]?.exercises[0]?.sets[0]?.reps;
  assert.equal(reps, sheet().sessions[0]?.exercises[0]?.sets[0]?.reps);
});

test("older files migrate v1 to v2 with the existing migration and keep unknown fields", () => {
  const legacy = legacySheet();
  const cases = [
    JSON.stringify(legacy),
    envelope({ [STORAGE_KEY_V1]: legacy }),
    envelope({ [STORAGE_KEY_V2]: { ...legacy, version: 1 } }),
  ];

  for (const text of cases) {
    const prepared = prepareImport(text);
    assert.equal(prepared.ok, true, text.slice(0, 40));
    if (!prepared.ok) return;
    assert.equal(prepared.backup.summary.clients, 1);
    assert.equal(prepared.backup.summary.workouts, 1);
    assert.equal(prepared.backup.summary.sessions, 1);
    assert.equal(prepared.backup.summary.measurements, 1);
    assert.equal(STORAGE_KEY_V1 in prepared.backup.keys, false);

    const storage = memoryStorage({
      [STORAGE_KEY_V2]: JSON.stringify(sheet()),
      [SESSION_KEY]: "user-alex",
    });
    const before = storage.snapshot();
    applyImport(storage, prepared.backup, "replace");
    const saved = decodedSheet(storage);
    const migrated = migrateSheet(legacy);
    assert.equal(saved.version, SHEET_VERSION);
    assert.deepEqual(saved.sessions, [
      {
        ...migrated.sessions[0],
        note: "belt",
        exercises: [
          {
            ...migrated.sessions[0]?.exercises[0],
            tempo: "20X1",
            sets: migrated.sessions[0]?.exercises[0]?.sets,
          },
        ],
      },
    ]);
    assert.equal("weightKg" in ((saved.sessions as Array<{ exercises: Array<Record<string, unknown>> }>)[0]?.exercises[0] ?? {}), false);
    assert.deepEqual(saved.weeklyPlans, [{ id: "plan-1", title: "Cut" }]);
    assert.deepEqual(saved.users, legacy.users);
    assert.deepEqual(saved.measurements, legacy.measurements);
    assert.equal(storage.getItem(STORAGE_KEY_V1), null);
    assert.equal(storage.getItem(SESSION_KEY), null);
    assert.notDeepEqual(storage.snapshot(), before);
  }
});

test("unknown fields and future keys pass through while known fields stay strict", () => {
  const stored = sheet({
    programs: [{ id: "program-1", name: "Strength", weeks: 4 }],
  });
  const text = envelope({
    [STORAGE_KEY_V2]: stored,
    "repsheet.progression": {
      rules: [{ id: "rule-1", gainKg: 2.5, note: "upper" }],
    },
  });
  const prepared = prepareImport(text);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const savedSheet = prepared.backup.keys[STORAGE_KEY_V2] as Record<string, unknown>;
  assert.deepEqual(savedSheet.programs, [{ id: "program-1", name: "Strength", weeks: 4 }]);
  assert.deepEqual(prepared.backup.keys["repsheet.progression"], {
    rules: [{ id: "rule-1", gainKg: 2.5, note: "upper" }],
  });

  const rejected = prepareImport(
    envelope({
      [STORAGE_KEY_V2]: {
        ...stored,
        users: stored.users.map((person, index) =>
          index === 0 ? { ...person, role: "owner" } : person,
        ),
      },
      "repsheet.progression": { rules: [{ id: "rule-1", gainKg: 2.5 }] },
    }),
  );
  assert.equal(rejected.ok, false);
});

test("merge is idempotent and matches records by id", () => {
  const deviceSheet = {
    version: SHEET_VERSION,
    users: [user("a", "Ada"), user("b", "Bea")],
    clients: [client("a", "Ada"), client("b", "Bea")],
    measurements: [],
    sessions: [session("s1", "a")],
    workouts: [],
    programs: [{ id: "p1", name: "Device program", weeks: 4 }],
  };
  const fileSheet = {
    version: SHEET_VERSION,
    users: [user("b", "Bea Updated"), user("c", "Cy")],
    clients: [client("b", "Bea Updated"), client("c", "Cy")],
    measurements: [],
    sessions: [
      {
        ...session("s1", "a"),
        title: "From file",
        exercises: [
          {
            id: "s1-ex",
            exerciseId: "ex-bench-press",
            sets: [setRow("file-set")],
          },
        ],
      },
      session("s2", "c"),
    ],
    workouts: [],
    programs: [
      { id: "p1", name: "File program", weeks: 6 },
      { id: "p2", name: "New program", weeks: 3 },
    ],
  };
  const text = envelope({
    [STORAGE_KEY_V2]: fileSheet,
    [SESSION_KEY]: "user-from-file",
    [THEME_STORAGE_KEY]: "light",
    "repsheet.progression": {
      rules: [
        { id: "rule-1", gainKg: 5 },
        { id: "rule-2", gainKg: 2.5 },
      ],
    },
  });

  const storage = memoryStorage({
    [STORAGE_KEY_V2]: JSON.stringify(deviceSheet),
    [SESSION_KEY]: "user-on-device",
    [ACCENT_STORAGE_KEY]: "rust",
    "repsheet.progression": JSON.stringify({
      rules: [{ id: "rule-1", gainKg: 2.5, note: "device" }],
      untouched: true,
    }),
  });

  const once = restoreBackup(storage, text, "merge");
  assert.equal(once.ok, true);
  const afterOnce = storage.snapshot();
  const merged = decodedSheet(storage);
  assert.deepEqual(
    (merged.users as Array<{ id: string; name: string }>).map((person) => [person.id, person.name]),
    [
      ["a", "Ada"],
      ["b", "Bea Updated"],
      ["c", "Cy"],
    ],
  );
  assert.deepEqual(
    (merged.clients as Array<{ id: string }>).map((person) => person.id),
    ["a", "b", "c"],
  );
  const sessions = merged.sessions as Array<{ id: string; title: string; exercises: Array<{ sets: Array<{ id: string }> }> }>;
  assert.deepEqual(
    sessions.map((row) => row.id),
    ["s1", "s2"],
  );
  assert.equal(sessions[0]?.title, "From file");
  assert.equal(sessions[0]?.exercises[0]?.sets[0]?.id, "file-set");
  assert.deepEqual(merged.programs, [
    { id: "p1", name: "File program", weeks: 6 },
    { id: "p2", name: "New program", weeks: 3 },
  ]);
  const progression = storage.getItem("repsheet.progression");
  assert.ok(progression);
  assert.deepEqual(JSON.parse(progression), {
    rules: [
      { id: "rule-1", gainKg: 5 },
      { id: "rule-2", gainKg: 2.5 },
    ],
    untouched: true,
  });
  assert.equal(storage.getItem(SESSION_KEY), "user-on-device");
  assert.equal(storage.getItem(THEME_STORAGE_KEY), "light");
  assert.equal(storage.getItem(ACCENT_STORAGE_KEY), "rust");

  const twice = restoreBackup(storage, text, "merge");
  assert.equal(twice.ok, true);
  assert.deepEqual(storage.snapshot(), afterOnce);
  assert.equal((decodedSheet(storage).users as unknown[]).length, 3);
  assert.equal((decodedSheet(storage).sessions as unknown[]).length, 2);
});

test("replace makes device keys match the file", () => {
  const fileSheet = {
    version: SHEET_VERSION,
    users: [user("c", "Cy")],
    clients: [client("c", "Cy")],
    ...emptyLists(),
  };
  const storage = memoryStorage({
    [STORAGE_KEY_V2]: JSON.stringify({
      version: SHEET_VERSION,
      users: [user("a", "Ada")],
      clients: [client("a", "Ada")],
      ...emptyLists(),
    }),
    [SESSION_KEY]: "user-on-device",
    [ACCENT_STORAGE_KEY]: "rust",
    "repsheet.weekly": "{\"id\":\"local\"}",
  });
  const result = restoreBackup(
    storage,
    envelope({
      [STORAGE_KEY_V2]: fileSheet,
      [SESSION_KEY]: "user-from-file",
    }),
    "replace",
  );
  assert.equal(result.ok, true);
  assert.deepEqual(
    (decodedSheet(storage).users as Array<{ id: string }>).map((person) => person.id),
    ["c"],
  );
  assert.equal(storage.getItem(SESSION_KEY), "user-from-file");
  assert.equal(storage.getItem(ACCENT_STORAGE_KEY), null);
  assert.equal(storage.getItem("repsheet.weekly"), null);
});

test("a usable v2 backup keeps a leftover v1 key", () => {
  const legacy = legacySheet();
  const prepared = prepareImport(
    envelope({
      [STORAGE_KEY_V2]: sheet(),
      [STORAGE_KEY_V1]: legacy,
    }),
  );
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.backup.summary.sessions, sheet().sessions.length);
  const storage = memoryStorage();
  applyImport(storage, prepared.backup, "replace");
  assert.ok(storage.getItem(STORAGE_KEY_V1));
  assert.equal(decodedSheet(storage).version, SHEET_VERSION);
  assert.equal((decodedSheet(storage).sessions as unknown[]).length, sheet().sessions.length);
});
