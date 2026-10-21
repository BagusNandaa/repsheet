import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exerciseName, formatDate, formatSet } from "@/lib/format";
import type { Exercise, Session } from "@/lib/types";

export function SessionCard({
  session,
  exercises,
}: {
  session: Session;
  exercises: Exercise[];
}) {
  const title =
    session.title ||
    exerciseName(exercises, session.exercises[0]?.exerciseId ?? "") ||
    "Session";

  return (
    <Card className="text-base">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-sm">{formatDate(session.date)}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {session.exercises.map((exercise) => (
            <li key={exercise.id} className="flex items-baseline justify-between gap-3">
              <span>{exerciseName(exercises, exercise.exerciseId)}</span>
              <span className="set-readout shrink-0 text-right text-sm tabular-nums text-muted-foreground dark:inline-flex dark:flex-col dark:items-end">
                {formatSet(exercise)}
                <span className="mt-1.5 hidden gap-1 dark:flex" aria-hidden>
                  {Array.from({ length: Math.min(Math.max(exercise.sets, 0), 16) }, (_, index) => (
                    <span key={index} className="size-1.5 rounded-full bg-foreground" />
                  ))}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
