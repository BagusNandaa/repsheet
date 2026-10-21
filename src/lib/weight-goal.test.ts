import assert from "node:assert/strict";
import { test } from "node:test";
import { formatGoalDistance, goalDirection, normalizeGoal } from "./weight-goal";

test("a missing or invalid goal is unset, and a stored goal is kept", () => {
  assert.equal(normalizeGoal(undefined), null);
  assert.equal(normalizeGoal(null), null);
  assert.equal(normalizeGoal(""), null);
  assert.equal(normalizeGoal("70"), null);
  assert.equal(normalizeGoal(Number.NaN), null);
  assert.equal(normalizeGoal(Number.POSITIVE_INFINITY), null);
  assert.equal(normalizeGoal(0), null);
  assert.equal(normalizeGoal(0.9), null);
  assert.equal(normalizeGoal(400.1), null);
  assert.equal(normalizeGoal(-5), null);
  assert.equal(normalizeGoal(1), 1);
  assert.equal(normalizeGoal(70.25), 70.25);
  assert.equal(normalizeGoal(400), 400);
});

test("a change is colored by distance to the goal, not by the sign of the delta", () => {
  assert.equal(goalDirection(74.2, 73.5, 70), "toward");
  assert.equal(goalDirection(72.8, 73.4, 70), "away");
  assert.equal(goalDirection(80, 60, 70), "flat");
  assert.equal(goalDirection(70, 70, 70), "flat");
  assert.equal(goalDirection(72.8, 70, 70), "toward");
  assert.equal(goalDirection(70, 70.4, 70), "away");
});

test("home copy states the distance to the goal", () => {
  assert.equal(formatGoalDistance(73.4, 70), "3.4 kg to the 70 kg goal");
  assert.equal(formatGoalDistance(80, 70), "10 kg to the 70 kg goal");
  assert.equal(formatGoalDistance(70, 70), "At the 70 kg goal");
  assert.equal(formatGoalDistance(70.04, 70), "At the 70 kg goal");
});
