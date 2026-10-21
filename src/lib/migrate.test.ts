import assert from "node:assert/strict";
import { test } from "node:test";
import { formatKg, formatSet } from "./format";
import {
  MAX_EXPANDED_SETS,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  expandedSetCount,
  migrateSheet,
  readStoredSheet,
  type SheetStorage,
} from "./migrate";
import { createSeed } from "./seed";
import { SHEET_VERSION, type SessionSet } from "./types";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  const storage: SheetStorage = {
    getItem(key) {
      return items.get(key) ?? null;
    },
    setItem(key, value) {
      items.set(key, value);
    },
    removeItem(key) {
      items.delete(key);
    },
  };
  return storage;
}

function legacySheet() {
  return {
    users: [
      {
        id: "user-alex",
        name: "Alex Rivera",
        email: "alex@repsheet.app",
        password: "coach",
        role: "coach" as const,
      },
    ],
    clients: [
      {
        id: "client-jordan",
        name: "Jordan Hale",
        email: "jordan@repsheet.app",
        userId: "user-jordan",
        createdAt: "2026-08-12",
      },
    ],
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
        exercises: [
          { id: "se-1", exerciseId: "ex-back-squat", weightKg: 100.25, reps: 5, sets: 3 },
          { id: "se-2", exerciseId: "ex-push-up", weightKg: 0, reps: 12, sets: 1 },
          { id: "se-3", exerciseId: "ex-plank", weightKg: 0, reps: 40, sets: 0 },
          { id: "se-4", exerciseId: "ex-bench-press", weightKg: 70, reps: 6, sets: 2.5 },
          { exerciseId: "ex-overhead-press", weightKg: 40, reps: 8 },
        ],
      },
    ],
  };
}

function workingSet(id: string, weightKg: number, reps: number): SessionSet {
  return { id, weightKg, reps, done: true, isWarmup: false, completedAt: null };
}

test("a positive integer set count becomes that many rows, and other counts become one", () => {
  assert.equal(expandedSetCount(1), 1);
  assert.equal(expandedSetCount(3), 3);
  assert.equal(expandedSetCount(20), 20);
  assert.equal(expandedSetCount(MAX_EXPANDED_SETS + 50), MAX_EXPANDED_SETS);
  assert.equal(expandedSetCount(0), 1);
  assert.equal(expandedSetCount(-2), 1);
  assert.equal(expandedSetCount(2.5), 1);
  assert.equal(expandedSetCount("3"), 1);
  assert.equal(expandedSetCount(undefined), 1);
  assert.equal(expandedSetCount(null), 1);
});

test("migrates a v1 session into per-set rows without dropping other sheet data", () => {
  const legacy = legacySheet();
  const migrated = migrateSheet(legacy);
  const session = migrated.sessions[0];
  assert.ok(session);
  assert.equal(migrated.version, SHEET_VERSION);
  assert.equal(session.loggedBy, "coach");
  assert.equal(session.workoutId, null);
  assert.equal(session.title, "Lower body");
  assert.deepEqual(migrated.users, legacy.users);
  assert.deepEqual(
    migrated.clients,
    legacy.clients.map((client) => ({ ...client, goalWeightKg: null })),
  );
  assert.deepEqual(migrated.measurements, legacy.measurements);
  assert.deepEqual(migrated.workouts, legacy.workouts);
  assert.equal(migrated.measurements[0]?.weightKg, 72.8);
  assert.equal(migrated.workouts[0]?.moves[0]?.sets, 4);
  assert.equal(migrated.workouts[0]?.moves[0]?.reps, "5");

  const [squat, pushUp, plank, bench, press] = session.exercises;
  assert.ok(squat && pushUp && plank && bench && press);

  assert.equal("weightKg" in squat, false);
  assert.deepEqual(squat.sets, [
    workingSet("se-1-set-1", 100.25, 5),
    workingSet("se-1-set-2", 100.25, 5),
    workingSet("se-1-set-3", 100.25, 5),
  ]);
  assert.equal(formatSet(squat), `3 × 5 · ${formatKg(100.25)}`);

  assert.deepEqual(pushUp.sets, [workingSet("se-2-set-1", 0, 12)]);
  assert.equal(formatSet(pushUp), "1 × 12 · Bodyweight");

  assert.deepEqual(plank.sets, [workingSet("se-3-set-1", 0, 40)]);
  assert.equal(press.id, "exercise-5");
  assert.deepEqual(press.sets, [workingSet("exercise-5-set-1", 40, 8)]);
  assert.equal(bench.sets.length, 1);
  assert.equal(bench.sets[0]?.weightKg, 70);
  assert.equal(bench.sets[0]?.reps, 6);
});

