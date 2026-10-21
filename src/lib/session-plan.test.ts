import assert from "node:assert/strict";
import { test } from "node:test";
import { STORAGE_KEY_V2, persistedSheet, readStoredSheet, type SheetStorage } from "./migrate";
import { DEFAULT_REST_MS, remainingMs, startRest, writeRestTimer, restoreRestTimer } from "./rest-timer";
import { createSeed } from "./seed";
import {
  applyClientSetUpdate,
  buildClientSession,
  exercisePrescription,
  exerciseTarget,
  lastExercisePrescription,
  openClientSession,
  parseLoggedReps,
  parseLoggedWeight,
  parseTargetReps,
  planClientSession,
  sessionToResume,
  stepReps,
  stepWeight,
} from "./session-plan";
import type { Session, SessionSet, Workout } from "./types";

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
  return { storage, items };
}

function setRow(
  id: string,
  weightKg: number,
  reps: number,
  extra: Partial<SessionSet> = {},
): SessionSet {
  return {
    id,
    weightKg,
    reps,
    done: extra.done ?? true,
    isWarmup: extra.isWarmup ?? false,
    completedAt: extra.completedAt ?? null,
  };
}

function session(input: {
  id: string;
  clientId: string;
  date: string;
  exerciseId: string;
  sets: SessionSet[];
  loggedBy?: "coach" | "client";
  workoutId?: string | null;
}): Session {
  return {
    id: input.id,
    clientId: input.clientId,
    date: input.date,
    title: input.id,
    loggedBy: input.loggedBy ?? "coach",
    workoutId: input.workoutId ?? null,
    exercises: [{ id: `${input.id}-ex`, exerciseId: input.exerciseId, sets: input.sets }],
  };
}

const squatWorkout: Workout = {
  id: "workout-a",
  clientId: "client-jordan",
  name: "Strength A",
  assignedAt: "2026-10-01",
  progression: { kind: "none" },
  moves: [
    {
      id: "wm-squat",
      exerciseId: "ex-back-squat",
      sets: 4,
      reps: "5",
      progression: null,
      targetOverride: null,
    },
    {
      id: "wm-plank",
      exerciseId: "ex-plank",
      sets: 3,
      reps: "40 sec",
      progression: null,
      targetOverride: null,
    },
  ],
};

test("target reps use the first number in the workout text", () => {
  assert.equal(parseTargetReps("5"), 5);
  assert.equal(parseTargetReps("40 sec"), 40);
  assert.equal(parseTargetReps("10 each"), 10);
  assert.equal(parseTargetReps("8-12"), 8);
  assert.equal(parseTargetReps("amrap"), 0);
  assert.equal(parseTargetReps(""), 0);
});

test("prefill uses the last working set, not an older session or a warm-up", () => {
  const sessions = [
    session({
      id: "older",
      clientId: "client-jordan",
      date: "2026-09-01",
      exerciseId: "ex-back-squat",
      sets: [setRow("a", 80, 5)],
    }),
    session({
      id: "newer",
      clientId: "client-jordan",
      date: "2026-09-23",
      exerciseId: "ex-back-squat",
      sets: [setRow("w", 50, 5, { isWarmup: true }), setRow("b", 100, 5), setRow("c", 110, 3)],
    }),
    session({
      id: "other-client",
      clientId: "client-sam",
      date: "2026-10-01",
      exerciseId: "ex-back-squat",
      sets: [setRow("d", 140, 2)],
    }),
  ];
  assert.deepEqual(lastExercisePrescription(sessions, "client-jordan", "ex-back-squat"), {
    weightKg: 110,
    reps: 3,
  });
  assert.equal(lastExercisePrescription(sessions, "client-jordan", "ex-plank"), null);
});

test("the same date keeps the session that was saved last", () => {
  const sessions = [
    session({
      id: "first",
      clientId: "client-jordan",
      date: "2026-09-23",
      exerciseId: "ex-bench-press",
      sets: [setRow("a", 60, 8)],
    }),
    session({
      id: "second",
      clientId: "client-jordan",
      date: "2026-09-23",
      exerciseId: "ex-bench-press",
      sets: [setRow("b", 62.5, 6)],
    }),
  ];
  assert.deepEqual(lastExercisePrescription(sessions, "client-jordan", "ex-bench-press"), {
    weightKg: 62.5,
    reps: 6,
  });
});

