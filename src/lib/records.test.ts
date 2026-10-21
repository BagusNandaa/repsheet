import assert from "node:assert/strict";
import { test } from "node:test";
import {
  E1RM_MAX_REPS,
  epley1Rm,
  exerciseHistory,
  exerciseRecords,
  personalRecordFlags,
} from "./records";
import { createSeed } from "./seed";
import type { Session, SessionSet } from "./types";

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
  id?: string;
  clientId?: string;
  date: string;
  exerciseId?: string;
  sets: SessionSet[];
}): Session {
  const id = input.id ?? input.date;
  return {
    id,
    clientId: input.clientId ?? "client-jordan",
    date: input.date,
    title: id,
    loggedBy: "client",
    workoutId: null,
    exercises: [
      {
        id: `${id}-ex`,
        exerciseId: input.exerciseId ?? "ex-back-squat",
        sets: input.sets,
      },
    ],
  };
}

test("Epley is weight times one plus reps over thirty", () => {
  assert.equal(epley1Rm(100, 5), 100 * (1 + 5 / 30));
  assert.equal(epley1Rm(70, 6), 84);
  assert.equal(epley1Rm(100, 1), 100 * (1 + 1 / 30));
  assert.equal(E1RM_MAX_REPS, 12);
});

test("sets above 12 reps are never used for an estimate", () => {
  const records = exerciseRecords(
    [
      session({
        date: "2026-01-01",
        sets: [setRow("high", 100, 13), setRow("edge", 50, 12)],
      }),
    ],
    "client-jordan",
    "ex-back-squat",
  );

  assert.equal(records.estimated1Rm?.setId, "edge");
  assert.equal(records.estimated1Rm?.reps, 12);
  assert.equal(records.estimated1Rm?.e1rmKg, epley1Rm(50, 12));
  assert.equal(records.heaviest?.setId, "high");
  assert.equal(records.heaviest?.weightKg, 100);
});

test("a higher load above 12 reps does not replace a lower eligible estimate", () => {
  const records = exerciseRecords(
    [
      session({ date: "2026-01-01", sets: [setRow("five", 90, 5)] }),
      session({ date: "2026-02-01", sets: [setRow("thirteen", 140, 15)] }),
    ],
    "client-jordan",
    "ex-back-squat",
  );

  assert.equal(records.estimated1Rm?.setId, "five");
  assert.equal(records.estimated1Rm?.e1rmKg, epley1Rm(90, 5));
  assert.ok(epley1Rm(140, 15) > epley1Rm(90, 5));
  assert.equal(records.heaviest?.setId, "thirteen");
});

test("warm-ups and sets that are not done are excluded", () => {
  const records = exerciseRecords(
    [
      session({
        date: "2026-01-01",
        sets: [
          setRow("warmup", 200, 1, { isWarmup: true }),
          setRow("open", 180, 3, { done: false }),
          setRow("work", 80, 5),
        ],
      }),
    ],
    "client-jordan",
    "ex-back-squat",
  );

  assert.equal(records.estimated1Rm?.setId, "work");
  assert.equal(records.estimated1Rm?.e1rmKg, epley1Rm(80, 5));
  assert.equal(records.heaviest?.setId, "work");
  assert.equal(records.bestReps.length, 1);
  assert.equal(records.bestReps[0]?.setId, "work");
});

test("bodyweight sets do not get an estimate", () => {
  const records = exerciseRecords(
    [session({ date: "2026-01-01", exerciseId: "ex-push-up", sets: [setRow("push", 0, 12)] })],
    "client-jordan",
    "ex-push-up",
  );

  assert.equal(records.estimated1Rm, null);
  assert.equal(records.heaviest?.weightKg, 0);
  assert.equal(records.heaviest?.reps, 12);
});

test("equal estimates keep the earliest set", () => {
  const sameScore = [
    session({ id: "later-day", date: "2026-02-01", sets: [setRow("later-day", 100, 6)] }),
    session({ id: "early-day", date: "2026-01-01", sets: [setRow("early-day", 90, 10)] }),
  ];
  assert.equal(epley1Rm(100, 6), epley1Rm(90, 10));
  const acrossDays = exerciseRecords(sameScore, "client-jordan", "ex-back-squat");
  assert.equal(acrossDays.estimated1Rm?.setId, "early-day");
  assert.equal(acrossDays.estimated1Rm?.date, "2026-01-01");

  const sameDay = exerciseRecords(
    [
      session({ id: "saved-second", date: "2026-03-01", sets: [setRow("saved-second", 100, 6)] }),
      session({ id: "saved-first", date: "2026-03-01", sets: [setRow("saved-first", 90, 10)] }),
    ].reverse(),
    "client-jordan",
    "ex-back-squat",
  );
  assert.equal(sameDay.estimated1Rm?.setId, "saved-first");

  const sameSession = exerciseRecords(
    [
      session({
        date: "2026-04-01",
        sets: [setRow("first-set", 90, 10), setRow("second-set", 100, 6)],
      }),
    ],
    "client-jordan",
    "ex-back-squat",
  );
  assert.equal(sameSession.estimated1Rm?.setId, "first-set");
});

test("equal weight keeps the earliest set, and more reps at that weight win", () => {
  const records = exerciseRecords(
    [
      session({ date: "2026-01-01", sets: [setRow("early", 100, 5)] }),
      session({ date: "2026-02-01", sets: [setRow("later", 100, 8)] }),
    ],
    "client-jordan",
    "ex-back-squat",
  );

  assert.equal(records.heaviest?.setId, "early");
  assert.equal(records.bestReps[0]?.setId, "later");
  assert.equal(records.bestReps[0]?.reps, 8);
  assert.equal(records.estimated1Rm?.setId, "later");
});

