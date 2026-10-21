"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { BackLink, EmptyNote, FormError, actionClass } from "@/components/sheet-ui";
import { exerciseById, formatDate } from "@/lib/format";
import { openClientSession } from "@/lib/session-plan";
import { useStore } from "@/lib/store";

export default function WorkoutDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, user, startClientWorkout } = useStore();
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
      </div>
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
