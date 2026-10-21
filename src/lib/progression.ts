import type { FieldError, ProgressionRule, TargetOverride } from "./types";

/**
 * Rule-based targets for the next session.
 *
 * Linear adds `incrementKg` when every done working set hit the rep target.
 * Double adds one rep until the top of the range, then adds `incrementKg`
 * and resets to the bottom.
 *
 * Warm-up sets are ignored. A session counts only when every working set is
 * marked done. The working load is the lightest of those sets, so one heavier
 * set cannot raise the target. Missed reps never add load.
 *
 * A stall is a counted session that missed the reps it was asked for.
 * After `stallSessions` stalls in a row (default 3, coach can set 1 to 10),
 * the next load is a deload: 10% off the stalled weight (`DELOAD_FRACTION`),
 * rounded to the nearest 0.5 kg (`DELOAD_STEP_KG`), and never above the
 * weight that stalled. A load under 5 kg can round back to itself; it then
 * drops 0.5 kg instead. 0 kg stays bodyweight. The stall count resets after
 * a deload, a hit, or a rep added inside the double range. Double progression
 * also returns to `repMin` on a deload.
 *
 * `nextProgressionTarget` walks attempts from oldest to newest and returns
 * `{ weight, reps, reason }`.
 */

export const DEFAULT_INCREMENT_KG = 2.5;
export const DEFAULT_STALL_SESSIONS = 3;
export const DEFAULT_REP_MIN = 8;
export const DEFAULT_REP_MAX = 12;

/** Share of the stalled weight removed by a deload. */
export const DELOAD_FRACTION = 0.1;

/** Deload weights land on this grid. */
export const DELOAD_STEP_KG = 0.5;

export type ProgressionSet = {
  weightKg: number;
  reps: number;
  done: boolean;
  isWarmup: boolean;
};

/** One logged session for a single exercise, oldest first when projected. */
export type ProgressionAttempt = {
  sets: readonly ProgressionSet[];
};

