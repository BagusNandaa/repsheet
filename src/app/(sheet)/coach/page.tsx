"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyNote, PageIntro, actionClass } from "@/components/sheet-ui";
import { formatDate, formatKg } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "cn";

export default function CoachHomePage() {
  const { data } = useStore();
  if (!data) return null;

  const clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-5">
      <PageIntro title="Clients">{rosterLine(clients.map((client) => client.name))}</PageIntro>
      <Link href="/coach/clients/new" className={cn(buttonVariants(), actionClass)}>
        Add a client
      </Link>
      {clients.length === 0 ? (
        <EmptyNote>No clients yet. Add someone to start a sheet.</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-3">
          {clients.map((client) => {
            const measurements = data.measurements
              .filter((item) => item.clientId === client.id)
              .sort((a, b) => b.date.localeCompare(a.date));
            const sessions = data.sessions
              .filter((item) => item.clientId === client.id)
              .sort((a, b) => b.date.localeCompare(a.date));
            const latest = measurements[0];
            const lastSession = sessions[0];
            return (
              <li key={client.id}>
                <Link href={`/coach/clients/${client.id}`} className="block">
                  <Card className="text-base transition-colors active:bg-accent">
                    <CardHeader>
                      <CardTitle className="text-2xl">{client.name}</CardTitle>
                      <CardDescription className="text-sm leading-5">
                        {latest
                          ? `${formatKg(latest.weightKg)} · ${formatDate(latest.date)}`
                          : "No weigh-in yet"}
                        {lastSession ? ` · Last session ${formatDate(lastSession.date)}` : ""}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function rosterLine(names: string[]) {
  if (names.length === 0) return "Add someone when a new person starts.";
  if (names.length === 1) return `${names[0]} is on your sheet.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are on your sheet.`;
  return `${names.length} clients are on your sheet.`;
}
