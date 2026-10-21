import type { LoggedBy, Session, SessionSet } from "./types";

/**
 * Estimated one-rep max and personal records, derived from logged sets.
 * Nothing here is stored. The sheet stays `repsheet.v2`.
 *
 * Estimated 1RM uses the Epley formula on every eligible set, including a single:
 *   e1RM = weightKg × (1 + reps / 30)
 * A set is eligible only when all of these hold:
 * - marked done
 * - not a warm-up
 * - external load greater than 0 kg (bodyweight has no load to estimate)
 * - a whole number of reps from 1 through 12
 * Sets above 12 reps are never used, even when the formula would score them higher.
 *
 * Three records are kept for each exercise:
 * - Heaviest weight among done, non-warm-up sets with at least 1 rep.
 * - Best estimated 1RM among eligible sets.
 * - Most reps at a given weight (weights within 0.1 kg match).
 *
 * Tie rule: when two sets compare equal on that metric, the earlier set wins.
 * Earlier means an earlier session date, then a lower index in the sessions
 * array (the one saved first), then a lower index in that session's exercise
 * list, then a lower index in the set list.
 *
 * A live flag means the set strictly beats the record built from every other
 * set. An equal result stays with the earlier set, so repeating a best set is
 * not a new PR. The set is left out of its own baseline, including when the
 * in-progress session is already in the saved list.
 */

/** Reps above this are never used for an estimated 1RM. */
export const E1RM_MAX_REPS = 12;

/** Newest sessions kept on the exercise history view. */
export const RECENT_SESSION_LIMIT = 10;

/** Epley: `weightKg × (1 + reps / 30)`. */
export function epley1Rm(weightKg: number, reps: number) {
  return weightKg * (1 + reps / 30);
}

export type RecordedSet = {
  sessionId: string;
  date: string;
  setId: string;
  weightKg: number;
  reps: number;
};

export type Estimated1Rm = RecordedSet & {
  /** Epley kilograms, unrounded. Display code rounds to 0.1 kg. */
  e1rmKg: number;
};

export type ExerciseRecords = {
  /** Null when no set is eligible. */
  estimated1Rm: Estimated1Rm | null;
  /** Null when the client has no done working set for this exercise. */
  heaviest: RecordedSet | null;
  /** One row per weight, heaviest weight first. */
  bestReps: RecordedSet[];
};

export type HistorySet = {
  setId: string;
  weightKg: number;
  reps: number;
  done: boolean;
  isWarmup: boolean;
};

export type HistorySession = {
  sessionId: string;
  date: string;
  title: string;
  loggedBy: LoggedBy;
  sets: HistorySet[];
};

export type ExerciseHistory = {
  records: ExerciseRecords;
  /** Newest first. */
  recent: HistorySession[];
};

export type PrKind = "heaviest" | "e1rm" | "reps";

export type PrFlag = {
  kind: PrKind;
  label: string;
};

const FLAG_LABEL: Record<PrKind, string> = {
  heaviest: "Heaviest",
  e1rm: "Est. 1RM",
  reps: "Reps",
};

type RankedSet = {
  sessionId: string;
  sessionDate: string;
  sessionIndex: number;
  exerciseIndex: number;
  setIndex: number;
  set: SessionSet;
};

function weightKey(weightKg: number) {
  return Math.round(weightKg * 10) / 10;
}

/** Rank key for Epley. Proportional to `weightKg × (30 + reps)`, so ties match the formula. */
function e1rmScore(weightKg: number, reps: number) {
  return Math.round(weightKg * (30 + reps) * 1000) / 1000;
}

function isEarlier(candidate: RankedSet, current: RankedSet) {
  if (candidate.sessionDate !== current.sessionDate) {
    return candidate.sessionDate < current.sessionDate;
  }
  if (candidate.sessionIndex !== current.sessionIndex) {
    return candidate.sessionIndex < current.sessionIndex;
  }
  if (candidate.exerciseIndex !== current.exerciseIndex) {
    return candidate.exerciseIndex < current.exerciseIndex;
  }
  return candidate.setIndex < current.setIndex;
}

