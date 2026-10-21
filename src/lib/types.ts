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

/** 0 is Sunday and 6 is Saturday, matching `Date.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Which day the Home week strip and the coach's week editor start on. */
export type WeekStart = "monday" | "sunday";

/**
 * Standing week for one client.
 * Each weekday maps to a workout id. A missing weekday is a rest day.
 * Moving or skipping one date is a `PlanOverride`, not a change to this map.
 */
export type WeeklyPlan = {
  clientId: string;
  days: Partial<Record<Weekday, string>>;
};

/**
 * One calendar date, leaving the standing week alone.
 * `skip` drops that date's planned workout.
 * `move` places that date's planned workout on `toDate` instead.
 */
export type PlanOverride = {
  id: string;
  clientId: string;
  /** Source date, YYYY-MM-DD in the local calendar. */
  date: string;
  kind: "skip" | "move";
  /** Destination date when `kind` is `move`. Null for a skip. */
  toDate: string | null;
};

/** No automatic increase. The next session repeats the last logged weight and reps. */
export type NoneProgression = { kind: "none" };

/**
 * Add `incrementKg` when every done working set hit the move's target reps.
 * After `stallSessions` misses in a row, the next load is a deload.
 */
export type LinearProgression = {
  kind: "linear";
  incrementKg: number;
  stallSessions: number;
};

/**
 * Add one rep at a time from `repMin` up to `repMax`.
 * Hitting the top adds `incrementKg` and resets to `repMin`.
 */
export type DoubleProgression = {
  kind: "double";
  incrementKg: number;
  repMin: number;
  repMax: number;
  stallSessions: number;
};

export type ProgressionRule = NoneProgression | LinearProgression | DoubleProgression;

/** Coach-set next weight and reps. It replaces the rule until cleared. */
export type TargetOverride = {
  weightKg: number;
  reps: number;
};

export type WorkoutMove = {
  id: string;
  exerciseId: string;
  sets: number;
  reps: string;
  /**
   * Null follows the workout rule. `{ kind: "none" }` turns progression off
   * for this move even when the workout has a rule.
   */
  progression: ProgressionRule | null;
  /** Null means the rule, or the last session when the rule is None, decides. */
  targetOverride: TargetOverride | null;
};

export type Workout = {
  id: string;
  clientId: string;
  name: string;
  assignedAt: string;
  moves: WorkoutMove[];
  /** Missing on an older sheet. Reading fills None. */
  progression: ProgressionRule;
};

/**
 * Browser sheet. The built-in exercise library is not stored.
 * Version stays 2. Older v2 blobs have no plan fields; reading them fills
 * `plans` and `overrides` with empty lists and `weekStartsOn` with Monday.
 * A workout with no progression rule is None. A move with no rule follows
 * the workout. A missing target override leaves the rule in charge.
 */
export type PersistedSheet = {
  version: typeof SHEET_VERSION;
  users: User[];
  clients: Client[];
  measurements: Measurement[];
  sessions: Session[];
  workouts: Workout[];
  plans: WeeklyPlan[];
  overrides: PlanOverride[];
  weekStartsOn: WeekStart;
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
  plans: WeeklyPlan[];
  overrides: PlanOverride[];
  weekStartsOn: WeekStart;
  exercises: Exercise[];
};

export type FieldError = { ok: false; error: string };
export type Done = { ok: true };
export type Result = Done | FieldError;
export type AddClientResult = { ok: true; clientId: string } | FieldError;
export type StartWorkoutResult = { ok: true; sessionId: string } | FieldError;
export type SignInResult = { ok: true; user: User } | FieldError;
