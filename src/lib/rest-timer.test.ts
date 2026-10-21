import assert from "node:assert/strict";
import { test } from "node:test";
import type { SheetStorage } from "./migrate";
import {
  DEFAULT_REST_MS,
  REST_STEP_MS,
  REST_STORAGE_KEY,
  adjustRest,
  formatRestClock,
  pauseRest,
  readRestTimer,
  remainingMs,
  restoreRestTimer,
  resumeRest,
  skipRest,
  startRest,
  writeRestTimer,
} from "./rest-timer";

function memoryStorage() {
  const items = new Map<string, string>();
  const storage: SheetStorage = {
    getItem(key) {
      return items.get(key) ?? null;
    },
    setItem(key, value) {
      items.set(key, value);
    },
    removeItem(key) {
      items.delete(key);
    },
  };
  return storage;
}

const T0 = 1_700_000_000_000;

test("remaining time follows the wall clock", () => {
  const timer = startRest(T0, DEFAULT_REST_MS, "session-1", "set-1");
  assert.equal(timer.endsAt, T0 + DEFAULT_REST_MS);
  assert.equal(timer.status, "running");
  assert.equal(remainingMs(timer, T0), DEFAULT_REST_MS);
  assert.equal(remainingMs(timer, T0 + 10_000), DEFAULT_REST_MS - 10_000);
  assert.equal(remainingMs(timer, T0 + DEFAULT_REST_MS + 5_000), 0);
});

test("pause freezes remaining time across a gap, then resume continues", () => {
  const running = startRest(T0, DEFAULT_REST_MS, "session-1", "set-1");
  const pausedAt = T0 + 10_000;
  const paused = pauseRest(running, pausedAt);
  assert.equal(paused.status, "paused");
  assert.equal(paused.endsAt, null);
  assert.equal(paused.remainingMs, DEFAULT_REST_MS - 10_000);
  assert.equal(remainingMs(paused, pausedAt + 60_000), DEFAULT_REST_MS - 10_000);
  assert.equal(pauseRest(paused, pausedAt + 60_000), paused);

  const resumedAt = pausedAt + 60_000;
  const resumed = resumeRest(paused, resumedAt);
  assert.equal(resumed.status, "running");
  assert.equal(resumed.remainingMs, null);
  assert.equal(resumed.endsAt, resumedAt + (DEFAULT_REST_MS - 10_000));
  assert.equal(remainingMs(resumed, resumedAt + 5_000), DEFAULT_REST_MS - 15_000);
  assert.equal(resumeRest(resumed, resumedAt), resumed);
});

test("plus and minus fifteen seconds move the end time", () => {
  const running = startRest(T0, DEFAULT_REST_MS, "session-1", "set-1");
  const now = T0 + 20_000;
  const longer = adjustRest(running, REST_STEP_MS, now);
  assert.equal(remainingMs(longer, now), DEFAULT_REST_MS - 20_000 + REST_STEP_MS);
  const shorter = adjustRest(longer, -REST_STEP_MS, now);
  assert.equal(remainingMs(shorter, now), DEFAULT_REST_MS - 20_000);
  const floored = adjustRest(shorter, -1_000_000, now);
  assert.equal(remainingMs(floored, now), 0);

  const expired = startRest(T0, 1_000, "session-1", "set-1");
  const later = T0 + 30_000;
  const extended = adjustRest(expired, REST_STEP_MS, later);
  assert.equal(remainingMs(extended, later), REST_STEP_MS);
});

test("adjusting a paused timer changes the frozen remaining time", () => {
  const paused = pauseRest(startRest(T0, DEFAULT_REST_MS, "session-1", "set-1"), T0 + 5_000);
  const now = T0 + 80_000;
  const shorter = adjustRest(paused, -REST_STEP_MS, now);
  assert.equal(shorter.status, "paused");
  assert.equal(shorter.endsAt, null);
  assert.equal(remainingMs(shorter, now), DEFAULT_REST_MS - 5_000 - REST_STEP_MS);
  const cleared = adjustRest(shorter, -1_000_000, now);
  assert.equal(remainingMs(cleared, now), 0);
});

test("skip drops the timer and a reload of a running timer keeps the end time", () => {
  const storage = memoryStorage();
  const started = startRest(T0, DEFAULT_REST_MS, "session-1", "set-1");
  writeRestTimer(storage, started);
  const restored = restoreRestTimer(storage);
  assert.ok(restored);
  assert.equal(restored.endsAt, started.endsAt);
  assert.equal(remainingMs(restored, T0 + 25_000), DEFAULT_REST_MS - 25_000);

  writeRestTimer(storage, skipRest());
  assert.equal(storage.getItem(REST_STORAGE_KEY), null);
  assert.equal(restoreRestTimer(storage), null);
});

test("reload restores a paused timer without charging the time the tab was asleep", () => {
  const storage = memoryStorage();
  const paused = pauseRest(startRest(T0, DEFAULT_REST_MS, "session-1", "set-1"), T0 + 12_000);
  const adjusted = adjustRest(paused, REST_STEP_MS, T0 + 90_000);
  writeRestTimer(storage, adjusted);
  const restored = restoreRestTimer(storage);
  assert.ok(restored);
  assert.equal(restored.status, "paused");
  assert.equal(remainingMs(restored, T0 + 200_000), DEFAULT_REST_MS - 12_000 + REST_STEP_MS);
});

test("a reload after the rest has already ended shows zero", () => {
  const storage = memoryStorage();
  writeRestTimer(storage, startRest(T0, DEFAULT_REST_MS, "session-1", "set-1"));
  const restored = readRestTimer(storage);
  assert.ok(restored);
  assert.equal(remainingMs(restored, T0 + DEFAULT_REST_MS + 60_000), 0);
});

test("malformed timer storage is ignored", () => {
  const storage = memoryStorage();
  storage.setItem(REST_STORAGE_KEY, "{");
  assert.equal(readRestTimer(storage), null);
  storage.setItem(REST_STORAGE_KEY, JSON.stringify({ status: "running" }));
  assert.equal(readRestTimer(storage), null);
  storage.setItem(REST_STORAGE_KEY, JSON.stringify({ status: "done", endsAt: 1, remainingMs: null, sessionId: "s", setId: "t" }));
  assert.equal(readRestTimer(storage), null);
});

test("the clock label rounds a partial second up", () => {
  assert.equal(formatRestClock(DEFAULT_REST_MS), "1:30");
  assert.equal(formatRestClock(89_001), "1:30");
  assert.equal(formatRestClock(89_000), "1:29");
  assert.equal(formatRestClock(1), "0:01");
  assert.equal(formatRestClock(0), "0:00");
  assert.equal(formatRestClock(125_000), "2:05");
});