function isWorking(set: SessionSet) {
  return (
    set.done === true &&
    set.isWarmup === false &&
    Number.isFinite(set.weightKg) &&
    set.weightKg >= 0 &&
    Number.isInteger(set.reps) &&
    set.reps >= 1
  );
}

function isEstimable(set: SessionSet) {
  return isWorking(set) && set.weightKg > 0 && set.reps <= E1RM_MAX_REPS;
}

function collect(sessions: readonly Session[], clientId: string, exerciseId: string) {
  const rows: RankedSet[] = [];
  sessions.forEach((session, sessionIndex) => {
    if (session.clientId !== clientId) return;
    session.exercises.forEach((exercise, exerciseIndex) => {
      if (exercise.exerciseId !== exerciseId) return;
      exercise.sets.forEach((set, setIndex) => {
        rows.push({
          sessionId: session.id,
          sessionDate: session.date,
          sessionIndex,
          exerciseIndex,
          setIndex,
          set,
        });
      });
    });
  });
  return rows;
}

function toRecorded(row: RankedSet): RecordedSet {
  return {
    sessionId: row.sessionId,
    date: row.sessionDate,
    setId: row.set.id,
    weightKg: row.set.weightKg,
    reps: row.set.reps,
  };
}

function pickHeaviest(rows: readonly RankedSet[]) {
  let best: RankedSet | null = null;
  for (const row of rows) {
    if (!isWorking(row.set)) continue;
    if (!best) {
      best = row;
      continue;
    }
    const cmp = weightKey(row.set.weightKg) - weightKey(best.set.weightKg);
    if (cmp > 0 || (cmp === 0 && isEarlier(row, best))) best = row;
  }
  return best;
}

function pickEstimate(rows: readonly RankedSet[]) {
  let best: RankedSet | null = null;
  for (const row of rows) {
    if (!isEstimable(row.set)) continue;
    if (!best) {
      best = row;
      continue;
    }
    const cmp = e1rmScore(row.set.weightKg, row.set.reps) - e1rmScore(best.set.weightKg, best.set.reps);
    if (cmp > 0 || (cmp === 0 && isEarlier(row, best))) best = row;
  }
  return best;
}

function pickBestReps(rows: readonly RankedSet[]) {
  const byWeight = new Map<number, RankedSet>();
  for (const row of rows) {
    if (!isWorking(row.set)) continue;
    const key = weightKey(row.set.weightKg);
    const current = byWeight.get(key);
    if (
      !current ||
      row.set.reps > current.set.reps ||
      (row.set.reps === current.set.reps && isEarlier(row, current))
    ) {
      byWeight.set(key, row);
    }
  }
  return [...byWeight.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => row);
}

export function exerciseRecords(
  sessions: readonly Session[],
  clientId: string,
  exerciseId: string,
): ExerciseRecords {
  const rows = collect(sessions, clientId, exerciseId);
  const estimate = pickEstimate(rows);
  const heaviest = pickHeaviest(rows);
  return {
    estimated1Rm: estimate
      ? { ...toRecorded(estimate), e1rmKg: epley1Rm(estimate.set.weightKg, estimate.set.reps) }
      : null,
    heaviest: heaviest ? toRecorded(heaviest) : null,
    bestReps: pickBestReps(rows).map(toRecorded),
  };
}

export function loggedExerciseIds(sessions: readonly Session[], clientId: string) {
  const latest = new Map<string, { date: string; index: number }>();
  sessions.forEach((session, index) => {
    if (session.clientId !== clientId) return;
    for (const exercise of session.exercises) {
      if (!exercise.sets.some(isWorking)) continue;
      const prev = latest.get(exercise.exerciseId);
      if (
        !prev ||
        session.date > prev.date ||
        (session.date === prev.date && index > prev.index)
      ) {
        latest.set(exercise.exerciseId, { date: session.date, index });
      }
    }
  });
  return [...latest.entries()]
    .sort((a, b) => {
      if (a[1].date !== b[1].date) return a[1].date < b[1].date ? 1 : -1;
      return b[1].index - a[1].index;
    })
    .map(([id]) => id);
}