test("a warm-up-only history still prefills from the last warm-up", () => {
  const sessions = [
    session({
      id: "warm",
      clientId: "client-jordan",
      date: "2026-09-23",
      exerciseId: "ex-bench-press",
      sets: [setRow("a", 20, 10, { isWarmup: true }), setRow("b", 40, 5, { isWarmup: true })],
    }),
  ];
  assert.deepEqual(lastExercisePrescription(sessions, "client-jordan", "ex-bench-press"), {
    weightKg: 40,
    reps: 5,
  });
});

test("no previous session falls back to the workout target and bodyweight", () => {
  const prescription = exercisePrescription([], "client-jordan", squatWorkout.moves[1]!);
  assert.deepEqual(prescription, { weightKg: 0, reps: 40 });
});

test("build copies last-session numbers onto every set and the workout's set count", () => {
  const history = [
    session({
      id: "lower",
      clientId: "client-jordan",
      date: "2026-09-23",
      exerciseId: "ex-back-squat",
      sets: [setRow("a", 100, 5), setRow("b", 100, 5), setRow("c", 100, 5)],
    }),
  ];
  let n = 0;
  const built = buildClientSession({
    clientId: "client-jordan",
    workout: squatWorkout,
    sessions: history,
    date: "2026-10-21",
    createId: () => `id-${(n += 1)}`,
  });
  assert.equal(built.loggedBy, "client");
  assert.equal(built.workoutId, "workout-a");
  assert.equal(built.date, "2026-10-21");
  assert.equal(built.title, "Strength A");
  const squat = built.exercises[0];
  const plank = built.exercises[1];
  assert.ok(squat && plank);
  assert.equal(squat.sets.length, 4);
  assert.equal(plank.sets.length, 3);
  assert.deepEqual(
    squat.sets.map((set) => ({ weightKg: set.weightKg, reps: set.reps, done: set.done })),
    [
      { weightKg: 100, reps: 5, done: false },
      { weightKg: 100, reps: 5, done: false },
      { weightKg: 100, reps: 5, done: false },
      { weightKg: 100, reps: 5, done: false },
    ],
  );
  assert.ok(squat.sets.every((set) => set.isWarmup === false && set.completedAt === null));
  assert.deepEqual(
    plank.sets.map((set) => ({ weightKg: set.weightKg, reps: set.reps })),
    [
      { weightKg: 0, reps: 40 },
      { weightKg: 0, reps: 40 },
      { weightKg: 0, reps: 40 },
    ],
  );
  assert.equal(history.length, 1);
});

test("seed history prefills Jordan's squat and falls back for the plank", () => {
  const seed = createSeed();
  const workout = seed.workouts.find((item) => item.id === "workout-jordan-a");
  assert.ok(workout);
  let n = 0;
  const built = buildClientSession({
    clientId: "client-jordan",
    workout,
    sessions: seed.sessions,
    date: "2026-10-21",
    createId: () => `id-${(n += 1)}`,
  });
  const byExercise = new Map(built.exercises.map((exercise) => [exercise.exerciseId, exercise]));
  assert.equal(byExercise.get("ex-back-squat")?.sets[0]?.weightKg, 102.5);
  assert.equal(byExercise.get("ex-back-squat")?.sets[0]?.reps, 5);
  assert.equal(byExercise.get("ex-back-squat")?.sets.length, 4);
  assert.equal(byExercise.get("ex-bench-press")?.sets[0]?.weightKg, 72.5);
  assert.equal(byExercise.get("ex-bench-press")?.sets[0]?.reps, 6);
  assert.equal(byExercise.get("ex-bent-over-row")?.sets[0]?.weightKg, 62.5);
  assert.equal(byExercise.get("ex-bent-over-row")?.sets[0]?.reps, 8);
  assert.equal(byExercise.get("ex-plank")?.sets[0]?.weightKg, 0);
  assert.equal(byExercise.get("ex-plank")?.sets[0]?.reps, 40);
  assert.equal(byExercise.get("ex-plank")?.sets.length, 3);
});

