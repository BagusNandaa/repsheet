"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SessionCard } from "@/components/session-card";
import { StatsBlock } from "@/components/stats-block";
import { WeekStrip } from "@/components/week-strip";
import { EmptyNote, PageIntro, actionClass } from "@/components/sheet-ui";
import { todayISO } from "@/lib/format";
import { openClientSessions, sessionProgress } from "@/lib/session-plan";
import { useStore } from "@/lib/store";
import { getWeekStripDays } from "@/lib/week-strip";
import { cn } from "cn";

export default function ClientHomePage() {
  const { data, user } = useStore();
  if (!data || !user || user.role !== "client" || !user.clientId) return null;

  const client = data.clients.find((item) => item.id === user.clientId);
  const coach = data.users.find((person) => person.role === "coach");
  const measurements = data.measurements
    .filter((item) => item.clientId === user.clientId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const sessions = data.sessions
    .filter((item) => item.clientId === user.clientId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = measurements[0];
  const firstName = user.name.split(" ")[0];
  const openSessions = openClientSessions(data.sessions, user.clientId);

  return (
    <div className="flex flex-col gap-8">
      <PageIntro title={`Hello, ${firstName}`}>
        {coach ? `${coach.name} keeps your stats.` : "Your coach keeps your stats."} You log your
        own sets.
      </PageIntro>

      {openSessions.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">In progress</h2>
          <ul className="flex flex-col gap-3">
            {openSessions.map((session) => {
              if (!session.workoutId) return null;
              const progress = sessionProgress(session);
              return (
                <li key={session.id}>
                  <Link
                    href={`/workouts/${session.workoutId}/session`}
                    className={cn(buttonVariants(), actionClass)}
                  >
                    Continue {session.title} · {progress.done} of {progress.total}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <WeekStrip days={getWeekStripDays()} today={todayISO()} />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl">Stats</h2>
        {latest ? (
          <StatsBlock latest={latest} previous={measurements[1]} history={measurements} />
        ) : (
          <EmptyNote>
            No weigh-in yet. When {coach?.name ?? "your coach"} logs weight and measurements, they
            show up here.
          </EmptyNote>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl">Sessions</h2>
        {sessions.length === 0 ? (
          <EmptyNote>No sessions yet.</EmptyNote>
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.map((session) => (
              <li key={session.id}>
                <SessionCard session={session} exercises={data.exercises} />
              </li>
            ))}
          </ul>
        )}
        <Link href="/workouts" className={cn(buttonVariants({ variant: "outline" }), actionClass)}>
          Open workouts
        </Link>
        {client ? null : (
          <EmptyNote>This sign-in is not linked to a client sheet.</EmptyNote>
        )}
      </section>
    </div>
  );
}