export function exerciseHistory(
  sessions: readonly Session[],
  clientId: string,
  exerciseId: string,
): ExerciseHistory {
  const recent: Array<HistorySession & { sessionIndex: number }> = [];
  sessions.forEach((session, sessionIndex) => {
    if (session.clientId !== clientId) return;
    const sets = session.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId)
      .flatMap((exercise) =>
        exercise.sets.map((set) => ({
          setId: set.id,
          weightKg: set.weightKg,
          reps: set.reps,
          done: set.done,
          isWarmup: set.isWarmup,
        })),
      );
    if (sets.length === 0) return;
    recent.push({
      sessionId: session.id,
      date: session.date,
      title: session.title,
      loggedBy: session.loggedBy,
      sets,
      sessionIndex,
    });
  });
  recent.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.sessionIndex - a.sessionIndex;
  });
  return {
    records: exerciseRecords(sessions, clientId, exerciseId),
    recent: recent.slice(0, RECENT_SESSION_LIMIT).map((session) => ({
      sessionId: session.sessionId,
      date: session.date,
      title: session.title,
      loggedBy: session.loggedBy,
      sets: session.sets,
    })),
  };
}

function sessionsWithoutSet(sessions: readonly Session[], sessionId: string, setId: string) {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    return {
      ...session,
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.filter((set) => set.id !== setId),
      })),
    };
  });
}

function findSet(
  sessions: readonly Session[],
  sessionId: string,
  setId: string,
  exerciseId: string,
) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  for (const exercise of session.exercises) {
    if (exercise.exerciseId !== exerciseId) continue;
    const set = exercise.sets.find((item) => item.id === setId);
    if (set) return { session, set };
  }
  return null;
}

/**
 * Flags for one set the client is logging.
 * `sessions` may already include the in-progress session. That set is removed
 * before the baseline is built, so it cannot tie with itself.
 */
export function personalRecordFlags(input: {
  sessions: readonly Session[];
  clientId: string;
  exerciseId: string;
  sessionId: string;
  setId: string;
}): PrFlag[] {
  const located = findSet(input.sessions, input.sessionId, input.setId, input.exerciseId);
  if (!located || located.session.clientId !== input.clientId || !isWorking(located.set)) return [];

  const baseline = exerciseRecords(
    sessionsWithoutSet(input.sessions, input.sessionId, input.setId),
    input.clientId,
    input.exerciseId,
  );
  const flags: PrFlag[] = [];
  const weight = weightKey(located.set.weightKg);
  const priorWeight = baseline.heaviest ? weightKey(baseline.heaviest.weightKg) : null;
  if (priorWeight === null || weight > priorWeight) {
    flags.push({ kind: "heaviest", label: FLAG_LABEL.heaviest });
  }
  if (isEstimable(located.set)) {
    const score = e1rmScore(located.set.weightKg, located.set.reps);
    const priorScore = baseline.estimated1Rm
      ? e1rmScore(baseline.estimated1Rm.weightKg, baseline.estimated1Rm.reps)
      : null;
    if (priorScore === null || score > priorScore) {
      flags.push({ kind: "e1rm", label: FLAG_LABEL.e1rm });
    }
  }
  const priorReps = baseline.bestReps.find((row) => weightKey(row.weightKg) === weight);
  if (!priorReps || located.set.reps > priorReps.reps) {
    flags.push({ kind: "reps", label: FLAG_LABEL.reps });
  }
  return flags;
}

/** One decimal kilogram, for an estimate that is already known to be a load. */
export function formatEstimateKg(e1rmKg: number) {
  const rounded = Math.round(e1rmKg * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} kg`;
}
