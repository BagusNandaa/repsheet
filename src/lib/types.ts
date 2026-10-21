export type Role = "coach" | "client";

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  clientId?: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  userId: string;
  createdAt: string;
  /**
   * Body-weight goal in kilograms. Null when the coach has not set one.
   * Older v2 sheets omit the field; reading them fills null. Version stays 2.
   */
  goalWeightKg: number | null;
};

export type Measurement = {
  id: string;
  clientId: string;
  date: string;
  weightKg: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  thighCm?: number;
};

/** Who wrote a session. A migrated v1 sheet was written by the coach. */
export type LoggedBy = "coach" | "client";

/**
 * One set inside a logged exercise. Array order is the set order.
 * Later guided sessions, the rest timer, PRs, and progression read these rows.
 * Warm-ups stay in the list so that math can skip them.
 */
export type SessionSet = {
  id: string;
  weightKg: number;
  reps: number;
  done: boolean;
  isWarmup: boolean;
  /** ISO-8601 time the set was marked done. Null when the sheet has no clock time. */
  completedAt: string | null;
};

export type SessionExercise = {
  id: string;
  exerciseId: string;
  sets: SessionSet[];
};

export type Session = {
  id: string;
  clientId: string;
  date: string;
  title: string;
  loggedBy: LoggedBy;
  /** Assigned workout this session was performed from, when there is one. */
  workoutId: string | null;
  exercises: SessionExercise[];
};

/** What the coach form collects. Saving expands `sets` into one row per set. */
export type CoachLoggedExercise = {
  exerciseId: string;
  weightKg: number;
  reps: number;
  sets: number;
};

export const SHEET_VERSION = 2 as const;

export type WorkoutMove = {
  id: string;
  exerciseId: string;
  sets: number;
  reps: string;
};

export type Workout = {
  id: string;
  clientId: string;
  name: string;
  assignedAt: string;
  moves: WorkoutMove[];
};

/** Browser sheet. The built-in exercise library is not stored. */
export type PersistedSheet = {
  version: typeof SHEET_VERSION;
  users: User[];
  clients: Client[];
  measurements: Measurement[];
  sessions: Session[];
  workouts: Workout[];
};

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  cue: string;
  videoSrc: string;
  posterSrc: string;
  captionSrc: string;
};

export type AppData = {
  users: User[];
  clients: Client[];
  measurements: Measurement[];
  sessions: Session[];
  workouts: Workout[];
  exercises: Exercise[];
};

export type FieldError = { ok: false; error: string };
export type Done = { ok: true };
export type Result = Done | FieldError;
export type AddClientResult = { ok: true; clientId: string } | FieldError;
export type StartWorkoutResult = { ok: true; sessionId: string } | FieldError;
export type SignInResult = { ok: true; user: User } | FieldError;
