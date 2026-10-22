"use client";

import { ExerciseHistoryView } from "@/components/exercise-history";
import { BackLink, EmptyNote } from "@/components/sheet-ui";
import { exerciseHistory } from "@/lib/records";
import { useSheetParams } from "@/lib/use-sheet-params";
import { useStore } from "@/lib/store";

export default function ExerciseHistoryPage() {
  const { id } = useSheetParams();
  const { data, user } = useStore();
  if (!data || !user || user.role !== "client" || !user.clientId || !id) return null;

  const exercise = data.exercises.find((item) => item.id === id);
  if (!exercise) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/home">Home</BackLink>
        <EmptyNote>That exercise is not in the library.</EmptyNote>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/home">Home</BackLink>
      <div>
        <h1 className="font-display text-4xl tracking-tight">{exercise.name}</h1>
        <p className="mt-2 text-base text-muted-foreground">{exercise.muscle}</p>
      </div>
      <ExerciseHistoryView history={exerciseHistory(data.sessions, user.clientId, exercise.id)} />
    </div>
  );
}
