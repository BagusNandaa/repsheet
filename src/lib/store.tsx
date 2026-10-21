"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { isISODate, todayISO } from "@/lib/format";
import {
  SESSION_KEY,
  STORAGE_KEY_V2,
  expandUniformSets,
  persistedSheet,
  readStoredSheet,
} from "@/lib/migrate";
import { createSeed } from "@/lib/seed";
import { planWorkoutId, WEEKDAYS } from "@/lib/schedule";
import { canonicalProgression } from "@/lib/progression";
import { applyClientSetUpdate, planClientSession } from "@/lib/session-plan";
import { normalizeGoal } from "@/lib/weight-goal";
import type {
  AddClientResult,
  AppData,
  CoachLoggedExercise,
  Measurement,
  PlanOverride,
  ProgressionRule,
  Result,
  SignInResult,
  StartWorkoutResult,
  TargetOverride,
  User,
  Weekday,
  WeeklyPlan,
  WeekStart,
  WorkoutMove,
} from "@/lib/types";

type Snapshot = {
  ready: boolean;
  // False until this tab has read localStorage. Server HTML cannot know the
  // signed-in person, and a redirect before this read sends a reload to login.
  sessionKnown: boolean;
  data: AppData;
  userId: string | null;
};

type StoreValue = {
  ready: boolean;
  sessionKnown: boolean;
  data: AppData | null;
  user: User | null;
  signIn: (email: string, password: string) => SignInResult;
  signOut: () => void;
  addClient: (input: { name: string; email: string; password: string }) => AddClientResult;
  setGoalWeight: (input: { clientId: string; goalWeightKg: number | null }) => Result;
  addMeasurement: (input: {
    clientId: string;
    date: string;
    weightKg: number;
    chestCm?: number;
    waistCm?: number;
    hipsCm?: number;
    thighCm?: number;
  }) => Result;
  addSession: (input: {
    clientId: string;
    date: string;
    title: string;
    exercises: CoachLoggedExercise[];
  }) => Result;
  assignWorkout: (input: {
    clientId: string;
    name: string;
    progression?: ProgressionRule;
    moves: Array<Omit<WorkoutMove, "id" | "targetOverride"> & { targetOverride?: TargetOverride | null }>;
  }) => Result;
  saveWorkoutProgression: (input: {
    workoutId: string;
    progression: ProgressionRule;
    moves: Array<{
      id: string;
      progression: ProgressionRule | null;
      targetOverride: TargetOverride | null;
    }>;
  }) => Result;
  startClientWorkout: (workoutId: string) => StartWorkoutResult;
  saveWeeklyPlan: (input: { clientId: string; days: Partial<Record<Weekday, string>> }) => Result;
  setDateOverride: (input: {
    clientId: string;
    date: string;
    kind: "skip" | "move";
    toDate?: string;
  }) => Result;
  clearDateOverride: (input: { clientId: string; date: string }) => Result;
  setWeekStart: (weekStartsOn: WeekStart) => Result;
  updateClientSet: (input: {
    sessionId: string;
    setId: string;
    weightKg?: number;
    reps?: number;
    done?: boolean;
    isWarmup?: boolean;
  }) => Result;
  resetDemo: () => void;
};

const serverSnapshot: Snapshot = {
  ready: true,
  sessionKnown: false,
  data: createSeed(),
  userId: null,
};

// Start as the server snapshot so hydration matches. Local data is applied
// after mount; reading it inside getSnapshot during hydration leaves the
// boot screen in place.
let snapshot: Snapshot = serverSnapshot;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function loadData(): AppData {
  const seed = createSeed();
  try {
    const stored = readStoredSheet(localStorage);
    if (!stored) return seed;
    return { ...stored, exercises: seed.exercises };
  } catch {
    return seed;
  }
}

function readClient(): Snapshot {
  try {
    const data = loadData();
    const storedUser = localStorage.getItem(SESSION_KEY);
    const valid = Boolean(
      storedUser && data.users.some((person) => person.id === storedUser),
    );
    return {
      ready: true,
      sessionKnown: true,
      data,
      userId: valid ? storedUser : null,
    };
  } catch {
    return { ready: true, sessionKnown: true, data: createSeed(), userId: null };
  }
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return serverSnapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: Snapshot) {
  snapshot = next;
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(persistedSheet(next.data)));
  if (next.userId) localStorage.setItem(SESSION_KEY, next.userId);
  else localStorage.removeItem(SESSION_KEY);
  emit();
}

function currentUser(snapshot: Snapshot) {
  return snapshot.data.users.find((person) => person.id === snapshot.userId) ?? null;
}

