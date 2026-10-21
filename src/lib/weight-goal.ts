import { formatKg } from "./format";

/** Closer to the goal, farther from it, or the same distance. */
export type GoalDirection = "toward" | "away" | "flat";

/**
 * A coach-set body-weight goal, in kilograms.
 * Missing, non-numeric, and out-of-range values are no goal. The sheet stays
 * version 2 either way. Valid numbers are kept as stored; saving rounds them.
 */
export function normalizeGoal(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 1 || value > 400) return null;
  return value;
}

export function readGoalWeight(client: { goalWeightKg?: unknown } | null | undefined) {
  return normalizeGoal(client?.goalWeightKg);
}

function tenths(value: number) {
  return Math.round(value * 10);
}

/** Whether `next` is closer to `goal` than `previous` was. Compared in 0.1 kg. */
export function goalDirection(previous: number, next: number, goal: number): GoalDirection {
  const before = Math.abs(tenths(previous) - tenths(goal));
  const after = Math.abs(tenths(next) - tenths(goal));
  if (after < before) return "toward";
  if (after > before) return "away";
  return "flat";
}

/** Distance from the latest weigh-in to the goal, in the sheet's kg voice. */
export function formatGoalDistance(weightKg: number, goalKg: number) {
  const delta = Math.round(Math.abs(weightKg - goalKg) * 10) / 10;
  if (delta === 0) return `At the ${formatKg(goalKg)} goal`;
  const amount = Number.isInteger(delta) ? String(delta) : delta.toFixed(1);
  return `${amount} kg to the ${formatKg(goalKg)} goal`;
}
