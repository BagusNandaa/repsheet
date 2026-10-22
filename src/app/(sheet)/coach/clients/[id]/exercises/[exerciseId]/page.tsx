"use client";

import { ExerciseHistoryView } from "@/components/exercise-history";
import { BackLink, EmptyNote } from "@/components/sheet-ui";
import { exerciseHistory } from "@/lib/records";
import { useSheetParams } from "@/lib/use-sheet-params";
import { useStore } from "@/lib/store";

export default function CoachExerciseHistoryPage() {
  const { id: clientId, exerciseId } = useSheetParams();
  const { data, user } = useStore();
  if (!data || !user || user.role !== "coach" || !clientId || !exerciseId) return null;

  const client = data.clients.find((item) => item.id === clientId);
  const exercise = data.exercises.find((item) => item.id === exerciseId);
  if (!client || !exercise) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href={client ? `/coach/clients/${client.id}` : "/coach"}>
          {client?.name ?? "Clients"}
        </BackLink>
        <EmptyNote>That exercise is not on this sheet.</EmptyNote>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/coach/clients/${client.id}`}>{client.name}</BackLink>
      <div>
        <h1 className="font-display text-4xl tracking-tight">{exercise.name}</h1>
        <p className="mt-2 text-base text-muted-foreground">
          {client.name} · {exercise.muscle}
        </p>
      </div>
      <ExerciseHistoryView history={exerciseHistory(data.sessions, client.id, exercise.id)} />
    </div>
  );
}
