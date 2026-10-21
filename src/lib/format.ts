import type { Exercise, SessionExercise } from "@/lib/types";

/**
 * YYYY-MM-DD from the local calendar fields.
 * `toISOString()` is UTC, so local midnight in a timezone ahead of UTC would
 * become the previous day. Daylight-saving fall-back also makes a 24 hour
 * step land on the same calendar date.
 */
export function localISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return localISODate(new Date());
}

export function formatWeekday(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year || 1970, (month || 1) - 1, day || 1);
  return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
}

export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year || 1970, (month || 1) - 1, day || 1);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatKg(value: number) {
  if (value === 0) return "Bodyweight";
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${text} kg`;
}

export function formatWeightChange(latest: number, previous: number) {
  const delta = latest - previous;
  const signed = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
  return `${signed} kg`;
}

export function formatSet(exercise: Pick<SessionExercise, "sets">) {
  const first = exercise.sets[0];
  if (!first) return "No sets";
  const uniform = exercise.sets.every(
    (set) => set.weightKg === first.weightKg && set.reps === first.reps,
  );
  if (uniform) return `${exercise.sets.length} × ${first.reps} · ${formatKg(first.weightKg)}`;
  return exercise.sets.map((set) => `${set.reps} × ${formatKg(set.weightKg)}`).join(", ");
}

export function exerciseById(exercises: Exercise[], id: string) {
  return exercises.find((exercise) => exercise.id === id);
}

export function exerciseName(exercises: Exercise[], id: string) {
  return exerciseById(exercises, id)?.name ?? "Removed exercise";
}

export function isISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
