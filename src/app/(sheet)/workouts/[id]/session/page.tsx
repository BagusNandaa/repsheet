"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ClientSessionScreen } from "@/components/client-session";
import { Button } from "@/components/ui/button";
import { BackLink, EmptyNote, PageIntro, actionClass } from "@/components/sheet-ui";
import { sessionToResume } from "@/lib/session-plan";
import { useStore } from "@/lib/store";

export default function WorkoutSessionPage() {
  const params = useParams<{ id: string }>();
  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, user, startClientWorkout, updateClientSet } = useStore();
  const [startError, setStartError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const clientId = user?.role === "client" ? (user.clientId ?? null) : null;

  if (!data || !user || !workoutId || !clientId) return null;

  const workout = data.workouts.find((item) => item.id === workoutId && item.clientId === clientId);
  if (!workout) {
    return (
      <div
        className="flex flex-col gap-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <BackLink href="/workouts">Workouts</BackLink>
        <EmptyNote>That workout is not on your sheet.</EmptyNote>
      </div>
    );
  }

  const assigned = workout;
  const session = sessionToResume(data.sessions, clientId, assigned.id, false);

  function begin() {
    const result = startClientWorkout(assigned.id);
    if (!result.ok) setStartError(result.error);
  }

  if (startError) {
    return (
      <div
        className="flex flex-col gap-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <BackLink href={`/workouts/${assigned.id}`}>{assigned.name}</BackLink>
        <EmptyNote>{startError}</EmptyNote>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="flex flex-col gap-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <BackLink href={`/workouts/${assigned.id}`}>{assigned.name}</BackLink>
        <PageIntro title={assigned.name}>
          Log each set. Weight and reps start from your last session.
        </PageIntro>
        <Button type="button" className={actionClass} onClick={begin}>
          Start session
        </Button>
      </div>
    );
  }

  return (
    <ClientSessionScreen
      key={session.id}
      session={session}
      workoutName={assigned.name}
      clientId={clientId}
      exercises={data.exercises}
      history={data.sessions}
      error={saveError}
      onUpdateSet={(input) => {
        const result = updateClientSet({ sessionId: session.id, ...input });
        setSaveError(result.ok ? null : result.error);
        return result;
      }}
    />
  );
}