test("empty history and another client's sets produce no records", () => {
  const empty = exerciseRecords([], "client-jordan", "ex-back-squat");
  assert.equal(empty.estimated1Rm, null);
  assert.equal(empty.heaviest, null);
  assert.deepEqual(empty.bestReps, []);

  const history = exerciseHistory(
    [session({ clientId: "client-sam", date: "2026-01-01", sets: [setRow("sam", 200, 3)] })],
    "client-jordan",
    "ex-back-squat",
  );
  assert.equal(history.records.estimated1Rm, null);
  assert.deepEqual(history.recent, []);
});

test("history names the estimate and lists recent sessions newest first", () => {
  const history = exerciseHistory(
    [
      session({ id: "older", date: "2026-01-01", sets: [setRow("older", 80, 5)] }),
      session({ id: "newer", date: "2026-02-01", sets: [setRow("newer", 100, 3)] }),
    ],
    "client-jordan",
    "ex-back-squat",
  );

  assert.equal(history.records.estimated1Rm?.setId, "newer");
  assert.equal(history.records.estimated1Rm?.date, "2026-02-01");
  assert.deepEqual(
    history.recent.map((item) => item.sessionId),
    ["newer", "older"],
  );
  assert.equal(history.recent[0]?.sets[0]?.weightKg, 100);
});

test("seed squat estimate comes from the earliest matching set", () => {
  const seed = createSeed();
  const records = exerciseRecords(seed.sessions, "client-jordan", "ex-back-squat");
  assert.equal(records.estimated1Rm?.weightKg, 100);
  assert.equal(records.estimated1Rm?.reps, 5);
  assert.equal(records.estimated1Rm?.date, "2026-09-23");
  assert.equal(records.estimated1Rm?.setId, "se-1-set-1");
  assert.equal(records.estimated1Rm?.e1rmKg, epley1Rm(100, 5));
  assert.equal(records.heaviest?.setId, "se-1-set-1");
});

test("a live set is flagged only when it strictly beats the other sets", () => {
  const prior = session({
    id: "saved",
    date: "2026-09-23",
    sets: [setRow("saved", 100, 5)],
  });
  const live = (set: SessionSet) =>
    session({ id: "live", date: "2026-10-21", sets: [set] });

  const heavier = live(setRow("now", 102.5, 5));
  assert.deepEqual(
    personalRecordFlags({
      sessions: [prior, heavier],
      clientId: "client-jordan",
      exerciseId: "ex-back-squat",
      sessionId: "live",
      setId: "now",
    }).map((flag) => flag.kind),
    ["heaviest", "e1rm", "reps"],
  );

  const same = live(setRow("now", 100, 5));
  assert.deepEqual(
    personalRecordFlags({
      sessions: [prior, same],
      clientId: "client-jordan",
      exerciseId: "ex-back-squat",
      sessionId: "live",
      setId: "now",
    }),
    [],
  );

  const moreReps = live(setRow("now", 100, 6));
  assert.deepEqual(
    personalRecordFlags({
      sessions: [prior, moreReps],
      clientId: "client-jordan",
      exerciseId: "ex-back-squat",
      sessionId: "live",
      setId: "now",
    }).map((flag) => flag.kind),
    ["e1rm", "reps"],
  );
});

test("a live set is not a PR against itself, and warm-ups or open sets stay quiet", () => {
  const only = session({
    id: "live",
    date: "2026-10-21",
    sets: [setRow("now", 60, 8)],
  });
  assert.deepEqual(
    personalRecordFlags({
      sessions: [only],
      clientId: "client-jordan",
      exerciseId: "ex-back-squat",
      sessionId: "live",
      setId: "now",
    }).map((flag) => flag.kind),
    ["heaviest", "e1rm", "reps"],
  );

  const prior = session({ id: "saved", date: "2026-09-23", sets: [setRow("saved", 100, 5)] });
  const warmup = session({
    id: "live",
    date: "2026-10-21",
    sets: [setRow("now", 140, 3, { isWarmup: true })],
  });
  const open = session({
    id: "live",
    date: "2026-10-21",
    sets: [setRow("now", 140, 3, { done: false })],
  });
  const shared = {
    clientId: "client-jordan",
    exerciseId: "ex-back-squat",
    sessionId: "live",
    setId: "now",
  };
  assert.deepEqual(personalRecordFlags({ ...shared, sessions: [prior, warmup] }), []);
  assert.deepEqual(personalRecordFlags({ ...shared, sessions: [prior, open] }), []);
});

test("a live set above 12 reps can be a weight PR and still has no estimate", () => {
  const prior = session({ id: "saved", date: "2026-09-23", sets: [setRow("saved", 100, 5)] });
  const live = session({
    id: "live",
    date: "2026-10-21",
    sets: [setRow("now", 140, 15)],
  });
  const flags = personalRecordFlags({
    sessions: [prior, live],
    clientId: "client-jordan",
    exerciseId: "ex-back-squat",
    sessionId: "live",
    setId: "now",
  });
  assert.deepEqual(
    flags.map((flag) => flag.kind),
    ["heaviest", "reps"],
  );

  const records = exerciseRecords([prior, live], "client-jordan", "ex-back-squat");
  assert.equal(records.estimated1Rm?.setId, "saved");
  assert.equal(records.heaviest?.setId, "now");
});
