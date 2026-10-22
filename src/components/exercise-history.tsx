import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyNote } from "@/components/sheet-ui";
import { exerciseName, formatDate, formatKg } from "@/lib/format";
import {
  exerciseRecords,
  formatEstimateKg,
  loggedExerciseIds,
  type ExerciseHistory,
  type RecordedSet,
} from "@/lib/records";
import type { Exercise, Session } from "@/lib/types";

function sourceLine(set: RecordedSet) {
  return `${formatKg(set.weightKg)} × ${set.reps} · ${formatDate(set.date)}`;
}

export function ExerciseHistoryView({ history }: { history: ExerciseHistory }) {
  const estimate = history.records.estimated1Rm;
  const heaviest = history.records.heaviest;
  const sameSet = estimate !== null && heaviest !== null && estimate.setId === heaviest.setId;
  const bestId = estimate?.setId ?? heaviest?.setId ?? null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Best set</h2>
        {estimate ? (
          <div>
            <p className="kicker text-sm text-muted-foreground">Estimated 1RM</p>
            <p className="font-display text-5xl tracking-tight tabular-nums">
              {formatEstimateKg(estimate.e1rmKg)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">{sourceLine(estimate)}</p>
          </div>
        ) : heaviest ? (
          <div>
            <p className="font-display text-5xl tracking-tight tabular-nums">
              {formatKg(heaviest.weightKg)} × {heaviest.reps}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(heaviest.date)}</p>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              No estimate for this exercise. Epley needs a finished set with a load and 1 to 12 reps.
            </p>
          </div>
        ) : (
          <EmptyNote>
            No working sets yet. A set counts once it is marked done. Warm-ups stay out.
          </EmptyNote>
        )}
        {estimate ? (
          <p className="text-sm leading-5 text-muted-foreground">
            Epley, weight × (1 + reps / 30). Sets over 12 reps, warm-ups, and unfinished sets are
            left out. When two sets tie, the earlier one is kept.
          </p>
        ) : null}
        {heaviest && estimate && !sameSet ? (
          <p className="text-base tabular-nums">
            Heaviest {formatKg(heaviest.weightKg)} × {heaviest.reps}
            <span className="text-muted-foreground"> · {formatDate(heaviest.date)}</span>
          </p>
        ) : null}
        {history.records.bestReps.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border">
            {history.records.bestReps.map((row) => (
              <li
                key={`${row.sessionId}-${row.setId}`}
                className="flex items-baseline justify-between gap-3 py-2 text-sm tabular-nums"
              >
                <span>
                  {formatKg(row.weightKg)} × {row.reps}
                </span>
                <span className="text-muted-foreground">{formatDate(row.date)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Recent sessions</h2>
        {history.recent.length === 0 ? (
          <EmptyNote>No sessions for this exercise yet.</EmptyNote>
        ) : (
          <ul className="flex flex-col gap-3">
            {history.recent.map((item) => (
              <li
                key={item.sessionId}
                className="rounded-xl border border-border bg-card p-4 dark:rounded-none"
              >
                <p className="font-display text-xl">{item.title || "Session"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{formatDate(item.date)}</p>
                <ul className="mt-3 flex flex-col gap-1">
                  {item.sets.map((set) => (
                    <li
                      key={set.setId}
                      className="flex items-baseline justify-between gap-3 text-sm tabular-nums"
                    >
                      <span>
                        {set.isWarmup ? "Warm-up · " : ""}
                        {set.done ? "" : "Not logged · "}
                        {formatKg(set.weightKg)} × {set.reps}
                      </span>
                      {set.setId === bestId ? (
                        <span className="text-[var(--brand-text)]">Best</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ExerciseRecordLinks({
  exercises,
  sessions,
  clientId,
  hrefFor,
}: {
  exercises: Exercise[];
  sessions: readonly Session[];
  clientId: string;
  hrefFor: (exerciseId: string) => string;
}) {
  const ids = loggedExerciseIds(sessions, clientId);
  if (ids.length === 0) {
    return (
      <EmptyNote>No working sets yet. An estimate uses a finished set of 12 reps or fewer.</EmptyNote>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 dark:rounded-none">
      {ids.map((id) => {
        const records = exerciseRecords(sessions, clientId, id);
        const estimate = records.estimated1Rm;
        const detail = estimate
          ? `${formatEstimateKg(estimate.e1rmKg)} · ${formatKg(estimate.weightKg)} × ${estimate.reps}`
          : records.heaviest
            ? `${formatKg(records.heaviest.weightKg)} × ${records.heaviest.reps}`
            : "No estimate";
        return (
          <li key={id}>
            <Link
              href={hrefFor(id)}
              className="flex min-h-16 min-w-0 items-center justify-between gap-3 px-4 py-3 active:bg-accent"
            >
              <span className="min-w-0">
                <span className="block text-base font-medium break-words">{exerciseName(exercises, id)}</span>
                <span className="block text-sm text-muted-foreground break-words tabular-nums">{detail}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
