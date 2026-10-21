import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_INCREMENT_KG,
  DEFAULT_STALL_SESSIONS,
  deloadWeight,
  nextProgressionTarget,
  readProgressionRule,
  type ProgressionAttempt,
  type ProgressionSet,
} from "./progression";

const linear = { kind: "linear" as const, incrementKg: 2.5, stallSessions: 3 };
const double = {
  kind: "double" as const,
  incrementKg: 2.5,
  repMin: 8,
  repMax: 12,
  stallSessions: 3,
};

function working(count: number, weightKg: number, reps: number): ProgressionAttempt {
  return { sets: Array.from({ length: count }, () => set(weightKg, reps)) };
}

function set(
  weightKg: number,
  reps: number,
  extra: Partial<ProgressionSet> = {},
): ProgressionSet {
  return {
    weightKg,
    reps,
    done: extra.done ?? true,
    isWarmup: extra.isWarmup ?? false,
  };
}

test("a deload is 10 percent of the stalled weight, rounded to the nearest 0.5 kg", () => {
  assert.equal(deloadWeight(100), 90);
  assert.equal(deloadWeight(60), 54);
  assert.equal(deloadWeight(62.5), 56.5);
  assert.equal(deloadWeight(5), 4.5);
  assert.equal(deloadWeight(2.5), 2);
  assert.equal(deloadWeight(0), 0);
  assert.equal(deloadWeight(-5), 0);
});

test("linear adds the increment when every working set hits", () => {
  const target = nextProgressionTarget({
    rule: linear,
    attempts: [working(3, 100, 5)],
    targetReps: 5,
  });
  assert.deepEqual(target, {
    weight: 102.5,
    reps: 5,
    reason: "+2.5 kg: all 3×5 hit last time",
  });
});

test("linear does not add load when a working set misses the target reps", () => {
  const target = nextProgressionTarget({
    rule: linear,
    attempts: [
      {
        sets: [set(100, 5), set(100, 5), set(110, 3)],
      },
    ],
    targetReps: 5,
  });
  assert.equal(target.weight, 100);
  assert.equal(target.reps, 5);
  assert.equal(target.reason, "Held 100 kg: a set missed 5 reps last time");
});

test("linear holds the load through a stall shorter than the configured count", () => {
  const target = nextProgressionTarget({
    rule: linear,
    attempts: [working(3, 100, 3), working(3, 100, 4)],
    targetReps: 5,
  });
  assert.equal(target.weight, 100);
  assert.equal(target.reps, 5);
  assert.equal(target.reason.includes("deload"), false);
  assert.equal(target.reason, "Held 100 kg: a set missed 5 reps last time");
});

test("linear deloads after the configured number of stalled sessions", () => {
  const target = nextProgressionTarget({
    rule: { ...linear, stallSessions: 3 },
    attempts: [working(3, 100, 3), working(3, 100, 4), working(3, 100, 4)],
    targetReps: 5,
  });
  assert.deepEqual(target, {
    weight: 90,
    reps: 5,
    reason: "-10 kg deload: 3 sessions missed 5 reps",
  });
});

test("linear ignores warm-ups and unfinished sessions", () => {
  const hit = nextProgressionTarget({
    rule: linear,
    attempts: [
      {
        sets: [
          set(40, 1, { isWarmup: true }),
          set(140, 1, { isWarmup: true }),
          set(100, 5),
          set(100, 5),
          set(100, 5),
        ],
      },
    ],
    targetReps: 5,
  });
  assert.deepEqual(hit, {
    weight: 102.5,
    reps: 5,
    reason: "+2.5 kg: all 3×5 hit last time",
  });

  const warmupOnly = nextProgressionTarget({
    rule: linear,
    attempts: [{ sets: [set(100, 1, { isWarmup: true })] }],
    targetReps: 5,
  });
  assert.equal(warmupOnly.weight, 0);
  assert.equal(warmupOnly.reason, "Start at 0 kg × 5. No earlier working sets.");

  const open = nextProgressionTarget({
    rule: linear,
    attempts: [{ sets: [set(100, 5), set(100, 5, { done: false })] }],
    targetReps: 5,
  });
  assert.equal(open.weight, 0);
  assert.equal(open.reason, "Start at 0 kg × 5. No earlier working sets.");
});

