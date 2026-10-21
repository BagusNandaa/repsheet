"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackLink, FormError, actionClass } from "@/components/sheet-ui";
import { exerciseById, formatDate, formatKg } from "@/lib/format";
import { exerciseRecords, formatEstimateKg, personalRecordFlags, type PrFlag } from "@/lib/records";
import {
  DEFAULT_REST_MS,
  REST_STEP_MS,
  REST_STORAGE_KEY,
  adjustRest,
  formatRestClock,
  pauseRest,
  readRestTimer,
  remainingMs,
  resumeRest,
  skipRest,
  startRest,
  writeRestTimer,
  type RestTimer,
} from "@/lib/rest-timer";
import {
  exerciseTarget,
  firstOpenExerciseIndex,
  formatWeightInput,
  lastExercisePrescription,
  parseLoggedReps,
  parseLoggedWeight,
  sessionProgress,
  stepReps,
  stepWeight,
} from "@/lib/session-plan";
import type { Exercise, Result, Session, SessionSet, Workout } from "@/lib/types";
import { cn } from "cn";

let clockNow = 0;

function subscribeClock(listener: () => void) {
  const tick = () => {
    clockNow = Date.now();
    listener();
  };
  clockNow = Date.now();
  const id = window.setInterval(tick, 250);
  document.addEventListener("visibilitychange", tick);
  window.addEventListener("pageshow", tick);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", tick);
    window.removeEventListener("pageshow", tick);
  };
}

function getClockSnapshot() {
  return clockNow;
}

let cachedRestRaw: string | null | undefined;
let cachedRest: RestTimer | null = null;