test("a linear rule prefills the next load, a miss stays put, and a coach override wins", () => {
  const history = [
    session({
      id: "lower",
      clientId: "client-jordan",
      date: "2026-09-23",
      exerciseId: "ex-back-squat",
      sets: [setRow("a", 100, 5), setRow("b", 100, 5), setRow("c", 100, 5)],
    }),
  ];
  const linearWorkout: Workout = {
    ...squatWorkout,
    progression: { kind: "linear", incrementKg: 2.5, stallSessions: 3 },
  };
  let n = 0;
  const built = buildClientSession({
    clientId: "client-jordan",
    workout: linearWorkout,
    sessions: history,
    date: "2026-10-21",
    createId: () => `id-${(n += 1)}`,
  });
  assert.equal(built.exercises[0]?.sets[0]?.weightKg, 102.5);
  assert.equal(built.exercises[0]?.sets[0]?.reps, 5);
  assert.equal(
    exerciseTarget({
      sessions: history,
      clientId: "client-jordan",
      workout: linearWorkout,
      move: linearWorkout.moves[0]!,
    }).reason,
    "+2.5 kg: all 3×5 hit last time",
  );

  const missed = [
    session({
      id: "miss",
      clientId: "client-jordan",
      date: "2026-09-23",
      exerciseId: "ex-back-squat",
      sets: [setRow("a", 100, 5), setRow("b", 100, 3)],
    }),
  ];
  n = 0;
  const held = buildClientSession({
    clientId: "client-jordan",
    workout: linearWorkout,
    sessions: missed,
    date: "2026-10-21",
    createId: () => `id-${(n += 1)}`,
  });
  assert.equal(held.exercises[0]?.sets[0]?.weightKg, 100);
  assert.equal(held.exercises[0]?.sets[0]?.reps, 5);

  const overridden: Workout = {
    ...linearWorkout,
    moves: linearWorkout.moves.map((move, index) =>
      index === 0 ? { ...move, targetOverride: { weightKg: 80, reps: 3 } } : move,
    ),
  };
  n = 0;
  const coachSet = buildClientSession({
    clientId: "client-jordan",
    workout: overridden,
    sessions: history,
    date: "2026-10-21",
    createId: () => `id-${(n += 1)}`,
  });
  assert.equal(coachSet.exercises[0]?.sets[0]?.weightKg, 80);
  assert.equal(coachSet.exercises[0]?.sets[0]?.reps, 3);
  assert.equal(
    exerciseTarget({
      sessions: history,
      clientId: "client-jordan",
      workout: overridden,
      move: overridden.moves[0]!,
    }).reason,
    "Coach set 80 kg × 3",
  );
});

test("a client can mark a set as a warm-up and mark it working again", () => {
  let n = 0;
  const built = buildClientSession({
    clientId: "client-jordan",
    workout: squatWorkout,
    sessions: [],
    date: "2026-10-21",
    createId: () => `id-${(n += 1)}`,
  });
  const setId = built.exercises[0]?.sets[0]?.id ?? "";
  const warmed = applyClientSetUpdate([built], built.id, setId, { isWarmup: true }, "2026-10-21T12:00:00.000Z");
  assert.equal(warmed.ok, true);
  if (!warmed.ok) return;
  const warmedSet = warmed.sessions[0]?.exercises[0]?.sets[0];
  assert.equal(warmedSet?.isWarmup, true);
  assert.equal(warmedSet?.done, false);
  assert.equal(warmedSet?.completedAt, null);
  const working = applyClientSetUpdate(
    warmed.sessions,
    built.id,
    setId,
    { isWarmup: false },
    "2026-10-21T12:01:00.000Z",
  );
  assert.equal(working.ok, true);
  if (!working.ok) return;
  assert.equal(working.sessions[0]?.exercises[0]?.sets[0]?.isWarmup, false);
});