test("migrating a version 2 sheet keeps client logs, warm-ups, and clock times", () => {
  const already = {
    version: SHEET_VERSION,
    users: [{ id: "user-jordan" }],
    clients: [{ id: "client-jordan" }],
    measurements: [],
    workouts: [],
    sessions: [
      {
        id: "session-live",
        clientId: "client-jordan",
        date: "2026-10-21",
        title: "Strength A",
        loggedBy: "client",
        workoutId: "workout-jordan-a",
        exercises: [
          {
            id: "se-live",
            exerciseId: "ex-bench-press",
            sets: [
              {
                id: "warm",
                weightKg: 40,
                reps: 5,
                done: true,
                isWarmup: true,
                completedAt: "2026-10-21T09:00:00.000Z",
              },
              {
                id: "work",
                weightKg: 60,
                reps: 8,
                done: false,
                isWarmup: false,
                completedAt: null,
              },
            ],
          },
        ],
      },
    ],
  };
  const once = migrateSheet(already);
  const twice = migrateSheet(once);
  assert.deepEqual(twice, once);
  assert.equal(once.sessions[0]?.loggedBy, "client");
  assert.equal(once.sessions[0]?.workoutId, "workout-jordan-a");
  assert.equal(once.sessions[0]?.exercises[0]?.sets[0]?.isWarmup, true);
  assert.equal(once.sessions[0]?.exercises[0]?.sets[0]?.completedAt, "2026-10-21T09:00:00.000Z");
  assert.equal(once.sessions[0]?.exercises[0]?.sets[1]?.done, false);
  assert.equal(once.sessions[0]?.exercises[0]?.sets[1]?.completedAt, null);
});

test("empty data migrates to an empty version 2 sheet", () => {
  const empty = {
    version: SHEET_VERSION,
    users: [],
    clients: [],
    measurements: [],
    sessions: [],
    workouts: [],
  };
  assert.deepEqual(migrateSheet(undefined), empty);
  assert.deepEqual(migrateSheet(null), empty);
  assert.deepEqual(migrateSheet({}), empty);
  assert.deepEqual(migrateSheet([]), empty);
  assert.deepEqual(migrateSheet({ users: [], clients: [], sessions: [] }), empty);
});

test("empty storage is not a sheet, and a stored v1 sheet is written to v2", () => {
  assert.equal(readStoredSheet(memoryStorage()), null);

  const legacy = legacySheet();
  const storage = memoryStorage({ [STORAGE_KEY_V1]: JSON.stringify(legacy) });
  const migrated = readStoredSheet(storage);
  assert.deepEqual(migrated, migrateSheet(legacy));
  assert.equal(storage.getItem(STORAGE_KEY_V1), null);
  const written = storage.getItem(STORAGE_KEY_V2);
  assert.ok(written);
  assert.deepEqual(JSON.parse(written), migrated);

  const emptySheet = memoryStorage({
    [STORAGE_KEY_V1]: JSON.stringify({ users: [], clients: [], sessions: [] }),
  });
  const empty = readStoredSheet(emptySheet);
  assert.deepEqual(empty?.sessions, []);
  assert.equal(empty?.version, SHEET_VERSION);
  assert.equal(emptySheet.getItem(STORAGE_KEY_V1), null);
});

test("a usable v2 sheet wins over a leftover v1 key", () => {
  const storage = memoryStorage({
    [STORAGE_KEY_V2]: JSON.stringify({
      version: SHEET_VERSION,
      users: [{ id: "user-alex" }],
      clients: [{ id: "client-jordan" }],
      sessions: [],
      measurements: [],
      workouts: [],
    }),
    [STORAGE_KEY_V1]: JSON.stringify(legacySheet()),
  });
  const sheet = readStoredSheet(storage);
  assert.deepEqual(sheet?.sessions, []);
  assert.equal(sheet?.users[0]?.id, "user-alex");
  assert.ok(storage.getItem(STORAGE_KEY_V1));
});

