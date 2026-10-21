import assert from "node:assert/strict";
import test from "node:test";
import { NEXT_TRAINING_HORIZON_DAYS, trainingAgenda, workoutIdOn } from "./schedule.ts";
import type { PlanOverride, WeeklyPlan } from "./types.ts";

const clientId = "client-jordan";

function plan(days: WeeklyPlan["days"], id = clientId): WeeklyPlan {
  return { clientId: id, days };
}

function move(date: string, toDate: string, id = date): PlanOverride {
  return { id, clientId, date, kind: "move", toDate };
}

function skip(date: string): PlanOverride {
  return { id: `skip-${date}`, clientId, date, kind: "skip", toDate: null };
}

const split = plan({ 1: "lower", 3: "upper", 4: "upper" });

test("local midnight and the last minute stay on that calendar day", () => {
  const morning = trainingAgenda({
    now: new Date(2026, 9, 21, 0, 0, 0),
    clientId,
    plan: split,
    overrides: [],
  });
  const night = trainingAgenda({
    now: new Date(2026, 9, 21, 23, 59, 59),
    clientId,
    plan: split,
    overrides: [],
  });
  const previous = trainingAgenda({
    now: new Date(2026, 9, 20, 23, 59, 59),
    clientId,
    plan: split,
    overrides: [],
  });
  assert.equal(morning.today, "2026-10-21");
  assert.equal(morning.workoutId, "upper");
  assert.deepEqual(morning.next, { date: "2026-10-22", workoutId: "upper" });
  assert.equal(night.today, "2026-10-21");
  assert.equal(night.workoutId, "upper");
  assert.equal(previous.today, "2026-10-20");
  assert.equal(previous.workoutId, null);
  assert.deepEqual(previous.next, { date: "2026-10-21", workoutId: "upper" });
});

test("a rest day names the next planned workout, and a skip pushes that day out", () => {
  const now = new Date(2026, 9, 20, 12, 0, 0);
  const open = trainingAgenda({ now, clientId, plan: split, overrides: [] });
  assert.equal(open.workoutId, null);
  assert.deepEqual(open.next, { date: "2026-10-21", workoutId: "upper" });

  const skipped = trainingAgenda({ now, clientId, plan: split, overrides: [skip("2026-10-21")] });
  assert.deepEqual(skipped.next, { date: "2026-10-22", workoutId: "upper" });

  const followingWeek = trainingAgenda({
    now,
    clientId,
    plan: split,
    overrides: [skip("2026-10-21"), skip("2026-10-22"), skip("2026-10-26")],
  });
  assert.deepEqual(followingWeek.next, { date: "2026-10-28", workoutId: "upper" });
});

test("moving one date leaves the standing week and the other weeks alone", () => {
  const ontoToday = trainingAgenda({
    now: new Date(2026, 9, 21, 0, 30, 0),
    clientId,
    plan: plan({ 1: "lower", 4: "upper" }),
    overrides: [move("2026-10-22", "2026-10-21")],
  });
  assert.equal(ontoToday.today, "2026-10-21");
  assert.equal(ontoToday.workoutId, "upper");
  assert.deepEqual(ontoToday.next, { date: "2026-10-26", workoutId: "lower" });

  const overrides = [move("2026-10-22", "2026-10-23")];
  const standing = plan({ 1: "lower", 4: "upper" });
  const movedAside = trainingAgenda({
    now: new Date(2026, 9, 21, 8, 0, 0),
    clientId,
    plan: standing,
    overrides,
  });
  assert.equal(movedAside.workoutId, null);
  assert.deepEqual(movedAside.next, { date: "2026-10-23", workoutId: "upper" });
  assert.equal(workoutIdOn("2026-10-22", clientId, standing, overrides), null);
  assert.equal(workoutIdOn("2026-10-29", clientId, standing, overrides), "upper");
  assert.equal(workoutIdOn("2026-10-26", clientId, standing, overrides), "lower");
});

