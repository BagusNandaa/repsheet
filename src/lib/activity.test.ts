import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HEATMAP_WEEKS,
  bucketTrainingDays,
  describeTrainingDay,
  heatmapLevel,
  heatmapMonthLabels,
  trainingStreaks,
  yearHeatmap,
} from "./activity";

function weekContaining(today: string, date: string) {
  return yearHeatmap([], today).weeks.find((week) => week.days.some((day) => day.date === date));
}

test("empty and invalid dates produce zero streaks and a blank year", () => {
  assert.deepEqual(trainingStreaks([], "2026-10-21"), {
    consecutiveWeeks: 0,
    workoutsThisWeek: 0,
    totalWorkouts: 0,
  });
  assert.equal(bucketTrainingDays(["", "2026-02-31", "2026-10-21T00:00:00.000Z", "nope"]).size, 0);
  assert.deepEqual(trainingStreaks(["", "2026-02-31", "nope"], "2026-10-21"), {
    consecutiveWeeks: 0,
    workoutsThisWeek: 0,
    totalWorkouts: 0,
  });
  assert.deepEqual(trainingStreaks(["2026-10-21"], "not-a-date"), {
    consecutiveWeeks: 0,
    workoutsThisWeek: 0,
    totalWorkouts: 0,
  });

  const blank = yearHeatmap([], "2026-10-21");
  assert.equal(blank.weeks.length, HEATMAP_WEEKS);
  assert.equal(
    blank.weeks.every((week) => week.days.every((day) => day.count === 0 && day.level === 0)),
    true,
  );
  assert.equal(blank.weeks[0]?.days.length, 7);
  assert.equal(yearHeatmap(["2026-10-21"], "").weeks.length, 0);
  assert.equal(heatmapLevel(0), 0);
  assert.equal(heatmapLevel(3), 3);
  assert.equal(heatmapLevel(9), 4);
});

test("Monday is the week boundary, including across a year", () => {
  assert.deepEqual(trainingStreaks(["2026-10-18"], "2026-10-21"), {
    consecutiveWeeks: 1,
    workoutsThisWeek: 0,
    totalWorkouts: 1,
  });
  assert.deepEqual(trainingStreaks(["2026-10-19"], "2026-10-21"), {
    consecutiveWeeks: 1,
    workoutsThisWeek: 1,
    totalWorkouts: 1,
  });
  assert.deepEqual(trainingStreaks(["2026-10-18", "2026-10-19"], "2026-10-21"), {
    consecutiveWeeks: 2,
    workoutsThisWeek: 1,
    totalWorkouts: 2,
  });
  assert.deepEqual(trainingStreaks(["2025-12-28", "2026-01-01"], "2026-01-01"), {
    consecutiveWeeks: 2,
    workoutsThisWeek: 1,
    totalWorkouts: 2,
  });

  const heatmap = yearHeatmap([], "2026-10-21");
  assert.equal(heatmap.weeks.at(-1)?.start, "2026-10-19");
  assert.equal(heatmap.end, "2026-10-25");
  for (const week of heatmap.weeks) {
    const [year, month, day] = week.start.split("-").map(Number);
    assert.equal(new Date(year, month - 1, day).getDay(), 1);
  }
  const yearWeek = weekContaining("2026-01-04", "2026-01-01");
  assert.deepEqual(yearWeek?.days.map((day) => day.date), [
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
  ]);
});

test("a gap ends the streak, and an open current week does not", () => {
  assert.deepEqual(trainingStreaks(["2026-09-28", "2026-10-05", "2026-10-19"], "2026-10-21"), {
    consecutiveWeeks: 1,
    workoutsThisWeek: 1,
    totalWorkouts: 3,
  });
  assert.deepEqual(trainingStreaks(["2026-10-05"], "2026-10-21"), {
    consecutiveWeeks: 0,
    workoutsThisWeek: 0,
    totalWorkouts: 1,
  });
  assert.deepEqual(
    trainingStreaks(["2026-09-23", "2026-09-30", "2026-10-06", "2026-10-13", "2026-10-20"], "2026-10-21"),
    {
      consecutiveWeeks: 5,
      workoutsThisWeek: 1,
      totalWorkouts: 5,
    },
  );
});