test("an open client session is resumed and a finished one is not", () => {
  const open = session({
    id: "open",
    clientId: "client-jordan",
    date: "2026-10-21",
    exerciseId: "ex-back-squat",
    loggedBy: "client",
    workoutId: "workout-a",
    sets: [setRow("a", 100, 5, { done: true }), setRow("b", 100, 5, { done: false })],
  });
  const finished = session({
    id: "done",
    clientId: "client-jordan",
    date: "2026-10-20",
    exerciseId: "ex-back-squat",
    loggedBy: "client",
    workoutId: "workout-a",
    sets: [setRow("c", 90, 5, { done: true })],
  });
  const coach = session({
    id: "coach",
    clientId: "client-jordan",
    date: "2026-10-22",
    exerciseId: "ex-back-squat",
    loggedBy: "coach",
    workoutId: "workout-a",
    sets: [setRow("d", 100, 5, { done: false })],
  });
  const someoneElse = session({
    id: "sam",
    clientId: "client-sam",
    date: "2026-10-22",
    exerciseId: "ex-back-squat",
    loggedBy: "client",
    workoutId: "workout-a",
    sets: [setRow("e", 100, 5, { done: false })],
  });
  const sessions = [finished, coach, someoneElse, open];
  assert.equal(openClientSession(sessions, "client-jordan", "workout-a")?.id, "open");
  assert.equal(sessionToResume(sessions, "client-jordan", "workout-a", true)?.id, "open");

  const afterFinish = [finished];
  assert.equal(openClientSession(afterFinish, "client-jordan", "workout-a"), null);
  assert.equal(sessionToResume(afterFinish, "client-jordan", "workout-a", false)?.id, "done");
  assert.equal(sessionToResume(afterFinish, "client-jordan", "workout-a", true), null);
  assert.equal(sessionToResume([], "client-jordan", "workout-a", false), null);
});

test("planning twice does not create a second open session", () => {
  let n = 0;
  const createId = () => `id-${(n += 1)}`;
  const first = planClientSession({
    clientId: "client-jordan",
    workout: squatWorkout,
    sessions: [],
    date: "2026-10-21",
    createId,
  });
  assert.equal(first.created, true);
  const second = planClientSession({
    clientId: "client-jordan",
    workout: squatWorkout,
    sessions: [first.session],
    date: "2026-10-22",
    createId,
  });
  assert.equal(second.created, false);
  assert.equal(second.session.id, first.session.id);
  assert.equal(second.session.date, "2026-10-21");
});

test("a set patch stamps done, clears it on undo, and keeps the stamp when the weight changes", () => {
  let n = 0;
  const built = buildClientSession({
    clientId: "client-jordan",
    workout: squatWorkout,
    sessions: [],
    date: "2026-10-21",
    createId: () => `id-${(n += 1)}`,
  });
  const setId = built.exercises[0]?.sets[0]?.id;
  assert.ok(setId);
  const marked = applyClientSetUpdate([built], built.id, setId, { done: true }, "2026-10-21T12:00:00.000Z");
  assert.equal(marked.ok, true);
  if (!marked.ok) return;
  const markedSet = marked.sessions[0]?.exercises[0]?.sets[0];
  assert.equal(markedSet?.done, true);
  assert.equal(markedSet?.completedAt, "2026-10-21T12:00:00.000Z");
  assert.equal(built.exercises[0]?.sets[0]?.done, false);

  const heavier = applyClientSetUpdate(
    marked.sessions,
    built.id,
    setId,
    { weightKg: 102.55 },
    "2026-10-21T12:05:00.000Z",
  );
  assert.equal(heavier.ok, true);
  if (!heavier.ok) return;
  const heavierSet = heavier.sessions[0]?.exercises[0]?.sets[0];
  assert.equal(heavierSet?.weightKg, 102.6);
  assert.equal(heavierSet?.done, true);
  assert.equal(heavierSet?.completedAt, "2026-10-21T12:00:00.000Z");

  const undone = applyClientSetUpdate(
    heavier.sessions,
    built.id,
    setId,
    { done: false },
    "2026-10-21T12:06:00.000Z",
  );
  assert.equal(undone.ok, true);
  if (!undone.ok) return;
  assert.equal(undone.sessions[0]?.exercises[0]?.sets[0]?.done, false);
  assert.equal(undone.sessions[0]?.exercises[0]?.sets[0]?.completedAt, null);
});