export type ProgressionTarget = {
  weight: number;
  reps: number;
  reason: string;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function kgText(value: number) {
  const rounded = round1(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * 10% off `weightKg`, rounded to the nearest 0.5 kg.
 * The result is never above the stalled weight and never below 0.
 * When 10% rounds back to the same number, the load drops 0.5 kg instead.
 */
export function deloadWeight(weightKg: number) {
  if (!(weightKg > 0)) return 0;
  const tenths = Math.round(weightKg * 10);
  const kept = Math.round((1 - DELOAD_FRACTION) * 10);
  const reducedTenths = Math.round((tenths * kept) / 10);
  const stepTenths = Math.round(DELOAD_STEP_KG * 10);
  const nearest = Math.round(reducedTenths / stepTenths) * stepTenths;
  const reduced = nearest / 10;
  if (reduced < weightKg) return reduced;
  return Math.max(0, round1(weightKg - DELOAD_STEP_KG));
}

function finishedWorking(attempt: ProgressionAttempt) {
  const working = attempt.sets.filter((set) => set.isWarmup !== true);
  if (working.length === 0) return null;
  if (working.some((set) => set.done !== true)) return null;
  return working;
}

function sessionLoad(sets: readonly ProgressionSet[]) {
  let load = sets[0]?.weightKg ?? 0;
  let worst = sets[0]?.reps ?? 0;
  for (const set of sets) {
    if (set.weightKg < load) load = set.weightKg;
    if (set.reps < worst) worst = set.reps;
  }
  return { load: round1(load), worst, count: sets.length };
}

function cap(weight: number) {
  return round1(Math.min(400, Math.max(0, weight)));
}

function heldReason(load: number, detail: string) {
  const label = load === 0 ? "bodyweight" : `${kgText(load)} kg`;
  return `Held ${label}: ${detail}`;
}

function deloadReason(load: number, dropped: number, detail: string) {
  const amount = round1(load - dropped);
  if (amount <= 0) return heldReason(load, detail);
  return `-${kgText(amount)} kg deload: ${detail}`;
}

function addLoad(load: number, incrementKg: number) {
  return cap(load + incrementKg);
}

function applyMiss(
  state: { weight: number; reps: number; stall: number },
  ruleStall: number,
  load: number,
  missDetail: string,
  deloadDetail: string,
  resetReps: number | null,
) {
  const stall = state.stall + 1;
  if (stall >= ruleStall) {
    const dropped = deloadWeight(load);
    return {
      weight: dropped,
      reps: resetReps ?? state.reps,
      stall: 0,
      reason: deloadReason(load, dropped, deloadDetail),
    };
  }
  return {
    weight: cap(load),
    reps: state.reps,
    stall,
    reason: heldReason(load, missDetail),
  };
}

/**
 * Next weight, reps, and the one-line reason.
 * `attempts` are oldest first. Warm-ups and unfinished sessions are skipped.
 * `targetReps` is the linear goal (the move's rep target). Double ignores it
 * and uses the rule's range.
 */
export function nextProgressionTarget(input: {
  rule: Exclude<ProgressionRule, { kind: "none" }>;
  attempts: readonly ProgressionAttempt[];
  targetReps: number;
}): ProgressionTarget {
  const { rule, attempts } = input;
  if (rule.kind === "linear") return projectLinear(rule, attempts, input.targetReps);
  return projectDouble(rule, attempts);
}

function projectLinear(
  rule: Extract<ProgressionRule, { kind: "linear" }>,
  attempts: readonly ProgressionAttempt[],
  targetReps: number,
): ProgressionTarget {
  if (!Number.isInteger(targetReps) || targetReps < 1) {
    return {
      weight: 0,
      reps: 0,
      reason: "Set a rep target on the move before linear progression can add load.",
    };
  }
  let weight = 0;
  let stall = 0;
  let reason = `Start at 0 kg × ${targetReps}. No earlier working sets.`;
  for (const attempt of attempts) {
    const working = finishedWorking(attempt);
    if (!working) continue;
    const { load, worst, count } = sessionLoad(working);
    if (worst >= targetReps) {
      stall = 0;
      const next = addLoad(load, rule.incrementKg);
      if (next > load) {
        weight = next;
        reason = `+${kgText(rule.incrementKg)} kg: all ${count}×${targetReps} hit last time`;
      } else {
        weight = load;
        reason = heldReason(load, "the sheet stops at 400 kg");
      }
    } else {
      const missed = applyMiss(
        { weight, reps: targetReps, stall },
        rule.stallSessions,
        load,
        `a set missed ${targetReps} reps last time`,
        `${rule.stallSessions} sessions missed ${targetReps} reps`,
        null,
      );
      weight = missed.weight;
      stall = missed.stall;
      reason = missed.reason;
    }
  }
  return { weight, reps: targetReps, reason };
}

function projectDouble(
  rule: Extract<ProgressionRule, { kind: "double" }>,
  attempts: readonly ProgressionAttempt[],
): ProgressionTarget {
  const repMin = rule.repMin;
  const repMax = Math.max(rule.repMin, rule.repMax);
  let weight = 0;
  let reps = repMin;
  let stall = 0;
  let reason = `Start at 0 kg × ${repMin}. No earlier working sets.`;
  for (const attempt of attempts) {
    const working = finishedWorking(attempt);
    if (!working) continue;
    const { load, worst, count } = sessionLoad(working);
    if (worst >= repMax) {
      stall = 0;
      const next = addLoad(load, rule.incrementKg);
      reps = repMin;
      if (next > load) {
        weight = next;
        reason = `+${kgText(rule.incrementKg)} kg: all ${count}×${repMax} hit, reset to ${repMin}`;
      } else {
        weight = load;
        reason = heldReason(load, "the sheet stops at 400 kg");
      }
    } else if (worst >= reps) {
      stall = 0;
      const asked = reps;
      weight = cap(load);
      reps = Math.min(repMax, asked + 1);
      reason = `+1 rep: all ${count}×${asked} hit last time`;
    } else {
      const missed = applyMiss(
        { weight, reps, stall },
        rule.stallSessions,
        load,
        "a set missed last time",
        `${rule.stallSessions} sessions stalled in ${repMin}–${repMax}`,
        repMin,
      );
      weight = missed.weight;
      reps = missed.reps;
      stall = missed.stall;
      reason = missed.reason;
    }
  }
  return { weight, reps, reason };
}

/** True when the client should see a computed target instead of the last session. */
export function workoutHasTarget(workout: {
  progression: ProgressionRule;
  moves: ReadonlyArray<{ progression: ProgressionRule | null; targetOverride: { weightKg: number } | null }>;
}) {
  if (workout.progression.kind !== "none") return true;
  return workout.moves.some(
    (move) =>
      (move.progression !== null && move.progression.kind !== "none") || move.targetOverride !== null,
  );
}

export function progressionSummary(rule: ProgressionRule) {
  if (rule.kind === "none") return "No automatic increase";
  if (rule.kind === "linear") {
    return `Linear · +${kgText(rule.incrementKg)} kg when every set hits`;
  }
  return `Double · ${rule.repMin}–${rule.repMax} reps, then +${kgText(rule.incrementKg)} kg`;
}

export function validateProgressionRule(rule: ProgressionRule): { ok: true } | FieldError {
  if (rule.kind === "none") return { ok: true };
  if (!Number.isFinite(rule.incrementKg) || rule.incrementKg < 0.1 || rule.incrementKg > 50) {
    return { ok: false, error: "Enter an increase from 0.1 to 50 kg." };
  }
  if (!Number.isInteger(rule.stallSessions) || rule.stallSessions < 1 || rule.stallSessions > 10) {
    return { ok: false, error: "Enter stalled sessions from 1 to 10." };
  }
  if (rule.kind === "double") {
    if (!Number.isInteger(rule.repMin) || rule.repMin < 1 || rule.repMin > 100) {
      return { ok: false, error: "Enter the bottom of the rep range from 1 to 100." };
    }
    if (!Number.isInteger(rule.repMax) || rule.repMax < rule.repMin || rule.repMax > 100) {
      return { ok: false, error: "Enter the top of the rep range at or above the bottom, up to 100." };
    }
  }
  return { ok: true };
}

/** Round a coach-entered rule. Invalid rules come back as a field error. */
export function canonicalProgression(
  rule: ProgressionRule,
): { ok: true; rule: ProgressionRule } | FieldError {
  const valid = validateProgressionRule(rule);
  if (!valid.ok) return valid;
  if (rule.kind === "none") return { ok: true, rule: { kind: "none" } };
  if (rule.kind === "linear") {
    return {
      ok: true,
      rule: {
        kind: "linear",
        incrementKg: round1(rule.incrementKg),
        stallSessions: rule.stallSessions,
      },
    };
  }
  return {
    ok: true,
    rule: {
      kind: "double",
      incrementKg: round1(rule.incrementKg),
      stallSessions: rule.stallSessions,
      repMin: rule.repMin,
      repMax: rule.repMax,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function storedIncrement(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0.1 || value > 50) {
    return DEFAULT_INCREMENT_KG;
  }
  return round1(value);
}

function storedStall(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) {
    return DEFAULT_STALL_SESSIONS;
  }
  return value;
}

function storedRep(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 100) {
    return fallback;
  }
  return value;
}

/**
 * A stored rule, or None when the field is missing or not a known rule.
 * Out-of-range numbers fall back to the defaults so an old sheet still opens.
 */
export function readProgressionRule(raw: unknown): ProgressionRule {
  if (!isRecord(raw)) return { kind: "none" };
  if (raw.kind === "linear") {
    return {
      kind: "linear",
      incrementKg: storedIncrement(raw.incrementKg),
      stallSessions: storedStall(raw.stallSessions),
    };
  }
  if (raw.kind === "double") {
    const repMin = storedRep(raw.repMin, DEFAULT_REP_MIN);
    const repMax = Math.max(repMin, storedRep(raw.repMax, DEFAULT_REP_MAX));
    return {
      kind: "double",
      incrementKg: storedIncrement(raw.incrementKg),
      stallSessions: storedStall(raw.stallSessions),
      repMin,
      repMax,
    };
  }
  return { kind: "none" };
}

/** A stored coach override, or null when it is missing or out of range. */
export function readTargetOverride(raw: unknown): TargetOverride | null {
  if (!isRecord(raw)) return null;
  const weightKg = raw.weightKg;
  const reps = raw.reps;
  if (typeof weightKg !== "number" || !Number.isFinite(weightKg) || weightKg < 0 || weightKg > 400) {
    return null;
  }
  if (typeof reps !== "number" || !Number.isInteger(reps) || reps < 0 || reps > 100) return null;
  return { weightKg: round1(weightKg), reps };
}
