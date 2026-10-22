"use client";

import Link from "next/link";
import { VideoPlayer } from "@/components/video-player";
import { BackLink, EmptyNote } from "@/components/sheet-ui";
import { useSheetParams } from "@/lib/use-sheet-params";
import { useStore } from "@/lib/store";

export default function ExercisePage() {
  const { id } = useSheetParams();
  const { data, user } = useStore();
  if (!data || !id) return null;

  const exercise = data.exercises.find((item) => item.id === id);
  if (!exercise) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/library">Library</BackLink>
        <EmptyNote>That exercise is not in the library.</EmptyNote>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/library">Library</BackLink>
      <div>
        <h1 className="font-display text-4xl tracking-tight">{exercise.name}</h1>
        <p className="mt-2 text-base text-muted-foreground">{exercise.muscle}</p>
        <p className="mt-3 text-base leading-6">{exercise.cue}</p>
      </div>
      <VideoPlayer exercise={exercise} />
      {user?.role === "client" ? (
        <Link href={`/exercises/${exercise.id}`} className="text-sm font-medium text-[var(--brand-text)]">
          Your history
        </Link>
      ) : null}
    </div>
  );
}
