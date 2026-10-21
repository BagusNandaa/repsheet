"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityPanel } from "@/components/activity-panel";
import { ExerciseRecordLinks } from "@/components/exercise-history";
import { GoalForm } from "@/components/goal-form";
import { SessionCard } from "@/components/session-card";
import { StatsBlock } from "@/components/stats-block";
import { BackLink, EmptyNote, actionClass } from "@/components/sheet-ui";
import { WeekPlanEditor } from "@/components/week-plan-editor";
import { exerciseName, formatDate, formatKg, todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";
import { readGoalWeight } from "@/lib/weight-goal";
import { cn } from "cn";

export default function ClientSheetPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, setGoalWeight } = useStore();
  if (!data || !id) return null;

  const client = data.clients.find((item) => item.id === id);
  if (!client) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/coach">Clients</BackLink>
        <EmptyNote>That client is not on this sheet.</EmptyNote>
      </div>
    );
  }

  const login = data.users.find((person) => person.id === client.userId);
  const measurements = data.measurements
    .filter((item) => item.clientId === client.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const sessions = data.sessions
    .filter((item) => item.clientId === client.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const workouts = data.workouts
    .filter((item) => item.clientId === client.id)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  const latest = measurements[0];
  const goalKg = readGoalWeight(client);
  const today = todayISO();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <BackLink href="/coach">Clients</BackLink>
        <div>
          <h1 className="font-display text-4xl tracking-tight">{client.name}</h1>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            {client.email}
            {login ? ` · password ${login.password}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="#plan" className="rounded-full bg-muted px-3 py-1.5 text-sm">
            Week
          </a>
          <a href="#stats" className="rounded-full bg-muted px-3 py-1.5 text-sm">
            Stats
          </a>
          <a href="#training" className="rounded-full bg-muted px-3 py-1.5 text-sm">
            Training
          </a>
          <a href="#records" className="rounded-full bg-muted px-3 py-1.5 text-sm">
            Records
          </a>
          <a href="#sessions" className="rounded-full bg-muted px-3 py-1.5 text-sm">
            Sessions
          </a>
          <a href="#workouts" className="rounded-full bg-muted px-3 py-1.5 text-sm">
            Workouts
          </a>
        </div>
      </div>

      <section id="stats" className="flex flex-col gap-4">
        <h2 className="font-display text-2xl">Stats</h2>
        {latest ? (
          <StatsBlock
            latest={latest}
            previous={measurements[1]}
            history={measurements}
            goalKg={goalKg}
          />
        ) : (
          <EmptyNote>
            No weigh-in yet. Log weight and tape measurements to start the sheet.
            {goalKg != null ? ` Goal is ${formatKg(goalKg)}.` : ""}
          </EmptyNote>
        )}
        <GoalForm
          key={`${client.id}:${goalKg ?? "none"}`}
          goalKg={goalKg}
          onSave={(next) => {
            const result = setGoalWeight({ clientId: client.id, goalWeightKg: next });
            return result.ok ? null : result.error;
          }}
        />
        {measurements.length > 1 ? (
          <ul className="flex flex-col divide-y divide-border">
            {measurements.slice(0, 6).map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span>{formatDate(item.date)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {item.weightKg} kg
                  {item.waistCm ? ` · waist ${item.waistCm} cm` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          href={`/coach/clients/${client.id}/measure`}
          className={cn(buttonVariants(), actionClass)}
        >
          Log stats
        </Link>
      </section>

      <ActivityPanel
        id="training"
        dates={sessions.map((session) => session.date)}
        today={today}
        weekStartsOn={data.weekStartsOn}
      />

      <section id="records" className="flex flex-col gap-4">
        <h2 className="font-display text-2xl">Records</h2>
        <ExerciseRecordLinks
          exercises={data.exercises}
          sessions={data.sessions}
          clientId={client.id}
          hrefFor={(exerciseId) => `/coach/clients/${client.id}/exercises/${exerciseId}`}
        />
      </section>

      <section id="sessions" className="flex flex-col gap-4">
        <h2 className="font-display text-2xl">Sessions</h2>
        {sessions.length === 0 ? (
          <EmptyNote>No sessions yet. Log the exercise, weight, reps, and sets.</EmptyNote>
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.map((session) => (
              <li key={session.id}>
                <SessionCard session={session} exercises={data.exercises} />
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/coach/clients/${client.id}/session`}
          className={cn(buttonVariants(), actionClass)}
        >
          Log a session
        </Link>
      </section>

      <section id="workouts" className="flex flex-col gap-4">
        <h2 className="font-display text-2xl">Workouts</h2>
        {workouts.length === 0 ? (
          <EmptyNote>No workout assigned. Each move you add includes its example video.</EmptyNote>
        ) : (
          <ul className="flex flex-col gap-3">
            {workouts.map((workout) => (
              <li key={workout.id}>
                <Link href={`/workouts/${workout.id}`} className="block">
                  <Card className="text-base active:bg-accent">
                    <CardHeader>
                      <CardTitle className="text-xl">{workout.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {workout.moves.length} moves · assigned {formatDate(workout.assignedAt)}
                        {" · "}
                        {exerciseName(data.exercises, workout.moves[0]?.exerciseId ?? "")}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/coach/clients/${client.id}/workout`}
          className={cn(buttonVariants(), actionClass)}
        >
          Assign a workout
        </Link>
      </section>

      <WeekPlanEditor
        key={client.id}
        clientId={client.id}
        clientName={client.name}
        workouts={workouts}
        plan={data.plans.find((item) => item.clientId === client.id) ?? null}
        overrides={data.overrides.filter((item) => item.clientId === client.id)}
        weekStartsOn={data.weekStartsOn}
      />
    </div>
  );
}