test("Sunday week start is available when a caller passes it", () => {
  assert.deepEqual(trainingStreaks(["2026-10-18"], "2026-10-21", 0), {
    consecutiveWeeks: 1,
    workoutsThisWeek: 1,
    totalWorkouts: 1,
  });
  const sundayWeek = yearHeatmap(["2026-10-18"], "2026-10-21", 0).weeks.at(-1);
  assert.equal(sundayWeek?.start, "2026-10-18");
  assert.equal(sundayWeek?.days[0]?.count, 1);
  assert.equal(sundayWeek?.days[3]?.date, "2026-10-21");
});

test("heatmap weeks keep local calendar days across daylight-saving boundaries", () => {
  const heatmap = yearHeatmap(["2026-03-08", "2026-03-08", "2026-03-09", "2026-11-01"], "2026-11-02");

  const spring = heatmap.weeks.find((week) => week.start === "2026-03-02");
  assert.deepEqual(spring?.days.map((day) => day.date), [
    "2026-03-02",
    "2026-03-03",
    "2026-03-04",
    "2026-03-05",
    "2026-03-06",
    "2026-03-07",
    "2026-03-08",
  ]);
  assert.equal(spring?.days[6]?.count, 2);
  assert.equal(spring?.days[6]?.level, 2);

  const afterSpring = heatmap.weeks.find((week) => week.start === "2026-03-09");
  assert.equal(afterSpring?.days[0]?.date, "2026-03-09");
  assert.equal(afterSpring?.days[0]?.count, 1);
  assert.equal(afterSpring?.days[0]?.level, 1);

  const fall = heatmap.weeks.find((week) => week.start === "2026-10-26");
  assert.deepEqual(fall?.days.map((day) => day.date), [
    "2026-10-26",
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
  ]);
  assert.equal(fall?.days[6]?.count, 1);

  const monthEnd = heatmap.weeks.find((week) => week.start === "2026-02-23");
  assert.deepEqual(monthEnd?.days.map((day) => day.date), [
    "2026-02-23",
    "2026-02-24",
    "2026-02-25",
    "2026-02-26",
    "2026-02-27",
    "2026-02-28",
    "2026-03-01",
  ]);

  const streaks = trainingStreaks(["2026-03-08", "2026-03-09"], "2026-03-11");
  assert.deepEqual(streaks, { consecutiveWeeks: 2, workoutsThisWeek: 1, totalWorkouts: 2 });
});

test("same-day sessions add up, and dates outside the year stay in the total only", () => {
  const streaks = trainingStreaks(["2026-10-21", "2026-10-21", "2024-01-02"], "2026-10-21");
  assert.deepEqual(streaks, { consecutiveWeeks: 1, workoutsThisWeek: 2, totalWorkouts: 3 });

  const heatmap = yearHeatmap(["2026-10-21", "2026-10-21", "2024-01-02"], "2026-10-21");
  const today = heatmap.weeks.flatMap((week) => week.days).find((day) => day.date === "2026-10-21");
  assert.equal(today?.count, 2);
  assert.equal(today?.level, 2);
  assert.equal(
    heatmap.weeks.some((week) => week.days.some((day) => day.date === "2024-01-02")),
    false,
  );
  assert.equal(describeTrainingDay("2026-10-21", 2), "Wednesday, 21 October 2026, 2 workouts");
  assert.equal(describeTrainingDay("2026-10-21", 1), "Wednesday, 21 October 2026, 1 workout");
  assert.equal(describeTrainingDay("2026-10-21", 0), "Wednesday, 21 October 2026, 0 workouts");
  assert.equal(describeTrainingDay("nope", 0), "Unknown day, 0 workouts");

  const labels = heatmapMonthLabels(heatmap.weeks);
  assert.ok(labels.some((label) => label.label === "Jan"));
  assert.ok(labels.some((label) => label.label === "Oct"));
  assert.deepEqual(
    labels.map((label) => label.index),
    [...labels.map((label) => label.index)].sort((a, b) => a - b),
  );
});
