"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { BackLink, EmptyNote, FormError, actionClass } from "@/components/sheet-ui";
import { ProgressionEditor } from "@/components/progression-editor";
import { exerciseById, formatDate, formatKg } from "@/lib/format";
import { progressionSummary } from "@/lib/progression";
import { exerciseTarget, openClientSession } from "@/lib/session-plan";
import { useSheetParams } from "@/lib/use-sheet-params";
import { useStore } from "@/lib/store";
import type { Session, Workout, WorkoutMove } from "@/lib/types";

function MoveTarget({
  sessions,
  workout,
  move,
}: {
  sessions: readonly Session[];
  workout: Workout;
  move: WorkoutMove;
}) {
  const target = exerciseTarget({
    sessions,
    clientId: workout.clientId,
    workout,
    move,
  });
  if (!target.reason) return null;
  return (
    <p className="mt-1 text-sm leading-5 text-muted-foreground">
      <span className="font-medium text-foreground tabular-nums">
        Target {formatKg(target.weightKg)} × {target.reps}
      </span>
      {" · "}
      {target.reason}
    </p>
  );
}

export default function WorkoutDetailPage() {
  const { id } = useSheetParams();
  const { data, user, startClientWorkout, saveWorkoutProgression } = useStore();
  const router = useRouter();
  const [startError, setStartError] = useState<string | null>(null);
  if (!data || !user || !id) return null;

  const workout = data.workouts.find((item) => item.id === id);
  const ownsIt = user.role === "coach" || workout?.clientId === user.clientId;
  if (!workout || !ownsIt) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href={user.role === "coach" ? "/coach" : "/workouts"}>
          {user.role === "coach" ? "Clients" : "Workouts"}
        </BackLink>
        <EmptyNote>That workout is not on your sheet.</EmptyNote>
      </div>
    );
  }

  const client = data.clients.find((item) => item.id === workout.clientId);
  const backHref = user.role === "coach" ? `/coach/clients/${workout.clientId}` : "/workouts";
  const backLabel = user.role === "coach" ? (client?.name ?? "Client") : "Workouts";
  const openSession =
    user.role === "client" && user.clientId
      ? openClientSession(data.sessions, user.clientId, workout.id)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={backHref}>{backLabel}</BackLink>
      <div>
        <h1 className="font-display text-4xl tracking-tight">{workout.name}</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Assigned {formatDate(workout.assignedAt)}
          {user.role === "coach" && client ? ` · ${client.name}` : ""}
        </p>
        {user.role === "client" ? (
          <p className="mt-2 text-sm text-muted-foreground">{progressionSummary(workout.progression)}</p>
        ) : null}
      </div>
      {user.role === "coach" ? (
        <ProgressionEditor
          key={workout.id}
          workout={workout}
          sessions={data.sessions}
          exercises={data.exercises}
          onSave={saveWorkoutProgression}
        />
      ) : null}
      {user.role === "client" ? (
        <>
          <Button
            type="button"
            className={actionClass}
            onClick={() => {
              if (!openSession) {
                const result = startClientWorkout(workout.id);
                if (!result.ok) {
                  setStartError(result.error);
                  return;
                }
              }
              router.push(`/workouts/${workout.id}/session`);
            }}
          >
            {openSession ? "Continue session" : "Start session"}
          </Button>
          <FormError>{startError}</FormError>
        </>
      ) : null}
      <ol className="flex flex-col gap-8">
        {workout.moves.map((move, index) => {
          const exercise = exerciseById(data.exercises, move.exerciseId);
          return (
            <li key={move.id} className="flex flex-col gap-3">
              <div className="flex flex-col">
                <p className="text-sm text-muted-foreground">Move {index + 1}</p>
                <h2 className="font-display text-2xl">{exercise?.name ?? "Removed exercise"}</h2>
                <p className="mt-1 text-base tabular-nums">
                  {move.sets} × {move.reps}
                </p>
                {user.role === "client" ? (
                  <MoveTarget sessions={data.sessions} workout={workout} move={move} />
                ) : null}
                {exercise ? (
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{exercise.cue}</p>
                ) : null}
                <Link
                  href={
                    user.role === "coach"
                      ? `/coach/clients/${workout.clientId}/exercises/${move.exerciseId}`
                      : `/exercises/${move.exerciseId}`
                  }
                  className="mt-2 self-start text-sm font-medium text-[var(--brand-text)]"
                >
                  History
                </Link>
              </div>
              {exercise ? (
                <VideoPlayer exercise={exercise} />
              ) : (
                <EmptyNote>This move is no longer in the library.</EmptyNote>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
