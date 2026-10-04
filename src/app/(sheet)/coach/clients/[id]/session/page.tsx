"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BackLink,
  EmptyNote,
  ExerciseSelect,
  Field,
  FormError,
  PageIntro,
  actionClass,
  inputClass,
} from "@/components/sheet-ui";
import { todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";

type Draft = {
  key: string;
  exerciseId: string;
  weightKg: string;
  reps: string;
  sets: string;
};

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  return Number(trimmed);
}

function blankDraft(): Draft {
  return {
    key: crypto.randomUUID(),
    exerciseId: "",
    weightKg: "",
    reps: "",
    sets: "",
  };
}

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, addSession } = useStore();
  const router = useRouter();
  const [date, setDate] = useState(todayISO);
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Draft[]>([blankDraft()]);
  const [error, setError] = useState<string | null>(null);

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

  function update(key: string, patch: Partial<Draft>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const filled = rows.filter(
      (row) => row.exerciseId || row.weightKg || row.reps || row.sets,
    );
    const result = addSession({
      clientId: id,
      date,
      title,
      exercises: filled.map((row) => ({
        exerciseId: row.exerciseId,
        weightKg: parseNumber(row.weightKg),
        reps: parseNumber(row.reps),
        sets: parseNumber(row.sets),
      })),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/coach/clients/${id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/coach/clients/${client.id}`}>{client.name}</BackLink>
      <PageIntro title="Log a session">
        Use 0 kg for a bodyweight move. Reps and sets are whole numbers.
      </PageIntro>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field label="Date" htmlFor="session-date">
          <Input
            id="session-date"
            type="date"
            max={todayISO()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Title" htmlFor="session-title" hint="Optional. For example, Lower body.">
          <Input
            id="session-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <fieldset key={row.key} className="flex flex-col gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
              <legend className="px-1 text-sm font-medium">Move {index + 1}</legend>
              <Field label="Exercise" htmlFor={`exercise-${row.key}`}>
                <ExerciseSelect
                  id={`exercise-${row.key}`}
                  value={row.exerciseId}
                  exercises={data.exercises}
                  onChange={(exerciseId) => update(row.key, { exerciseId })}
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Kg" htmlFor={`weight-${row.key}`}>
                  <Input
                    id={`weight-${row.key}`}
                    inputMode="decimal"
                    value={row.weightKg}
                    onChange={(event) => update(row.key, { weightKg: event.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Reps" htmlFor={`reps-${row.key}`}>
                  <Input
                    id={`reps-${row.key}`}
                    inputMode="numeric"
                    value={row.reps}
                    onChange={(event) => update(row.key, { reps: event.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Sets" htmlFor={`sets-${row.key}`}>
                  <Input
                    id={`sets-${row.key}`}
                    inputMode="numeric"
                    value={row.sets}
                    onChange={(event) => update(row.key, { sets: event.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="self-start"
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              >
                Remove move
              </Button>
            </fieldset>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className={actionClass}
          onClick={() => setRows((current) => [...current, blankDraft()])}
        >
          Add a move
        </Button>
        <FormError>{error}</FormError>
        <Button type="submit" className={actionClass}>
          Save session
        </Button>
      </form>
    </div>
  );
}
