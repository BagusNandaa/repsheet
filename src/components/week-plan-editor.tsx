"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EmptyNote, Field, FormError, actionClass, controlClass } from "@/components/sheet-ui";
import { formatDate, formatWeekday, isISODate, todayISO } from "@/lib/format";
import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  planWorkoutId,
  weekdayOrder,
  workoutIdOn,
} from "@/lib/schedule";
import { useStore } from "@/lib/store";
import type { PlanOverride, WeeklyPlan, WeekStart, Workout } from "@/lib/types";

function draftFromPlan(plan: WeeklyPlan | null) {
  const draft: Record<string, string> = {};
  for (const weekday of WEEKDAYS) draft[String(weekday)] = plan?.days[weekday] ?? "";
  return draft;
}

function describeDate(
  date: string,
  plan: WeeklyPlan | null,
  overrides: readonly PlanOverride[],
  workouts: readonly Workout[],
) {
  if (!isISODate(date) || !plan) return "Choose a date. This uses the saved week plan.";
  const known = new Set(workouts.map((workout) => workout.id));
  const plannedId = planWorkoutId(plan, date);
  const planned = workouts.find((workout) => workout.id === plannedId);
  const resolvedId = workoutIdOn(date, plan.clientId, plan, overrides, known);
  const resolved = workouts.find((workout) => workout.id === resolvedId);
  const own = [...overrides].reverse().find((override) => override.date === date);
  const label = formatDate(date);

  if (resolved && planned && resolved.id !== planned.id) {
    return `${label} shows ${resolved.name}. The week plan has ${planned.name} on ${formatWeekday(date)}.`;
  }
  if (resolved) return `${label} is ${resolved.name}.`;
  if (own?.kind === "skip" && planned) {
    return `${label} is skipped. The week plan still has ${planned.name} on ${formatWeekday(date)}s.`;
  }
  if (own?.kind === "move" && own.toDate && planned) {
    return `${planned.name} moves from ${label} to ${formatDate(own.toDate)}.`;
  }
  return `${label} is a rest day in the week plan.`;
}

export function WeekPlanEditor({
  clientId,
  clientName,
  workouts,
  plan,
  overrides,
  weekStartsOn,
}: {
  clientId: string;
  clientName: string;
  workouts: Workout[];
  plan: WeeklyPlan | null;
  overrides: PlanOverride[];
  weekStartsOn: WeekStart;
}) {
  const { saveWeeklyPlan, setDateOverride, clearDateOverride } = useStore();
  const [draft, setDraft] = useState(() => draftFromPlan(plan));
  const [date, setDate] = useState(todayISO);
  const [kind, setKind] = useState<"skip" | "move">("skip");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const choices = [...workouts].sort((a, b) => a.name.localeCompare(b.name));
  const saved = plan ?? { clientId, days: {} };

  function onSavePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const days: WeeklyPlan["days"] = {};
    for (const weekday of WEEKDAYS) {
      const workoutId = draft[String(weekday)];
      if (workoutId) days[weekday] = workoutId;
    }
    const result = saveWeeklyPlan({ clientId, days });
    if (!result.ok) {
      setNotice(null);
      setError(result.error);
      return;
    }
    setError(null);
    setNotice("Week plan saved.");
  }

  function onSaveDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = setDateOverride({
      clientId,
      date,
      kind,
      toDate: kind === "move" ? toDate : undefined,
    });
    if (!result.ok) {
      setNotice(null);
      setError(result.error);
      return;
    }
    setError(null);
    setNotice(
      kind === "move" && isISODate(toDate)
        ? `Moved ${formatDate(date)} to ${formatDate(toDate)}.`
        : `Skipped ${formatDate(date)}.`,
    );
  }

  function undo(source: string) {
    const result = clearDateOverride({ clientId, date: source });
    if (!result.ok) {
      setNotice(null);
      setError(result.error);
      return;
    }
    setError(null);
    setNotice(`Cleared ${formatDate(source)}.`);
  }

  if (workouts.length === 0) {
    return (
      <section id="plan" className="flex flex-col gap-4">
        <h2 className="font-display text-2xl">Week</h2>
        <EmptyNote>Assign a workout, then choose the days {clientName} trains.</EmptyNote>
      </section>
    );
  }

  return (
    <section id="plan" className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl">Week</h2>
        <p className="mt-2 text-base leading-6 text-muted-foreground">
          Put a workout on each training day. Skip or move one date without changing the week.
        </p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={onSavePlan} noValidate>
        {weekdayOrder(weekStartsOn).map((weekday) => {
          const value = draft[String(weekday)] ?? "";
          const known = choices.some((workout) => workout.id === value);
          return (
            <div key={weekday} className="flex flex-col gap-2">
              <label htmlFor={`week-${weekday}`} className="text-base font-medium">
                {WEEKDAY_LABELS[weekday]}
              </label>
              <select
                id={`week-${weekday}`}
                value={value}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [String(weekday)]: event.target.value }))
                }
                className={controlClass}
              >
                <option value="">Rest</option>
                {!known && value ? <option value={value}>Missing workout</option> : null}
                {choices.map((workout) => (
                  <option key={workout.id} value={workout.id}>
                    {workout.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        <Button type="submit" className={actionClass}>
          Save week plan
        </Button>
      </form>

      <form className="flex flex-col gap-4" onSubmit={onSaveDate} noValidate>
        <Field label="One date" htmlFor="plan-date" hint={describeDate(date, saved, overrides, workouts)}>
          <input
            id="plan-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={controlClass}
          />
        </Field>
        <Field label="What happens" htmlFor="plan-kind">
          <select
            id="plan-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value === "move" ? "move" : "skip")}
            className={controlClass}
          >
            <option value="skip">Skip this date</option>
            <option value="move">Move to another date</option>
          </select>
        </Field>
        {kind === "move" ? (
          <Field label="Move it to" htmlFor="plan-to">
            <input
              id="plan-to"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className={controlClass}
            />
          </Field>
        ) : null}
        <Button type="submit" variant="outline" className={actionClass}>
          {kind === "move" ? "Move this date" : "Skip this date"}
        </Button>
      </form>

      {overrides.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {[...overrides]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((override) => (
              <li
                key={override.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2"
              >
                <span className="text-sm leading-5">
                  {override.kind === "move" && override.toDate
                    ? `Move ${formatDate(override.date)} to ${formatDate(override.toDate)}`
                    : `Skip ${formatDate(override.date)}`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 shrink-0"
                  onClick={() => undo(override.date)}
                >
                  Undo
                </Button>
              </li>
            ))}
        </ul>
      ) : null}

      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      <FormError>{error}</FormError>
    </section>
  );
}
