import assert from "node:assert/strict";
import test from "node:test";
import { getWeekStripDays } from "./week-strip.ts";

test("stub week starts Monday and uses the sample statuses", () => {
  const days = getWeekStripDays(new Date(2026, 9, 21));
  assert.deepEqual(
    days.map((day) => day.date),
    ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"],
  );
  assert.deepEqual(
    days.map((day) => day.status),
    ["done", "done", "planned", "none", "planned", "none", "none"],
  );
});

test("Sunday and Monday stay in the same Monday-first week", () => {
  const monday = getWeekStripDays(new Date(2026, 9, 19));
  const sunday = getWeekStripDays(new Date(2026, 9, 25));
  assert.equal(monday[0]?.date, "2026-10-19");
  assert.equal(sunday[0]?.date, "2026-10-19");
  assert.equal(sunday[6]?.date, "2026-10-25");
});

test("the stub week can cross a year boundary", () => {
  const days = getWeekStripDays(new Date(2027, 0, 1));
  assert.equal(days[0]?.date, "2026-12-28");
  assert.equal(days[4]?.date, "2027-01-01");
  assert.equal(days[6]?.date, "2027-01-03");
  assert.equal(days.length, 7);
});
