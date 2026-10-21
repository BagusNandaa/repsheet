import type { SheetStorage } from "./migrate";

/** Rest used when the assigned workout does not name one. */
export const DEFAULT_REST_MS = 90_000;

export const REST_STEP_MS = 15_000;

/**
 * Beside the sheet, not inside a session row. Task 1's Session type has no
 * timer field. The end time is absolute so a sleeping tab or a reload keeps
 * the right remaining time. A pause stores the remaining milliseconds instead.
 */
export const REST_STORAGE_KEY = "repsheet.rest";

export type RestTimer = {
  sessionId: string;
  setId: string;
  status: "running" | "paused";
  /** Epoch milliseconds when the rest ends. Null while paused. */
  endsAt: number | null;
  /** Frozen remaining time while paused. Null while running. */
  remainingMs: number | null;
};

function clampMs(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function remainingMs(timer: RestTimer, now: number) {
  if (timer.status === "paused") return clampMs(timer.remainingMs ?? 0);
  if (timer.endsAt === null || !Number.isFinite(now)) return 0;
  return clampMs(timer.endsAt - now);
}

export function startRest(
  now: number,
  durationMs: number,
  sessionId: string,
  setId: string,
): RestTimer {
  const duration = clampMs(durationMs);
  return {
    sessionId,
    setId,
    status: "running",
    endsAt: now + duration,
    remainingMs: null,
  };
}

export function pauseRest(timer: RestTimer, now: number): RestTimer {
  if (timer.status === "paused") return timer;
  return {
    ...timer,
    status: "paused",
    remainingMs: remainingMs(timer, now),
    endsAt: null,
  };
}

export function resumeRest(timer: RestTimer, now: number): RestTimer {
  if (timer.status === "running") return timer;
  const remaining = clampMs(timer.remainingMs ?? 0);
  return {
    ...timer,
    status: "running",
    endsAt: now + remaining,
    remainingMs: null,
  };
}

/**
 * Add or remove time from whatever is left at `now`.
 * The new end is absolute. A paused timer keeps its frozen remaining time.
 */
export function adjustRest(timer: RestTimer, deltaMs: number, now: number): RestTimer {
  if (!Number.isFinite(deltaMs)) return timer;
  if (timer.status === "paused") {
    return { ...timer, remainingMs: clampMs((timer.remainingMs ?? 0) + deltaMs) };
  }
  const remaining = remainingMs(timer, now) + deltaMs;
  return {
    ...timer,
    endsAt: now + clampMs(remaining),
    remainingMs: null,
  };
}

export function skipRest(): null {
  return null;
}

function isRestTimer(value: unknown): value is RestTimer {
  if (typeof value !== "object" || value === null) return false;
  const timer = value as Record<string, unknown>;
  const statusOk = timer.status === "running" || timer.status === "paused";
  const endsOk = typeof timer.endsAt === "number" || timer.endsAt === null;
  const remainingOk = typeof timer.remainingMs === "number" || timer.remainingMs === null;
  return (
    statusOk &&
    endsOk &&
    remainingOk &&
    typeof timer.sessionId === "string" &&
    timer.sessionId.length > 0 &&
    typeof timer.setId === "string" &&
    timer.setId.length > 0
  );
}

export function writeRestTimer(storage: SheetStorage, timer: RestTimer | null) {
  if (!timer) {
    storage.removeItem(REST_STORAGE_KEY);
    return;
  }
  storage.setItem(REST_STORAGE_KEY, JSON.stringify(timer));
}

export function readRestTimer(storage: SheetStorage): RestTimer | null {
  const raw = storage.getItem(REST_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRestTimer(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Reload path. Returns the stored record unchanged. Remaining time is
 * `remainingMs(timer, now)` with the clock after the reload, so time asleep
 * counts while the timer was running and does not count while it was paused.
 */
export function restoreRestTimer(storage: SheetStorage): RestTimer | null {
  return readRestTimer(storage);
}

/** Countdown label. A partial second still shows, so 90_000 ms is 1:30. */
export function formatRestClock(ms: number) {
  const safe = clampMs(ms);
  const totalSeconds = Math.ceil(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
