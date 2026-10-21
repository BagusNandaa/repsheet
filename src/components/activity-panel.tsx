"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  MONDAY,
  describeTrainingDay,
  heatmapMonthLabels,
  heatmapWeekdayLabels,
  trainingStreaks,
  yearHeatmap,
} from "@/lib/activity";

function cellId(date: string) {
  return `training-day-${date}`;
}

export function ActivityPanel({
  dates,
  today,
  id,
}: {
  dates: string[];
  today: string;
  id?: string;
}) {
  const streaks = trainingStreaks(dates, today, MONDAY);
  const heatmap = yearHeatmap(dates, today, MONDAY);
  const days = heatmap.weeks.flatMap((week) => week.days);
  const months = heatmapMonthLabels(heatmap.weeks);
  const monthAt = new Map(months.map((month) => [month.index, month.label]));
  const weekdays = heatmapWeekdayLabels(MONDAY);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayIndex = days.findIndex((day) => day.date === today);
  const [activeIndex, setActiveIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollLeft = node.scrollWidth;
  }, [heatmap.start]);

  const hovered = days.find((day) => day.date === hoverDate);
  const active = days[activeIndex] ?? days[0];
  const shown = hovered ?? active;
  const readout = shown ? describeTrainingDay(shown.date, shown.count) : "No training days to show.";
  const headingId = id ? `${id}-heading` : undefined;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.dataset.date) return;
    const index = days.findIndex((day) => day.date === target.dataset.date);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowDown") next = index + 1;
    else if (event.key === "ArrowUp") next = index - 1;
    else if (event.key === "ArrowRight") next = index + 7;
    else if (event.key === "ArrowLeft") next = index - 7;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = days.length - 1;
    else return;
    event.preventDefault();
    const bounded = Math.max(0, Math.min(days.length - 1, next));
    const day = days[bounded];
    if (!day) return;
    setHoverDate(null);
    setActiveIndex(bounded);
    document.getElementById(cellId(day.date))?.focus();
  }

  return (
    <section id={id} className="flex flex-col gap-4" aria-labelledby={headingId}>
      <h2 id={headingId} className="font-display text-2xl">
        Training
      </h2>
      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted px-3 py-2">
          <dt className="text-sm text-muted-foreground">Week streak</dt>
          <dd className="font-display text-3xl tabular-nums">{streaks.consecutiveWeeks}</dd>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <dt className="text-sm text-muted-foreground">This week</dt>
          <dd className="font-display text-3xl tabular-nums">{streaks.workoutsThisWeek}</dd>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <dt className="text-sm text-muted-foreground">Total</dt>
          <dd className="font-display text-3xl tabular-nums">{streaks.totalWorkouts}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        {streaks.workoutsThisWeek === 0 && streaks.consecutiveWeeks > 0
          ? "This week is still open. The streak holds until Sunday."
          : "Logged sessions only. Monday starts the week."}
      </p>

      {days.length === 0 ? null : (
        <div className="heatmap">
          <div
            ref={scrollRef}
            className="heatmap-scroll"
            onKeyDown={onKeyDown}
          >
            <div className="heatmap-months" aria-hidden>
              {heatmap.weeks.map((week, index) => (
                <span key={week.start}>{monthAt.get(index) ?? ""}</span>
              ))}
            </div>
            <div className="heatmap-body">
              <div className="heatmap-dow" aria-hidden>
                {weekdays.map((label, index) => (
                  <span key={`${label}-${index}`}>{label}</span>
                ))}
              </div>
              <div
                className="heatmap-grid"
                role="group"
                aria-label="Training days for the past year. Arrow keys move between days."
              >
                {days.map((day, index) => {
                  const label = describeTrainingDay(day.date, day.count);
                  return (
                    <button
                      key={day.date}
                      id={cellId(day.date)}
                      type="button"
                      className="heatmap-cell"
                      data-date={day.date}
                      data-level={day.level}
                      data-future={day.date > today ? "true" : undefined}
                      title={label}
                      tabIndex={index === activeIndex ? 0 : -1}
                      aria-current={day.date === today ? "date" : undefined}
                      onFocus={() => setActiveIndex(index)}
                      onClick={() => setActiveIndex(index)}
                      onMouseEnter={() => setHoverDate(day.date)}
                      onMouseLeave={() => setHoverDate(null)}
                    >
                      <span className="sr-only">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <p className="heatmap-readout">{readout}</p>
          <div className="heatmap-legend" aria-hidden>
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className="heatmap-cell" data-level={level} />
            ))}
            <span>More</span>
          </div>
        </div>
      )}
    </section>
  );
}