test("double adds a rep inside the range and does not add load", () => {
  const target = nextProgressionTarget({
    rule: double,
    attempts: [working(3, 60, 8)],
    targetReps: 8,
  });
  assert.deepEqual(target, {
    weight: 60,
    reps: 9,
    reason: "+1 rep: all 3×8 hit last time",
  });
});

test("double does not add load when a set misses the reps it was asked for", () => {
  const climbed = nextProgressionTarget({
    rule: double,
    attempts: [working(3, 60, 8)],
    targetReps: 8,
  });
  assert.equal(climbed.reps, 9);
  const missed = nextProgressionTarget({
    rule: double,
    attempts: [working(3, 60, 8), working(3, 60, 8)],
    targetReps: 8,
  });
  assert.equal(missed.weight, 60);
  assert.equal(missed.reps, 9);
  assert.equal(missed.reason, "Held 60 kg: a set missed last time");
});

test("double holds through a stall and deloads on the configured session", () => {
  const stall = nextProgressionTarget({
    rule: double,
    attempts: [working(3, 60, 6), working(3, 60, 6)],
    targetReps: 8,
  });
  assert.equal(stall.weight, 60);
  assert.equal(stall.reps, 8);
  assert.equal(stall.reason.includes("deload"), false);

  const deload = nextProgressionTarget({
    rule: double,
    attempts: [working(3, 60, 6), working(3, 60, 6), working(3, 60, 6)],
    targetReps: 8,
  });
  assert.deepEqual(deload, {
    weight: 54,
    reps: 8,
    reason: "-6 kg deload: 3 sessions stalled in 8–12",
  });
});

test("double adds load and resets to the bottom at the top of the range", () => {
  const direct = nextProgressionTarget({
    rule: double,
    attempts: [working(3, 60, 12)],
    targetReps: 8,
  });
  assert.deepEqual(direct, {
    weight: 62.5,
    reps: 8,
    reason: "+2.5 kg: all 3×12 hit, reset to 8",
  });

  const climbed = nextProgressionTarget({
    rule: double,
    attempts: [
      working(3, 60, 8),
      working(3, 60, 9),
      working(3, 60, 10),
      working(3, 60, 11),
      working(3, 60, 12),
    ],
    targetReps: 8,
  });
  assert.equal(climbed.weight, 62.5);
  assert.equal(climbed.reps, 8);
  assert.equal(climbed.reason, "+2.5 kg: all 3×12 hit, reset to 8");
});

test("double leaves warm-ups out of the rep count and the load", () => {
  const target = nextProgressionTarget({
    rule: double,
    attempts: [
      {
        sets: [set(20, 1, { isWarmup: true }), set(60, 12), set(60, 12), set(60, 12)],
      },
    ],
    targetReps: 8,
  });
  assert.deepEqual(target, {
    weight: 62.5,
    reps: 8,
    reason: "+2.5 kg: all 3×12 hit, reset to 8",
  });
});

test("a missing or broken stored rule reads as None, and a valid rule is kept", () => {
  assert.deepEqual(readProgressionRule(undefined), { kind: "none" });
  assert.deepEqual(readProgressionRule({ kind: "wave" }), { kind: "none" });
  assert.deepEqual(readProgressionRule({ kind: "linear", incrementKg: 0, stallSessions: 0 }), {
    kind: "linear",
    incrementKg: DEFAULT_INCREMENT_KG,
    stallSessions: DEFAULT_STALL_SESSIONS,
  });
  assert.deepEqual(readProgressionRule({ kind: "linear", incrementKg: 5, stallSessions: 2 }), {
    kind: "linear",
    incrementKg: 5,
    stallSessions: 2,
  });
  assert.deepEqual(
    readProgressionRule({
      kind: "double",
      incrementKg: 2.5,
      stallSessions: 4,
      repMin: 6,
      repMax: 10,
    }),
    { kind: "double", incrementKg: 2.5, stallSessions: 4, repMin: 6, repMax: 10 },
  );
});