test("invalid set edits and coach sessions are rejected", () => {
  const coach = session({
    id: "coach",
    clientId: "client-jordan",
    date: "2026-09-23",
    exerciseId: "ex-back-squat",
    sets: [setRow("a", 100, 5)],
  });
  const rejected = applyClientSetUpdate([coach], coach.id, "a", { weightKg: 80 }, "2026-10-21T12:00:00.000Z");
  assert.deepEqual(rejected, { ok: false, error: "That session is not on your sheet." });
  assert.equal(coach.exercises[0]?.sets[0]?.weightKg, 100);

  let n = 0;
  const built = buildClientSession({
    clientId: "client-jordan",
    workout: squatWorkout,
    sessions: [],
    date: "2026-10-21",
    createId: () => `id-${(n += 1)}`,
  });
  const setId = built.exercises[0]?.sets[0]?.id ?? "";
  assert.equal(applyClientSetUpdate([built], built.id, setId, { weightKg: 401 }, "t").ok, false);
  assert.equal(applyClientSetUpdate([built], built.id, setId, { reps: 1.5 }, "t").ok, false);
  assert.equal(applyClientSetUpdate([built], built.id, "missing", { reps: 5 }, "t").ok, false);
  assert.equal(applyClientSetUpdate([built], built.id, setId, {}, "t").ok, false);
  assert.equal(built.exercises[0]?.sets[0]?.reps, 5);
});

test("typed weight and reps and the steppers stay inside the sheet limits", () => {
  assert.equal(parseLoggedWeight("102.5"), 102.5);
  assert.equal(parseLoggedWeight("0"), 0);
  assert.equal(parseLoggedWeight(""), null);
  assert.equal(parseLoggedWeight("12."), null);
  assert.equal(parseLoggedWeight("401"), null);
  assert.equal(parseLoggedReps("8"), 8);
  assert.equal(parseLoggedReps("8.5"), null);
  assert.equal(parseLoggedReps("101"), null);
  assert.equal(stepWeight(100, 1), 102.5);
  assert.equal(stepWeight(0, -1), 0);
  assert.equal(stepWeight(399, 1), 400);
  assert.equal(stepReps(0, -1), 0);
  assert.equal(stepReps(100, 1), 100);
});

test("reload restores the in-progress session and the rest timer together", () => {
  const seed = createSeed();
  const workout = seed.workouts.find((item) => item.id === "workout-jordan-a");
  assert.ok(workout);
  let n = 0;
  const planned = planClientSession({
    clientId: "client-jordan",
    workout,
    sessions: seed.sessions,
    date: "2026-10-21",
    createId: () => `live-${(n += 1)}`,
  });
  const setId = planned.session.exercises[0]?.sets[0]?.id;
  assert.ok(setId);
  const saved = applyClientSetUpdate(
    [...seed.sessions, planned.session],
    planned.session.id,
    setId,
    { weightKg: 102.5, reps: 4, done: true },
    "2026-10-21T18:04:00.000Z",
  );
  assert.equal(saved.ok, true);
  if (!saved.ok) return;

  const startedAt = Date.parse("2026-10-21T18:04:00.000Z");
  const timer = startRest(startedAt, DEFAULT_REST_MS, planned.session.id, setId);
  const { storage } = memoryStorage();
  storage.setItem(
    STORAGE_KEY_V2,
    JSON.stringify(persistedSheet({ ...seed, sessions: saved.sessions })),
  );
  writeRestTimer(storage, timer);

  const sheet = readStoredSheet(storage);
  assert.ok(sheet);
  const restored = sheet.sessions.find((item) => item.id === planned.session.id);
  const restoredSet = restored?.exercises[0]?.sets[0];
  assert.equal(restored?.loggedBy, "client");
  assert.equal(restored?.workoutId, "workout-jordan-a");
  assert.equal(restoredSet?.weightKg, 102.5);
  assert.equal(restoredSet?.reps, 4);
  assert.equal(restoredSet?.done, true);
  assert.equal(restoredSet?.isWarmup, false);
  assert.equal(restoredSet?.completedAt, "2026-10-21T18:04:00.000Z");
  const stillOpen = restored?.exercises[0]?.sets[1];
  assert.equal(stillOpen?.done, false);
  assert.equal(stillOpen?.completedAt, null);

  const restoredTimer = restoreRestTimer(storage);
  assert.ok(restoredTimer);
  assert.equal(restoredTimer.sessionId, planned.session.id);
  assert.equal(restoredTimer.setId, setId);
  const afterReload = startedAt + 20_000;
  assert.equal(remainingMs(restoredTimer, afterReload), DEFAULT_REST_MS - 20_000);
});
