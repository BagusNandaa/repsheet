import type { Result, Session, SessionSet, Workout, WorkoutMove } from "./types";

/** One weight and rep count copied onto every set of a new exercise. */
export type SetPrescription = {
  weightKg: number;
  reps: number;
};

export type SetPatch = {
  weightKg?: number;
  reps?: number;
  done?: boolean;
};

const MAX_SETS = 20;

/**
 * Reps text on an assigned move, such as "8", "40 sec", or "10 each".
 * The first whole number is the target. No number means 0.
 */
export function parseTargetReps(reps: string): number {
  const match = /\d+/.exec(reps);
  if (!match) return 0;
  const value = Number(match[0]);
  return Number.isInteger(value) ? value : 0;
}

/** Last working set, or the last set when every row is a warm-up. */
export function prescriptionFromSets(sets: readonly SessionSet[]): SetPrescription | null {
  const working = sets.filter((set) => !set.isWarmup);
  const source = working.length > 0 ? working : sets;
  const last = source[source.length - 1];
  if (!last) return null;
  return { weightKg: last.weightKg, reps: last.reps };
}

/**
 * Weight and reps from this client's most recent session that logged the exercise.
 * A later date wins. The same date keeps the later row, which is the one saved last.
 * Null means there is no history and the caller should use the workout target.
 */
export function lastExercisePrescription(
  sessions: readonly Session[],
  clientId: string,
  exerciseId: string,
): SetPrescription | null {
  let best: { date: string; index: number; sets: SessionSet[] } | null = null;
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    if (!session || session.clientId !== clientId) continue;
    const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
    if (!exercise || exercise.sets.length === 0) continue;
    if (
      best === null ||
      session.date > best.date ||
      (session.date === best.date && index > best.index)
    ) {
      best = { date: session.date, index, sets: exercise.sets };
    }
  }
  if (best === null) return null;
  return prescriptionFromSets(best.sets);
}

export function exercisePrescription(
  sessions: readonly Session[],
  clientId: string,
  move: WorkoutMove,
): SetPrescription {
  return (
    lastExercisePrescription(sessions, clientId, move.exerciseId) ?? {
      weightKg: 0,
      reps: parseTargetReps(move.reps),
    }
  );
}

function plannedSetCount(move: WorkoutMove) {
  if (Number.isInteger(move.sets) && move.sets >= 1 && move.sets <= MAX_SETS) return move.sets;
  return 1;
}

/**
 * A new client session for one assigned workout.
 * Each move becomes that many undone sets. Weight and reps come from the last
 * session for the exercise, otherwise the workout target (bodyweight when the
 * target has no weight). History is the sessions passed in, so the new session
 * is not its own source.
 */
export function buildClientSession(input: {
  clientId: string;
  workout: Workout;
  sessions: readonly Session[];
  date: string;
  createId: () => string;
}): Session {
  return {
    id: input.createId(),
    clientId: input.clientId,
    date: input.date,
    title: input.workout.name,
    loggedBy: "client",
    workoutId: input.workout.id,
    exercises: input.workout.moves.map((move) => {
      const prescription = exercisePrescription(input.sessions, input.clientId, move);
      const count = plannedSetCount(move);
      return {
        id: input.createId(),
        exerciseId: move.exerciseId,
        sets: Array.from({ length: count }, () => ({
          id: input.createId(),
          weightKg: prescription.weightKg,
          reps: prescription.reps,
          done: false,
          isWarmup: false,
          completedAt: null,
        })),
      };
    }),
  };
}

export function sessionProgress(session: Session) {
  let done = 0;
  let total = 0;
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      total += 1;
      if (set.done) done += 1;
    }
  }
  return { done, total };
}

export function isSessionComplete(session: Session) {
  const progress = sessionProgress(session);
  return progress.total > 0 && progress.done === progress.total;
}

function isClientWorkoutSession(session: Session, clientId: string, workoutId: string) {
  return (
    session.clientId === clientId &&
    session.loggedBy === "client" &&
    session.workoutId === workoutId
  );
}

/** Latest unfinished client session for this workout. */
export function openClientSession(
  sessions: readonly Session[],
  clientId: string,
  workoutId: string,
): Session | null {
  let best: { session: Session; index: number } | null = null;
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    if (!session || !isClientWorkoutSession(session, clientId, workoutId)) continue;
    if (isSessionComplete(session)) continue;
    if (
      best === null ||
      session.date > best.session.date ||
      (session.date === best.session.date && index > best.index)
    ) {
      best = { session, index };
    }
  }
  return best?.session ?? null;
}

/** Latest client session for this workout, finished or not. */
export function latestClientWorkoutSession(
  sessions: readonly Session[],
  clientId: string,
  workoutId: string,
): Session | null {
  let best: { session: Session; index: number } | null = null;
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    if (!session || !isClientWorkoutSession(session, clientId, workoutId)) continue;
    if (
      best === null ||
      session.date > best.session.date ||
      (session.date === best.session.date && index > best.index)
    ) {
      best = { session, index };
    }
  }
  return best?.session ?? null;
}

