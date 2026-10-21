import type { Exercise, SessionExercise } from "@/lib/types";

export function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
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
