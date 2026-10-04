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

export type SessionExercise = {
  id: string;
  exerciseId: string;
  weightKg: number;
  reps: number;
  sets: number;
};

export type Session = {
  id: string;
  clientId: string;
  date: string;
  title: string;
  exercises: SessionExercise[];
};

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
export type SignInResult = { ok: true; user: User } | FieldError;