function coachError(user: User | null) {
  if (!user || user.role !== "coach") return "Only the coach can change a sheet.";
  return null;
}

function optionalCm(value: number | undefined, label: string) {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0 || value > 250) {
    return `Enter ${label} between 1 and 250 cm, or leave it blank.`;
  }
  return null;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function roundOptional(value: number | undefined) {
  if (value === undefined) return undefined;
  return round1(value);
}

function collectPlanDays(
  days: Partial<Record<Weekday, string>>,
  workouts: AppData["workouts"],
  clientId: string,
): { ok: true; days: WeeklyPlan["days"] } | { ok: false; error: string } {
  const next: WeeklyPlan["days"] = {};
  for (const weekday of WEEKDAYS) {
    const workoutId = days[weekday];
    if (!workoutId) continue;
    const workout = workouts.find((item) => item.id === workoutId);
    if (!workout || workout.clientId !== clientId) {
      return { ok: false, error: "Choose a workout assigned to this client." };
    }
    next[weekday] = workoutId;
  }
  return { ok: true, days: next };
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    snapshot = readClient();
    emit();
  }, []);

  const user = current.ready ? currentUser(current) : null;

  const signIn = useCallback((email: string, password: string): SignInResult => {
    const current = getSnapshot();
    const normalized = email.trim().toLowerCase();
    const match = current.data.users.find(
      (person) => person.email === normalized && person.password === password,
    );
    if (!match) {
      return {
        ok: false,
        error: "That email and password do not match anyone on this device.",
      };
    }
    commit({ ...current, userId: match.id });
    return { ok: true, user: match };
  }, []);

  const signOut = useCallback(() => {
    const current = getSnapshot();
    commit({ ...current, userId: null });
  }, []);

  const addClient = useCallback(
    (input: { name: string; email: string; password: string }): AddClientResult => {
      const current = getSnapshot();
      const denied = coachError(currentUser(current));
      if (denied) return { ok: false, error: denied };
      const name = input.name.trim().replace(/\s+/g, " ");
      const email = input.email.trim().toLowerCase();
      const password = input.password.trim();
      if (name.length < 2) return { ok: false, error: "Enter the client's name." };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: "Enter a valid email." };
      }
      if (password.length < 4) {
        return { ok: false, error: "Use a password of at least 4 characters." };
      }
      if (current.data.users.some((person) => person.email === email)) {
        return { ok: false, error: "Someone on this device already uses that email." };
      }
      const clientId = crypto.randomUUID();
      const nextUser: User = {
        id: crypto.randomUUID(),
        name,
        email,
        password,
        role: "client",
        clientId,
      };
      commit({
        ...current,
        data: {
          ...current.data,
          users: [...current.data.users, nextUser],
          clients: [
            ...current.data.clients,
            {
              id: clientId,
              name,
              email,
              userId: nextUser.id,
              createdAt: todayISO(),
              goalWeightKg: null,
            },
          ],
        },
      });
      return { ok: true, clientId };
    },
    [],
  );

  const addMeasurement = useCallback(
    (input: {
      clientId: string;
      date: string;
      weightKg: number;
      chestCm?: number;
      waistCm?: number;
      hipsCm?: number;
      thighCm?: number;
    }): Result => {
      const current = getSnapshot();
      const denied = coachError(currentUser(current));
      if (denied) return { ok: false, error: denied };
      if (!current.data.clients.some((client) => client.id === input.clientId)) {
        return { ok: false, error: "That client is not on this sheet." };
      }
      if (!isISODate(input.date) || input.date > todayISO()) {
        return { ok: false, error: "Use today or an earlier date." };
      }
      if (!Number.isFinite(input.weightKg) || input.weightKg <= 0 || input.weightKg > 400) {
        return { ok: false, error: "Enter a weight between 1 and 400 kg." };
      }
      const tapeChecks: Array<[number | undefined, string]> = [
        [input.chestCm, "chest"],
        [input.waistCm, "waist"],
        [input.hipsCm, "hips"],
        [input.thighCm, "thigh"],
      ];
      for (const [value, label] of tapeChecks) {
        const problem = optionalCm(value, label);
        if (problem) return { ok: false, error: problem };
      }
      const entry: Measurement = {
        id: crypto.randomUUID(),
        clientId: input.clientId,
        date: input.date,
        weightKg: round1(input.weightKg),
        chestCm: roundOptional(input.chestCm),
        waistCm: roundOptional(input.waistCm),
        hipsCm: roundOptional(input.hipsCm),
        thighCm: roundOptional(input.thighCm),
      };
      commit({
        ...current,
        data: { ...current.data, measurements: [...current.data.measurements, entry] },
      });
      return { ok: true };
    },
    [],
  );

  const setGoalWeight = useCallback(
    (input: { clientId: string; goalWeightKg: number | null }): Result => {
      const current = getSnapshot();
      const denied = coachError(currentUser(current));
      if (denied) return { ok: false, error: denied };
      if (!current.data.clients.some((client) => client.id === input.clientId)) {
        return { ok: false, error: "That client is not on this sheet." };
      }
      let goal: number | null = null;
      if (input.goalWeightKg !== null) {
        if (normalizeGoal(input.goalWeightKg) === null) {
          return { ok: false, error: "Enter a goal between 1 and 400 kg." };
        }
        goal = round1(input.goalWeightKg);
      }
      commit({
        ...current,
        data: {
          ...current.data,
          clients: current.data.clients.map((client) =>
            client.id === input.clientId ? { ...client, goalWeightKg: goal } : client,
          ),
        },
      });
      return { ok: true };
    },
    [],
  );

  const addSession = useCallback(
    (input: {
      clientId: string;
      date: string;
      title: string;
      exercises: CoachLoggedExercise[];
    }): Result => {
      const current = getSnapshot();
      const denied = coachError(currentUser(current));
      if (denied) return { ok: false, error: denied };
      if (!current.data.clients.some((client) => client.id === input.clientId)) {
        return { ok: false, error: "That client is not on this sheet." };
      }
      if (!isISODate(input.date) || input.date > todayISO()) {
        return { ok: false, error: "Use today or an earlier date." };
      }
      const title = input.title.trim().replace(/\s+/g, " ");
      if (title.length > 60) {
        return { ok: false, error: "Keep the session title under 60 characters." };
      }
      if (input.exercises.length === 0) {
        return { ok: false, error: "Add at least one exercise." };
      }
      for (const exercise of input.exercises) {
        if (!current.data.exercises.some((item) => item.id === exercise.exerciseId)) {
          return { ok: false, error: "Choose an exercise from the library." };
        }
        if (
          !Number.isFinite(exercise.weightKg) ||
          exercise.weightKg < 0 ||
          exercise.weightKg > 400
        ) {
          return { ok: false, error: "Enter a weight from 0 (bodyweight) to 400 kg." };
        }
        if (!Number.isInteger(exercise.reps) || exercise.reps < 1 || exercise.reps > 100) {
          return { ok: false, error: "Enter reps from 1 to 100." };
        }
        if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 20) {
          return { ok: false, error: "Enter sets from 1 to 20." };
        }
      }
      commit({
        ...current,
        data: {
          ...current.data,
          sessions: [
            ...current.data.sessions,
            {
              id: crypto.randomUUID(),
              clientId: input.clientId,
              date: input.date,
              title,
              loggedBy: "coach",
              workoutId: null,
              exercises: input.exercises.map((exercise) => ({
                id: crypto.randomUUID(),
                exerciseId: exercise.exerciseId,
                sets: expandUniformSets(
                  exercise.sets,
                  round1(exercise.weightKg),
                  exercise.reps,
                  () => crypto.randomUUID(),
                ),
              })),
            },
          ],
        },
      });
      return { ok: true };
    },
    [],
  );

  const assignWorkout = useCallback(
    (input: {
      clientId: string;
      name: string;
      progression?: ProgressionRule;
      moves: Array<Omit<WorkoutMove, "id" | "targetOverride"> & { targetOverride?: TargetOverride | null }>;
    }): Result => {
      const current = getSnapshot();
      const denied = coachError(currentUser(current));
      if (denied) return { ok: false, error: denied };
      if (!current.data.clients.some((client) => client.id === input.clientId)) {
        return { ok: false, error: "That client is not on this sheet." };
      }
      const name = input.name.trim().replace(/\s+/g, " ");
      if (name.length < 2 || name.length > 60) {
        return { ok: false, error: "Name the workout in 2 to 60 characters." };
      }
      if (input.moves.length === 0) return { ok: false, error: "Add at least one move." };
      const progression = canonicalProgression(input.progression ?? { kind: "none" });
      if (!progression.ok) return progression;
      const moves: WorkoutMove[] = [];
      for (const move of input.moves) {
        if (!current.data.exercises.some((item) => item.id === move.exerciseId)) {
          return { ok: false, error: "Choose an exercise from the library." };
        }
        if (!Number.isInteger(move.sets) || move.sets < 1 || move.sets > 20) {
          return { ok: false, error: "Enter sets from 1 to 20." };
        }
        const reps = move.reps.trim();
        if (reps.length < 1 || reps.length > 20) {
          return { ok: false, error: "Enter the reps, such as 8 or 40 sec." };
        }
        let moveRule: ProgressionRule | null = null;
        if (move.progression) {
          const checked = canonicalProgression(move.progression);
          if (!checked.ok) return checked;
          moveRule = checked.rule;
        }
        moves.push({
          id: crypto.randomUUID(),
          exerciseId: move.exerciseId,
          sets: move.sets,
          reps,
          progression: moveRule,
          targetOverride: null,
        });
      }
      commit({
        ...current,
        data: {
          ...current.data,
          workouts: [
            ...current.data.workouts,
            {
              id: crypto.randomUUID(),
              clientId: input.clientId,
              name,
              assignedAt: todayISO(),
              progression: progression.rule,
              moves,
            },
          ],
        },
      });
      return { ok: true };
    },
    [],
  );

  const saveWorkoutProgression = useCallback(
    (input: {
      workoutId: string;
      progression: ProgressionRule;
      moves: Array<{
        id: string;
        progression: ProgressionRule | null;
        targetOverride: TargetOverride | null;
      }>;
    }): Result => {
      const current = getSnapshot();
      const denied = coachError(currentUser(current));
      if (denied) return { ok: false, error: denied };
      const workout = current.data.workouts.find((item) => item.id === input.workoutId);
      if (!workout) return { ok: false, error: "That workout is not on this sheet." };
      const progression = canonicalProgression(input.progression);
      if (!progression.ok) return progression;
      const moves: WorkoutMove[] = [];
      for (const move of workout.moves) {
        const patch = input.moves.find((item) => item.id === move.id);
        if (!patch) {
          moves.push(move);
          continue;
        }
        let moveRule: ProgressionRule | null = null;
        if (patch.progression) {
          const checked = canonicalProgression(patch.progression);
          if (!checked.ok) return checked;
          moveRule = checked.rule;
        }
        let targetOverride: TargetOverride | null = null;
        if (patch.targetOverride) {
          const weightKg = round1(patch.targetOverride.weightKg);
          const reps = patch.targetOverride.reps;
          if (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 400) {
            return { ok: false, error: "Enter a target weight from 0 to 400 kg." };
          }
          if (!Number.isInteger(reps) || reps < 0 || reps > 100) {
            return { ok: false, error: "Enter target reps from 0 to 100." };
          }
          targetOverride = { weightKg, reps };
        }
        moves.push({ ...move, progression: moveRule, targetOverride });
      }
      commit({
        ...current,
        data: {
          ...current.data,
          workouts: current.data.workouts.map((item) =>
            item.id === workout.id ? { ...item, progression: progression.rule, moves } : item,
          ),
        },
      });
      return { ok: true };
    },
    [],
  );

  const saveWeeklyPlan = useCallback(
    (input: { clientId: string; days: Partial<Record<Weekday, string>> }): Result => {
      const current = getSnapshot();
      const denied = coachError(currentUser(current));
      if (denied) return { ok: false, error: denied };
      if (!current.data.clients.some((client) => client.id === input.clientId)) {
        return { ok: false, error: "That client is not on this sheet." };
      }
      const collected = collectPlanDays(input.days, current.data.workouts, input.clientId);
      if (!collected.ok) return collected;
      const plans = current.data.plans.filter((plan) => plan.clientId !== input.clientId);
      plans.push({ clientId: input.clientId, days: collected.days });
      commit({ ...current, data: { ...current.data, plans } });
      return { ok: true };
    },
    [],
  );

  const setDateOverride = useCallback(
    (input: {
      clientId: string;
      date: string;
      kind: "skip" | "move";
      toDate?: string;
    }): Result => {
      const current = getSnapshot();
      const denied = coachError(currentUser(current));
      if (denied) return { ok: false, error: denied };
      if (!current.data.clients.some((client) => client.id === input.clientId)) {
        return { ok: false, error: "That client is not on this sheet." };
      }
      if (!isISODate(input.date)) return { ok: false, error: "Choose a real date." };
      const plan = current.data.plans.find((item) => item.clientId === input.clientId) ?? null;
      const plannedId = planWorkoutId(plan, input.date);
      const known = current.data.workouts.some(
        (workout) => workout.id === plannedId && workout.clientId === input.clientId,
      );
      if (!plannedId || !known) {
        return {
          ok: false,
          error:
            input.kind === "move"
              ? "That date has no workout to move."
              : "That date is a rest day in the week plan.",
        };
      }
      let toDate: string | null = null;
      if (input.kind === "move") {
        if (!input.toDate || !isISODate(input.toDate)) {
          return { ok: false, error: "Choose the date to move it to." };
        }
        if (input.toDate === input.date) return { ok: false, error: "Pick a different date." };
        toDate = input.toDate;
      }
      const existing = current.data.overrides.find(
        (override) => override.clientId === input.clientId && override.date === input.date,
      );
      const next: PlanOverride = {
        id: existing?.id ?? crypto.randomUUID(),
        clientId: input.clientId,
        date: input.date,
        kind: input.kind,
        toDate,
      };
      const overrides = current.data.overrides.filter(
        (override) => !(override.clientId === input.clientId && override.date === input.date),
      );
      overrides.push(next);
      commit({ ...current, data: { ...current.data, overrides } });
      return { ok: true };
    },
    [],
  );

  const clearDateOverride = useCallback(
    (input: { clientId: string; date: string }): Result => {
      const current = getSnapshot();
      const denied = coachError(currentUser(current));
      if (denied) return { ok: false, error: denied };
      const overrides = current.data.overrides.filter(
        (override) => !(override.clientId === input.clientId && override.date === input.date),
      );
      if (overrides.length === current.data.overrides.length) {
        return { ok: false, error: "That date has no exception." };
      }
      commit({ ...current, data: { ...current.data, overrides } });
      return { ok: true };
    },
    [],
  );

  const setWeekStart = useCallback((weekStartsOn: WeekStart): Result => {
    const current = getSnapshot();
    if (!currentUser(current)) return { ok: false, error: "Sign in to change the week." };
    if (current.data.weekStartsOn === weekStartsOn) return { ok: true };
    commit({ ...current, data: { ...current.data, weekStartsOn } });
    return { ok: true };
  }, []);

  const startClientWorkout = useCallback((workoutId: string): StartWorkoutResult => {
    const current = getSnapshot();
    const user = currentUser(current);
    if (!user || user.role !== "client" || !user.clientId) {
      return { ok: false, error: "Only a client can log a session." };
    }
    const workout = current.data.workouts.find((item) => item.id === workoutId);
    if (!workout || workout.clientId !== user.clientId) {
      return { ok: false, error: "That workout is not on your sheet." };
    }
    const planned = planClientSession({
      clientId: user.clientId,
      workout,
      sessions: current.data.sessions,
      date: todayISO(),
      createId: () => crypto.randomUUID(),
    });
    if (planned.created) {
      commit({
        ...current,
        data: { ...current.data, sessions: [...current.data.sessions, planned.session] },
      });
    }
    return { ok: true, sessionId: planned.session.id };
  }, []);

  const updateClientSet = useCallback(
    (input: {
      sessionId: string;
      setId: string;
      weightKg?: number;
      reps?: number;
      done?: boolean;
      isWarmup?: boolean;
    }): Result => {
      const current = getSnapshot();
      const user = currentUser(current);
      if (!user || user.role !== "client" || !user.clientId) {
        return { ok: false, error: "Only a client can log a set." };
      }
      const session = current.data.sessions.find((item) => item.id === input.sessionId);
      if (!session || session.clientId !== user.clientId) {
        return { ok: false, error: "That session is not on your sheet." };
      }
      const patch: { weightKg?: number; reps?: number; done?: boolean; isWarmup?: boolean } = {};
      if (input.weightKg !== undefined) patch.weightKg = input.weightKg;
      if (input.reps !== undefined) patch.reps = input.reps;
      if (input.done !== undefined) patch.done = input.done;
      if (input.isWarmup !== undefined) patch.isWarmup = input.isWarmup;
      const updated = applyClientSetUpdate(
        current.data.sessions,
        input.sessionId,
        input.setId,
        patch,
        new Date().toISOString(),
      );
      if (!updated.ok) return updated;
      commit({
        ...current,
        data: { ...current.data, sessions: updated.sessions },
      });
      return { ok: true };
    },
    [],
  );

  const resetDemo = useCallback(() => {
    const current = getSnapshot();
    const seed = createSeed();
    const userId =
      current.userId && seed.users.some((person) => person.id === current.userId)
        ? current.userId
        : null;
    commit({ ready: true, sessionKnown: true, data: seed, userId });
  }, []);

  const value: StoreValue = {
    ready: current.ready,
    sessionKnown: current.sessionKnown,
    data: current.ready ? current.data : null,
    user,
    signIn,
    signOut,
    addClient,
    addMeasurement,
    setGoalWeight,
    addSession,
    assignWorkout,
    saveWorkoutProgression,
    saveWeeklyPlan,
    setDateOverride,
    clearDateOverride,
    setWeekStart,
    startClientWorkout,
    updateClientSet,
    resetDemo,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used within StoreProvider");
  return value;
}
