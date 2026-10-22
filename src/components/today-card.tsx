import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { actionClass } from "@/components/sheet-ui";
import { formatDate, formatWeekday } from "@/lib/format";
import type { TrainingAgenda } from "@/lib/schedule";
import type { Workout } from "@/lib/types";
import { cn } from "cn";

function spoken(iso: string) {
  return `${formatWeekday(iso)}, ${formatDate(iso)}`;
}

export function TodayCard({
  agenda,
  workout,
  nextWorkout,
  inProgress,
}: {
  agenda: TrainingAgenda;
  workout: Workout | null;
  nextWorkout: Workout | null;
  inProgress: boolean;
}) {
  const moves = workout ? `${workout.moves.length} ${workout.moves.length === 1 ? "move" : "moves"}` : null;

  return (
    <section
      aria-labelledby="today-heading"
      className="rounded-xl border border-border bg-card px-4 py-4 dark:rounded-none dark:bg-transparent dark:px-4 dark:py-5"
    >
      <h2
        id="today-heading"
        className="text-sm font-medium text-muted-foreground dark:text-[0.6875rem] dark:font-normal dark:tracking-[0.18em]"
      >
        Today
      </h2>
      <p className="mt-3 font-display text-3xl tracking-tight break-words">
        {workout ? workout.name : "Rest day"}
      </p>
      {workout ? (
        <>
          <p className="mt-2 text-base leading-6 text-muted-foreground">
            {spoken(agenda.today)} · {moves}
          </p>
          <Link
            href={`/workouts/${workout.id}/session`}
            className={cn(buttonVariants(), actionClass, "mt-4")}
          >
            {inProgress ? "Continue" : "Start"}
          </Link>
        </>
      ) : (
        <p className="mt-2 text-base leading-6 text-muted-foreground">
          {spoken(agenda.today)}
          {agenda.next && nextWorkout
            ? `. Next training day is ${formatWeekday(agenda.next.date)}, ${formatDate(agenda.next.date)}. `
            : ". Nothing else is planned."}
          {agenda.next && nextWorkout ? (
            <span className="text-foreground">{nextWorkout.name}.</span>
          ) : null}
        </p>
      )}
    </section>
  );
}