function subscribeRest(listener: () => void) {
  const onLocal = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== REST_STORAGE_KEY) return;
    cachedRestRaw = undefined;
    listener();
  };
  window.addEventListener("repsheet-rest", onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("repsheet-rest", onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

function getRestSnapshot() {
  const raw = localStorage.getItem(REST_STORAGE_KEY);
  if (raw === cachedRestRaw) return cachedRest;
  cachedRestRaw = raw;
  cachedRest = readRestTimer(localStorage);
  return cachedRest;
}

function publishRest(timer: RestTimer | null, now?: number) {
  // The display clock otherwise lags the click by up to one tick, and the
  // countdown rounds that extra fraction up to another second.
  if (now !== undefined) clockNow = now;
  writeRestTimer(localStorage, timer);
  cachedRestRaw = localStorage.getItem(REST_STORAGE_KEY);
  cachedRest = timer;
  window.dispatchEvent(new Event("repsheet-rest"));
}

function Stepper({
  id,
  label,
  value,
  suffix,
  onChange,
  onBlur,
  onStep,
  decreaseLabel,
  increaseLabel,
}: {
  id: string;
  label: string;
  value: string;
  suffix?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onStep: (direction: -1 | 1) => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-12 shrink-0 text-lg"
          aria-label={decreaseLabel}
          onClick={() => onStep(-1)}
        >
          −
        </Button>
        <Input
          id={id}
          inputMode={suffix ? "decimal" : "numeric"}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          className="h-12 bg-card text-center text-base tabular-nums"
          aria-describedby={suffix ? `${id}-suffix` : undefined}
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 w-12 shrink-0 text-lg"
          aria-label={increaseLabel}
          onClick={() => onStep(1)}
        >
          +
        </Button>
      </div>
      {suffix ? (
        <p id={`${id}-suffix`} className="text-sm text-muted-foreground">
          {suffix}
        </p>
      ) : null}
    </div>
  );
}

function SetRow({
  set,
  index,
  sessionId,
  flags,
  onUpdate,
}: {
  set: SessionSet;
  index: number;
  sessionId: string;
  flags: PrFlag[];
  onUpdate: (patch: { weightKg?: number; reps?: number; done?: boolean; isWarmup?: boolean }) => Result;
}) {
  const [weightText, setWeightText] = useState<string | null>(null);
  const [repsText, setRepsText] = useState<string | null>(null);
  const weightShown = weightText ?? formatWeightInput(set.weightKg);
  const repsShown = repsText ?? String(set.reps);
  const weightValue = parseLoggedWeight(weightShown);
  const setLabel = `set ${index + 1}`;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 dark:rounded-none">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-xl">
          Set {index + 1}
          {set.isWarmup ? " · Warm-up" : ""}
        </p>
        <p className={cn("text-sm", set.done ? "text-[var(--brand-text)]" : "text-muted-foreground")}>
          {set.done ? "Done" : "Not logged"}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={set.isWarmup}
        className={cn(
          "self-start",
          set.isWarmup && "border-transparent bg-[var(--brand-soft)] text-[var(--brand-text)]",
        )}
        onClick={() => onUpdate({ isWarmup: !set.isWarmup })}
      >
        {set.isWarmup ? "Warm-up" : "Mark warm-up"}
      </Button>
      {flags.length > 0 ? (
        <p className="text-sm font-medium text-[var(--brand-text)]" role="status">
          PR · {flags.map((flag) => flag.label).join(" · ")}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stepper
          id={`weight-${set.id}`}
          label="Weight"
          suffix={weightValue === 0 ? "kg · bodyweight" : "kg"}
          value={weightShown}
          decreaseLabel={`Decrease weight for ${setLabel}`}
          increaseLabel={`Increase weight for ${setLabel}`}
          onChange={(value) => {
            setWeightText(value);
            const parsed = parseLoggedWeight(value);
            if (parsed !== null && parsed !== set.weightKg) onUpdate({ weightKg: parsed });
          }}
          onBlur={() => setWeightText(null)}
          onStep={(direction) => {
            setWeightText(null);
            onUpdate({ weightKg: stepWeight(set.weightKg, direction) });
          }}
        />
        <Stepper
          id={`reps-${set.id}`}
          label="Reps"
          value={repsShown}
          decreaseLabel={`Decrease reps for ${setLabel}`}
          increaseLabel={`Increase reps for ${setLabel}`}
          onChange={(value) => {
            setRepsText(value);
            const parsed = parseLoggedReps(value);
            if (parsed !== null && parsed !== set.reps) onUpdate({ reps: parsed });
          }}
          onBlur={() => setRepsText(null)}
          onStep={(direction) => {
            setRepsText(null);
            onUpdate({ reps: stepReps(set.reps, direction) });
          }}
        />
      </div>
      <Button
        type="button"
        variant={set.done ? "outline" : "default"}
        className={actionClass}
        onClick={() => {
          const nextDone = !set.done;
          const result = onUpdate({ done: nextDone });
          if (!result.ok) return;
          if (nextDone) {
            const now = Date.now();
            publishRest(startRest(now, DEFAULT_REST_MS, sessionId, set.id), now);
            return;
          }
          if (getRestSnapshot()?.setId === set.id) publishRest(skipRest());
        }}
      >
        {set.done ? "Undo set" : "Mark done"}
      </Button>
    </li>
  );
}

function RestTimerPanel({
  timer,
  now,
}: {
  timer: RestTimer;
  now: number;
}) {
  const remaining = now === 0 ? null : remainingMs(timer, now);
  const clock = remaining === null ? "–:–" : formatRestClock(remaining);
  const paused = timer.status === "paused";
  const finished = remaining === 0;
  const status = paused ? "Paused" : finished ? "Rest done" : "Resting";

  return (
    <section
      role="timer"
      aria-label={remaining === null ? "Rest" : `Rest ${clock}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 dark:rounded-none"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="kicker text-sm font-medium text-muted-foreground">Rest</h2>
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
      <p className="font-display text-6xl tabular-nums tracking-tight" aria-hidden>
        {clock}
      </p>
      <p className="sr-only" aria-live="polite">
        {paused ? `Rest paused at ${clock}` : finished ? "Rest done" : "Rest running"}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={() => {
            const now = Date.now();
            publishRest(adjustRest(timer, -REST_STEP_MS, now), now);
          }}
        >
          −15s
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-12"
          onClick={() => {
            const now = Date.now();
            publishRest(paused ? resumeRest(timer, now) : pauseRest(timer, now), now);
          }}
        >
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={() => {
            const now = Date.now();
            publishRest(adjustRest(timer, REST_STEP_MS, now), now);
          }}
        >
          +15s
        </Button>
      </div>
      <Button type="button" variant="ghost" className="h-12" onClick={() => publishRest(skipRest())}>
        {finished ? "Continue" : "Skip"}
      </Button>
    </section>
  );
}

export function ClientSessionScreen({
  session,
  workout,
  workoutName,
  clientId,
  exercises,
  history,
  error,
  onUpdateSet,
}: {
  session: Session;
  workout: Workout;
  workoutName: string;
  clientId: string;
  exercises: Exercise[];
  history: readonly Session[];
  error: string | null;
  onUpdateSet: (input: {
    setId: string;
    weightKg?: number;
    reps?: number;
    done?: boolean;
    isWarmup?: boolean;
  }) => Result;
}) {
  const now = useSyncExternalStore(subscribeClock, getClockSnapshot, () => 0);
  const storedTimer = useSyncExternalStore(subscribeRest, getRestSnapshot, () => null);
  const [exerciseIndex, setExerciseIndex] = useState(() => firstOpenExerciseIndex(session));
  const timerRef = useRef<HTMLDivElement>(null);
  const timer = storedTimer && storedTimer.sessionId === session.id ? storedTimer : null;
  const progress = sessionProgress(session);
  const exerciseCount = session.exercises.length;
  const safeIndex = exerciseCount === 0 ? 0 : Math.min(exerciseIndex, exerciseCount - 1);
  const exercise = session.exercises[safeIndex];
  const libraryExercise = exercise ? exerciseById(exercises, exercise.exerciseId) : undefined;
  const priorSessions = history.filter((item) => item.id !== session.id);
  const move = exercise
    ? (workout.moves.find((item) => item.exerciseId === exercise.exerciseId) ?? null)
    : null;
  const prior = exercise
    ? lastExercisePrescription(priorSessions, clientId, exercise.exerciseId)
    : null;
  const target =
    exercise && move
      ? exerciseTarget({
          sessions: priorSessions,
          clientId,
          workout,
          move,
        })
      : null;
  const records = exercise
    ? exerciseRecords(history, clientId, exercise.exerciseId)
    : null;
  const complete = progress.total > 0 && progress.done === progress.total;
  const fraction = progress.total === 0 ? 0 : (progress.done / progress.total) * 100;
  const backHref = session.workoutId ? `/workouts/${session.workoutId}` : "/workouts";

  useEffect(() => {
    if (!storedTimer || storedTimer.sessionId !== session.id) return;
    const logged = session.exercises.some((item) =>
      item.sets.some((set) => set.id === storedTimer.setId && set.done),
    );
    if (!logged) publishRest(null);
  }, [storedTimer, session]);

  useEffect(() => {
    timerRef.current?.scrollIntoView({ block: "nearest" });
  }, [timer?.setId]);

  return (
    <div className="flex flex-col">
      <header
        className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 pb-3 backdrop-blur-sm dark:-mx-6 dark:bg-background dark:px-6 dark:backdrop-blur-none"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <BackLink href={backHref}>{workoutName}</BackLink>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h1 className="font-display text-3xl tracking-tight">
            {libraryExercise?.name ?? "Removed exercise"}
          </h1>
          <p className="shrink-0 pb-1 font-display text-sm tabular-nums text-muted-foreground">
            {progress.done}/{progress.total}
          </p>
        </div>
        <p className="kicker mt-1 text-sm text-muted-foreground">
          Exercise {exerciseCount === 0 ? 0 : safeIndex + 1} of {exerciseCount}
          {complete ? " · Session complete" : ""}
        </p>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted dark:rounded-none"
          role="progressbar"
          aria-valuenow={progress.done}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-label="Session progress"
        >
          <div className="h-full bg-[var(--brand-text)]" style={{ width: `${fraction}%` }} />
        </div>
      </header>

      <div className="flex flex-col gap-5 py-5">
        {timer ? (
          <div ref={timerRef}>
            <RestTimerPanel timer={timer} now={now} />
          </div>
        ) : null}
        <FormError>{error}</FormError>
        {exercise ? (
          <>
            {target?.reason ? (
              <div className="rounded-xl border border-border bg-card px-4 py-3 dark:rounded-none">
                <p className="text-sm font-medium tabular-nums">
                  Target {formatKg(target.weightKg)} × {target.reps}
                </p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{target.reason}</p>
              </div>
            ) : (
              <p className="text-sm leading-5 text-muted-foreground">
                {prior
                  ? "Weight and reps from your last session. Change them if today is different."
                  : "No earlier session for this move. Weight and reps start from the workout target."}
              </p>
            )}
            {libraryExercise ? (
              <p className="text-sm leading-5 text-muted-foreground">{libraryExercise.cue}</p>
            ) : null}
            {records?.estimated1Rm ? (
              <p className="text-sm text-muted-foreground tabular-nums">
                Estimated 1RM {formatEstimateKg(records.estimated1Rm.e1rmKg)} from{" "}
                {formatKg(records.estimated1Rm.weightKg)} × {records.estimated1Rm.reps} on{" "}
                {formatDate(records.estimated1Rm.date)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No estimated 1RM yet.</p>
            )}
            <Link
              href={`/exercises/${exercise.exerciseId}`}
              className="self-start text-sm font-medium text-[var(--brand-text)]"
            >
              History
            </Link>
            <ol className="flex flex-col gap-3">
              {exercise.sets.map((set, index) => (
                <SetRow
                  key={set.id}
                  set={set}
                  index={index}
                  sessionId={session.id}
                  flags={personalRecordFlags({
                    sessions: history,
                    clientId,
                    exerciseId: exercise.exerciseId,
                    sessionId: session.id,
                    setId: set.id,
                  })}
                  onUpdate={(patch) => onUpdateSet({ setId: set.id, ...patch })}
                />
              ))}
            </ol>
          </>
        ) : (
          <p className="text-base text-muted-foreground">This workout has no moves.</p>
        )}
        {exerciseCount > 1 ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12"
              disabled={safeIndex === 0}
              onClick={() => setExerciseIndex(safeIndex - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              disabled={safeIndex >= exerciseCount - 1}
              onClick={() => setExerciseIndex(safeIndex + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
        {complete ? (
          <Link href="/home" className={cn(buttonVariants(), actionClass)}>
            Back to home
          </Link>
        ) : null}
      </div>
    </div>
  );
}
