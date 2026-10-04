"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageIntro } from "@/components/sheet-ui";
import { useStore } from "@/lib/store";

export default function LibraryPage() {
  const { data } = useStore();
  if (!data) return null;

  return (
    <div className="flex flex-col gap-5">
      <PageIntro title="Video library">
        Eight example clips. The same ones play inside an assigned workout. They are placeholders
        with a play control, not filmed technique demos.
      </PageIntro>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {data.exercises.map((exercise) => (
          <li key={exercise.id}>
            <Link
              href={`/library/${exercise.id}`}
              className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 active:bg-accent"
            >
              <span>
                <span className="block text-base font-medium">{exercise.name}</span>
                <span className="block text-sm text-muted-foreground">{exercise.muscle}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
