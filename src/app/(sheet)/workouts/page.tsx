"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyNote, PageIntro, actionClass } from "@/components/sheet-ui";
import { exerciseName, formatDate } from "@/lib/format";
import { openClientSession } from "@/lib/session-plan";
import { useStore } from "@/lib/store";
import { cn } from "cn";

export default function WorkoutsPage() {
  const { data, user } = useStore();
  if (!data || !user || !user.clientId) return null;
  const clientId = user.clientId;

  const coach = data.users.find((person) => person.role === "coach");
  const workouts = data.workouts
    .filter((item) => item.clientId === clientId)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));

  return (
    <div className="flex flex-col gap-5">
      <PageIntro title="Workouts">
        {coach ? `Assigned by ${coach.name}. ` : ""}
        Start a session to log each set, or open a workout to play the example videos.
      </PageIntro>
      {workouts.length === 0 ? (
        <div className="flex flex-col gap-4">
          <EmptyNote>
            No workout yet. {coach?.name ?? "Your coach"} has not assigned one. The video library is
            still open.
          </EmptyNote>
          <Link href="/library" className={cn(buttonVariants(), actionClass)}>
            Browse the library
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <Link href={`/workouts/${workout.id}`} className="block">
                <Card className="text-base active:bg-accent">
                  <CardHeader>
                    <CardTitle className="text-2xl">{workout.name}</CardTitle>
                    <CardDescription className="text-sm leading-5">
                      {workout.moves.length} moves · {formatDate(workout.assignedAt)}
                      {" · "}
                      {exerciseName(data.exercises, workout.moves[0]?.exerciseId ?? "")}
                      {openClientSession(data.sessions, clientId, workout.id)
                        ? " · In progress"
                        : ""}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
