"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SessionCard } from "@/components/session-card";
import { StatsBlock } from "@/components/stats-block";
import { EmptyNote, PageIntro, actionClass } from "@/components/sheet-ui";
import { useStore } from "@/lib/store";
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

  return (
    <div className="flex flex-col gap-8">
      <PageIntro title={`Hello, ${firstName}`}>
        {coach ? `${coach.name} keeps this sheet.` : "Your coach keeps this sheet."} You can look.
        You cannot edit the numbers.
      </PageIntro>

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
