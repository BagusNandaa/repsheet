"use client";

import { useParams } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import { BackLink, EmptyNote } from "@/components/sheet-ui";
import { exerciseById, formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function WorkoutDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, user } = useStore();
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
      <ol className="flex flex-col gap-8">
        {workout.moves.map((move, index) => {
          const exercise = exerciseById(data.exercises, move.exerciseId);
          return (
            <li key={move.id} className="flex flex-col gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Move {index + 1}</p>
                <h2 className="font-display text-2xl">{exercise?.name ?? "Removed exercise"}</h2>
                <p className="mt-1 text-base tabular-nums">
                  {move.sets} × {move.reps}
                </p>
                {exercise ? (
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{exercise.cue}</p>
                ) : null}
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