test("corrupt v2 falls through to v1, and a failed v2 write leaves v1 in place", () => {
  const legacy = legacySheet();
  const storage = memoryStorage({
    [STORAGE_KEY_V2]: "{not json",
    [STORAGE_KEY_V1]: JSON.stringify(legacy),
  });
  const migrated = readStoredSheet(storage);
  assert.equal(migrated?.sessions[0]?.exercises[0]?.sets.length, 3);
  assert.equal(storage.getItem(STORAGE_KEY_V1), null);

  const stuck = memoryStorage({ [STORAGE_KEY_V1]: JSON.stringify(legacy) });
  stuck.setItem = () => {
    throw new Error("quota");
  };
  assert.throws(() => readStoredSheet(stuck), /quota/);
  assert.ok(stuck.getItem(STORAGE_KEY_V1));
  assert.equal(stuck.getItem(STORAGE_KEY_V2), null);
});

test("seed sessions are per-set rows and survive another migrate", () => {
  const seed = createSeed();
  const squat = seed.sessions[0]?.exercises[0];
  const plank = seed.sessions[2]?.exercises[2];
  assert.ok(squat && plank);
  assert.equal(seed.sessions[0]?.loggedBy, "coach");
  assert.equal(seed.sessions[0]?.workoutId, null);
  assert.equal(formatSet(squat), "3 × 5 · 100 kg");
  assert.equal(formatSet(plank), "3 × 40 · Bodyweight");
  assert.equal(squat.sets.every((set) => set.done && !set.isWarmup && set.completedAt === null), true);

  const once = migrateSheet(seed);
  const twice = migrateSheet(once);
  assert.deepEqual(once.sessions, seed.sessions);
  assert.deepEqual(twice.sessions, once.sessions);
  assert.deepEqual(once.users, seed.users);
  assert.deepEqual(once.clients, seed.clients);
  assert.equal(once.clients[0]?.goalWeightKg, 70);
  assert.deepEqual(once.workouts, seed.workouts);
});

test("a v2 sheet keeps a valid goal and treats a missing or invalid goal as none", () => {
  const storage = memoryStorage({
    [STORAGE_KEY_V2]: JSON.stringify({
      version: SHEET_VERSION,
      users: [{ id: "user-alex" }],
      measurements: [],
      sessions: [],
      workouts: [],
      clients: [
        { id: "a", name: "A", email: "a@b.co", userId: "u", createdAt: "2026-01-01" },
        {
          id: "b",
          name: "B",
          email: "b@b.co",
          userId: "u2",
          createdAt: "2026-01-01",
          goalWeightKg: 70.5,
          nickname: "Bee",
        },
        { id: "c", name: "C", email: "c@b.co", userId: "u3", createdAt: "2026-01-01", goalWeightKg: "70" },
        { id: "d", name: "D", email: "d@b.co", userId: "u4", createdAt: "2026-01-01", goalWeightKg: 0 },
        { id: "e", name: "E", email: "e@b.co", userId: "u5", createdAt: "2026-01-01", goalWeightKg: 401 },
      ],
    }),
  });
  const sheet = readStoredSheet(storage);
  assert.equal(sheet?.version, SHEET_VERSION);
  assert.equal(sheet?.clients[0]?.goalWeightKg, null);
  assert.equal(sheet?.clients[1]?.goalWeightKg, 70.5);
  assert.equal(sheet?.clients[1]?.name, "B");
  assert.equal((sheet?.clients[1] as { nickname?: string } | undefined)?.nickname, "Bee");
  assert.equal(sheet?.clients[2]?.goalWeightKg, null);
  assert.equal(sheet?.clients[3]?.goalWeightKg, null);
  assert.equal(sheet?.clients[4]?.goalWeightKg, null);
  assert.equal(migrateSheet(sheet).clients[1]?.goalWeightKg, 70.5);
  assert.equal(storage.getItem(STORAGE_KEY_V1), null);
});

test("a coach card still prints mixed set rows", () => {
  assert.equal(
    formatSet({
      sets: [
        workingSet("a", 100, 5),
        workingSet("b", 90, 6),
      ],
    }),
    "5 × 100 kg, 6 × 90 kg",
  );
  assert.equal(formatSet({ sets: [] }), "No sets");
});
