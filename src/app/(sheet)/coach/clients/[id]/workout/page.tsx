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
  controlClass,
  inputClass,
} from "@/components/sheet-ui";
import { ProgressionFields, blankRuleDraft, parseRuleDraft, type RuleDraft } from "@/components/progression-editor";
import { useStore } from "@/lib/store";
import type { ProgressionRule } from "@/lib/types";

type MoveChoice = "inherit" | "none" | "linear" | "double";

type Draft = {
  key: string;
  exerciseId: string;
  sets: string;
  reps: string;
  rule: MoveChoice;
};

function moveProgression(choice: MoveChoice, workoutRule: ProgressionRule): ProgressionRule | null {
  if (choice === "inherit") return null;
  if (choice === "none") return { kind: "none" };
  if (choice === "linear") {
    if (workoutRule.kind === "linear") return workoutRule;
    return { kind: "linear", incrementKg: 2.5, stallSessions: 3 };
  }
  if (workoutRule.kind === "double") return workoutRule;
  return { kind: "double", incrementKg: 2.5, stallSessions: 3, repMin: 8, repMax: 12 };
}

function blankDraft(): Draft {
  return { key: crypto.randomUUID(), exerciseId: "", sets: "", reps: "", rule: "inherit" };
}

export default function AssignWorkoutPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, assignWorkout } = useStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [rule, setRule] = useState<RuleDraft>(blankRuleDraft);
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
    const filled = rows.filter((row) => row.exerciseId || row.sets || row.reps);
    const progression = parseRuleDraft(rule);
    if (!progression.ok) {
      setError(progression.error);
      return;
    }
    const result = assignWorkout({
      clientId: id,
      name,
      progression: progression.rule,
      moves: filled.map((row) => ({
        exerciseId: row.exerciseId,
        sets: Number(row.sets.trim()),
        reps: row.reps,
        progression: moveProgression(row.rule, progression.rule),
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
      <PageIntro title="Assign a workout">
        Each move uses the built-in example video. {client.name} logs the sets. Pick how the weight should climb.
      </PageIntro>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field label="Workout name" htmlFor="workout-name" hint="For example, Strength A.">
          <Input
            id="workout-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </Field>
        <fieldset className="flex flex-col gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
          <legend className="px-1 text-sm font-medium">Progression</legend>
          <ProgressionFields idPrefix="assign" value={rule} onChange={setRule} />
          <p className="text-sm leading-5 text-muted-foreground">
            A miss never adds weight. After the stalled-session count, the load drops 10%, rounded to the nearest 0.5 kg.
            Open the workout later to change one move or type the next target.
          </p>
        </fieldset>
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const chosen = data.exercises.find((exercise) => exercise.id === row.exerciseId);
            return (
              <fieldset key={row.key} className="flex flex-col gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                <legend className="px-1 text-sm font-medium">Move {index + 1}</legend>
                <Field label="Exercise" htmlFor={`move-${row.key}`}>
                  <ExerciseSelect
                    id={`move-${row.key}`}
                    value={row.exerciseId}
                    exercises={data.exercises}
                    onChange={(exerciseId) => update(row.key, { exerciseId })}
                  />
                </Field>
                {chosen ? (
                  <p className="text-sm text-muted-foreground">
                    Example video included for {chosen.name}.
                  </p>
                ) : null}
                <Field label="Progression" htmlFor={`wrule-${row.key}`}>
                  <select
                    id={`wrule-${row.key}`}
                    value={row.rule}
                    onChange={(event) => update(row.key, { rule: event.target.value as MoveChoice })}
                    className={controlClass}
                  >
                    <option value="inherit">Same as workout</option>
                    <option value="none">None</option>
                    <option value="linear">Linear</option>
                    <option value="double">Double</option>
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Sets" htmlFor={`wsets-${row.key}`}>
                    <Input
                      id={`wsets-${row.key}`}
                      inputMode="numeric"
                      value={row.sets}
                      onChange={(event) => update(row.key, { sets: event.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Reps" htmlFor={`wreps-${row.key}`} hint="8 or 40 sec">
                    <Input
                      id={`wreps-${row.key}`}
                      value={row.reps}
                      onChange={(event) => update(row.key, { reps: event.target.value })}
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
            );
          })}
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
          Assign workout
        </Button>
      </form>
    </div>
  );
}