test("a moved workout replaces the destination for that date only, and the later move wins", () => {
  const standing = plan({ 1: "lower", 3: "upper" });
  const overrides = [move("2026-10-19", "2026-10-21", "from-monday")];
  assert.equal(workoutIdOn("2026-10-19", clientId, standing, overrides), null);
  assert.equal(workoutIdOn("2026-10-21", clientId, standing, overrides), "lower");
  assert.equal(workoutIdOn("2026-10-26", clientId, standing, overrides), "lower");
  assert.equal(workoutIdOn("2026-10-28", clientId, standing, overrides), "upper");

  const both = [
    move("2026-10-19", "2026-10-21", "from-monday"),
    move("2026-10-20", "2026-10-21", "from-tuesday"),
  ];
  const withTuesday = plan({ 1: "lower", 2: "push", 3: "upper" });
  assert.equal(workoutIdOn("2026-10-21", clientId, withTuesday, both), "push");
  assert.equal(
    workoutIdOn("2026-10-21", clientId, withTuesday, [...both].reverse()),
    "lower",
  );
});

test("a skip removes that date's plan workout and still accepts a workout moved there", () => {
  const standing = plan({ 2: "push", 3: "upper" });
  const overrides = [skip("2026-10-21"), move("2026-10-20", "2026-10-21")];
  assert.equal(workoutIdOn("2026-10-21", clientId, standing, overrides), "push");
  assert.equal(workoutIdOn("2026-10-28", clientId, standing, [skip("2026-10-21")]), "upper");
});

test("another client's override and a missing workout id do not fill today", () => {
  const standing = plan({ 3: "upper" });
  const foreign: PlanOverride = {
    id: "other",
    clientId: "client-sam",
    date: "2026-10-21",
    kind: "skip",
    toDate: null,
  };
  assert.equal(workoutIdOn("2026-10-21", clientId, standing, [foreign]), "upper");
  assert.equal(workoutIdOn("2026-10-21", "client-sam", standing, []), null);

  const agenda = trainingAgenda({
    now: new Date(2026, 9, 21, 0, 0, 0),
    clientId,
    plan: plan({ 3: "gone", 4: "upper" }),
    overrides: [],
    knownWorkoutIds: new Set(["upper"]),
  });
  assert.equal(agenda.workoutId, null);
  assert.deepEqual(agenda.next, { date: "2026-10-22", workoutId: "upper" });
});

test("the next training day stops after the horizon", () => {
  const thursday = plan({ 4: "upper" });
  const overrides = [skip("2026-10-22"), skip("2026-10-29"), skip("2026-11-05")];
  const agenda = trainingAgenda({
    now: new Date(2026, 9, 21, 0, 0, 0),
    clientId,
    plan: thursday,
    overrides,
  });
  assert.equal(agenda.workoutId, null);
  assert.equal(agenda.next, null);
  assert.equal(NEXT_TRAINING_HORIZON_DAYS, 21);
  assert.equal(workoutIdOn("2026-11-12", clientId, thursday, overrides), "upper");
});

test("a fall-back Sunday keeps today and the next training week on the calendar", () => {
  const sunday = plan({ 0: "long" });
  for (const now of [new Date(2026, 10, 1, 0, 0, 0), new Date(2026, 10, 1, 0, 30, 0)]) {
    const agenda = trainingAgenda({ now, clientId, plan: sunday, overrides: [] });
    assert.equal(agenda.today, "2026-11-01");
    assert.equal(agenda.workoutId, "long");
    assert.deepEqual(agenda.next, { date: "2026-11-08", workoutId: "long" });
  }
  const auckland = trainingAgenda({
    now: new Date(2026, 3, 5, 0, 30, 0),
    clientId,
    plan: sunday,
    overrides: [],
  });
  assert.equal(auckland.today, "2026-04-05");
  assert.deepEqual(auckland.next, { date: "2026-04-12", workoutId: "long" });
});
