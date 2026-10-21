import assert from "node:assert/strict";
import test from "node:test";
import { trainingAgenda } from "./schedule.ts";
import type { PlanOverride, Session, SessionSet, WeeklyPlan } from "./types.ts";
import { getWeekStripDays } from "./week-strip.ts";

const clientId = "c";

const plan: WeeklyPlan = {
  clientId,
  days: { 1: "lower", 3: "upper", 5: "lower" },
};

function set(done: boolean, isWarmup = false): SessionSet {
  return { id: "set", weightKg: 20, reps: 5, done, isWarmup, completedAt: null };
}

function session(date: string, sets: SessionSet[], owner = clientId): Session {
  return {
    id: `session-${date}-${owner}`,
    clientId: owner,
    date,
    title: "Day",
    loggedBy: "client",
    workoutId: "upper",
    exercises: [{ id: "exercise", exerciseId: "ex", sets }],
  };
}

function strip(input: {
  now: Date;
  weekStartsOn?: "monday" | "sunday";
  sessions?: Session[];
  overrides?: PlanOverride[];
  knownWorkoutIds?: ReadonlySet<string>;
  weekPlan?: WeeklyPlan | null;
}) {
  return getWeekStripDays({
    now: input.now,
    weekStartsOn: input.weekStartsOn ?? "monday",
    clientId,
    plan: input.weekPlan === undefined ? plan : input.weekPlan,
    overrides: input.overrides ?? [],
    sessions: input.sessions ?? [],
    knownWorkoutIds: input.knownWorkoutIds,
  });
}

test("the strip starts on the chosen day and marks the standing week", () => {
  const now = new Date(2026, 9, 21, 15, 0, 0);
  const monday = strip({ now });
  assert.deepEqual(
    monday.map((day) => day.date),
    ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"],
  );
  assert.deepEqual(
    monday.map((day) => day.status),
    ["planned", "none", "planned", "none", "planned", "none", "none"],
  );

  const sunday = strip({ now, weekStartsOn: "sunday" });
  assert.equal(sunday[0]?.date, "2026-10-18");
  assert.equal(sunday[6]?.date, "2026-10-24");
  assert.equal(sunday.find((day) => day.date === "2026-10-21")?.status, "planned");
});

test("Sunday and Monday stay in the same Monday-first week", () => {
  const monday = strip({ now: new Date(2026, 9, 19, 0, 0, 0), weekPlan: null });
  const sunday = strip({ now: new Date(2026, 9, 25, 23, 59, 0), weekPlan: null });
  assert.equal(monday[0]?.date, "2026-10-19");
  assert.equal(sunday[0]?.date, "2026-10-19");
  assert.equal(sunday[6]?.date, "2026-10-25");
});

test("a week can cross a year boundary from either start day", () => {
  const monday = strip({ now: new Date(2027, 0, 1, 0, 30, 0), weekPlan: null });
  assert.deepEqual(
    monday.map((day) => day.date),
    ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"],
  );
  const sunday = strip({
    now: new Date(2027, 0, 1, 0, 0, 0),
    weekStartsOn: "sunday",
    weekPlan: null,
  });
  assert.equal(sunday[0]?.date, "2026-12-27");
  assert.equal(sunday[6]?.date, "2027-01-02");
  assert.equal(new Set(sunday.map((day) => day.date)).size, 7);
});

test("done wins over planned, and only a completed working set counts", () => {
  const days = strip({
    now: new Date(2026, 9, 21, 12, 0, 0),
    sessions: [
      session("2026-10-19", [set(true)]),
      session("2026-10-21", [set(true, true)]),
      session("2026-10-23", [set(false)]),
      session("2026-10-18", [set(true)]),
      session("2026-10-19", [set(true)], "someone-else"),
      session("not-a-date", [set(true)]),
    ],
  });
  assert.equal(days.find((day) => day.date === "2026-10-19")?.status, "done");
  assert.equal(days.find((day) => day.date === "2026-10-21")?.status, "planned");
  assert.equal(days.find((day) => day.date === "2026-10-23")?.status, "planned");
  assert.equal(days.find((day) => day.date === "2026-10-18"), undefined);
  const sunday = strip({
    now: new Date(2026, 9, 21, 12, 0, 0),
    weekStartsOn: "sunday",
    sessions: [session("2026-10-18", [set(true)])],
  });
  assert.equal(sunday[0]?.status, "done");
});

test("a move marks the destination and clears the source", () => {
  const overrides: PlanOverride[] = [
    { id: "move", clientId, date: "2026-10-21", kind: "move", toDate: "2026-10-22" },
  ];
  const days = strip({ now: new Date(2026, 9, 21, 0, 0, 0), overrides });
  assert.equal(days.find((day) => day.date === "2026-10-21")?.status, "none");
  assert.equal(days.find((day) => day.date === "2026-10-22")?.status, "planned");
  assert.equal(days.find((day) => day.date === "2026-10-19")?.status, "planned");
});

test("week start changes the strip order and not today's workout", () => {
  const now = new Date(2026, 9, 21, 0, 0, 0);
  const agenda = trainingAgenda({ now, clientId, plan, overrides: [] });
  assert.equal(agenda.today, "2026-10-21");
  assert.equal(agenda.workoutId, "upper");
  for (const weekStartsOn of ["monday", "sunday"] as const) {
    const days = strip({ now, weekStartsOn });
    assert.equal(days.find((day) => day.date === agenda.today)?.status, "planned");
  }
  assert.equal(strip({ now, weekStartsOn: "monday" })[0]?.date, "2026-10-19");
  assert.equal(strip({ now, weekStartsOn: "sunday" })[0]?.date, "2026-10-18");
});

test("a deleted workout is not a planned dot", () => {
  const days = strip({
    now: new Date(2026, 9, 21, 0, 0, 0),
    knownWorkoutIds: new Set(["lower"]),
  });
  assert.equal(days.find((day) => day.date === "2026-10-21")?.status, "none");
  assert.equal(days.find((day) => day.date === "2026-10-19")?.status, "planned");
});

test("fall-back weeks stay seven distinct calendar dates", () => {
  const us = strip({
    now: new Date(2026, 10, 1, 0, 30, 0),
    weekStartsOn: "sunday",
    weekPlan: null,
  });
  assert.deepEqual(
    us.map((day) => day.date),
    ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"],
  );
  const auckland = strip({
    now: new Date(2026, 3, 5, 0, 30, 0),
    weekStartsOn: "sunday",
    weekPlan: null,
  });
  assert.deepEqual(
    auckland.map((day) => day.date),
    ["2026-04-05", "2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10", "2026-04-11"],
  );
  const spring = strip({
    now: new Date(2026, 2, 8, 0, 30, 0),
    weekStartsOn: "sunday",
    weekPlan: null,
  });
  assert.equal(spring[0]?.date, "2026-03-08");
  assert.equal(spring[6]?.date, "2026-03-14");
  assert.equal(new Set(spring.map((day) => day.date)).size, 7);
});