/**
 * Which session the screen should show.
 * An open session always wins. `starting` means the client asked for a new one:
 * the caller creates it when this returns null. Otherwise a finished session
 * stays on screen so a reload does not open a second copy.
 */
export function sessionToResume(
  sessions: readonly Session[],
  clientId: string,
  workoutId: string,
  starting: boolean,
): Session | null {
  const open = openClientSession(sessions, clientId, workoutId);
  if (open) return open;
  if (starting) return null;
  return latestClientWorkoutSession(sessions, clientId, workoutId);
}

/** Unfinished client sessions, newest first. */
export function openClientSessions(sessions: readonly Session[], clientId: string): Session[] {
  return sessions
    .map((session, index) => ({ session, index }))
    .filter(
      ({ session }) =>
        session.clientId === clientId &&
        session.loggedBy === "client" &&
        session.workoutId !== null &&
        !isSessionComplete(session),
    )
    .sort((a, b) => {
      if (a.session.date !== b.session.date) return a.session.date < b.session.date ? 1 : -1;
      return b.index - a.index;
    })
    .map(({ session }) => session);
}

/**
 * Resume an open session, or build one. `created` is false when the open
 * session was returned so the caller does not write a second copy.
 */
export function planClientSession(input: {
  clientId: string;
  workout: Workout;
  sessions: readonly Session[];
  date: string;
  createId: () => string;
}): { session: Session; created: boolean } {
  const existing = openClientSession(input.sessions, input.clientId, input.workout.id);
  if (existing) return { session: existing, created: false };
  return { session: buildClientSession(input), created: true };
}

export function firstOpenExerciseIndex(session: Session) {
  const index = session.exercises.findIndex((exercise) =>
    exercise.sets.some((set) => !set.done),
  );
  if (index >= 0) return index;
  return Math.max(0, session.exercises.length - 1);
}

export function validateSetPatch(patch: SetPatch): Result {
  if (patch.weightKg === undefined && patch.reps === undefined && patch.done === undefined) {
    return { ok: false, error: "Nothing to save." };
  }
  if (
    patch.weightKg !== undefined &&
    (!Number.isFinite(patch.weightKg) || patch.weightKg < 0 || patch.weightKg > 400)
  ) {
    return { ok: false, error: "Enter a weight from 0 (bodyweight) to 400 kg." };
  }
  if (
    patch.reps !== undefined &&
    (!Number.isInteger(patch.reps) || patch.reps < 0 || patch.reps > 100)
  ) {
    return { ok: false, error: "Enter reps from 0 to 100." };
  }
  return { ok: true };
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function patchSessionSet(
  session: Session,
  setId: string,
  patch: SetPatch,
  completedAt: string,
): Session | null {
  let found = false;
  const exercises = session.exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => {
      if (set.id !== setId) return set;
      found = true;
      let nextCompleted = set.completedAt;
      if (patch.done === true) nextCompleted = completedAt;
      if (patch.done === false) nextCompleted = null;
      return {
        ...set,
        weightKg: patch.weightKg === undefined ? set.weightKg : round1(patch.weightKg),
        reps: patch.reps === undefined ? set.reps : patch.reps,
        done: patch.done ?? set.done,
        completedAt: nextCompleted,
      };
    }),
  }));
  if (!found) return null;
  return { ...session, exercises };
}

/** Apply a set edit to a client-logged session. Coach rows are left alone. */
export function applyClientSetUpdate(
  sessions: readonly Session[],
  sessionId: string,
  setId: string,
  patch: SetPatch,
  completedAt: string,
): { ok: true; sessions: Session[] } | { ok: false; error: string } {
  const valid = validateSetPatch(patch);
  if (!valid.ok) return valid;
  const session = sessions.find((item) => item.id === sessionId);
  if (!session || session.loggedBy !== "client") {
    return { ok: false, error: "That session is not on your sheet." };
  }
  const next = patchSessionSet(session, setId, patch, completedAt);
  if (!next) return { ok: false, error: "That set is not in this session." };
  return {
    ok: true,
    sessions: sessions.map((item) => (item.id === sessionId ? next : item)),
  };
}

export const WEIGHT_STEP_KG = 2.5;

export function stepWeight(current: number, direction: -1 | 1) {
  const next = round1(current + direction * WEIGHT_STEP_KG);
  return Math.min(400, Math.max(0, next));
}

export function stepReps(current: number, direction: -1 | 1) {
  return Math.min(100, Math.max(0, current + direction));
}

/** A weight the client typed. Null keeps the stored number. */
export function parseLoggedWeight(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 400) return null;
  return value;
}

/** Reps the client typed. Null keeps the stored number. */
export function parseLoggedReps(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0 || value > 100) return null;
  return value;
}

export function formatWeightInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
