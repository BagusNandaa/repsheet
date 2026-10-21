"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, actionClass, controlClass, inputClass } from "@/components/sheet-ui";
import { exerciseName, formatKg } from "@/lib/format";
import { canonicalProgression } from "@/lib/progression";
import {
  exerciseTarget,
  formatWeightInput,
  parseLoggedReps,
  parseLoggedWeight,
} from "@/lib/session-plan";
import type {
  Exercise,
  ProgressionRule,
  Result,
  Session,
  TargetOverride,
  Workout,
  WorkoutMove,
} from "@/lib/types";

export type RuleDraft = {
  kind: "none" | "linear" | "double";
  incrementKg: string;
  stallSessions: string;
  repMin: string;
  repMax: string;
};

type MoveChoice = "inherit" | "none" | "linear" | "double";

type MoveDraft = {
  id: string;
  choice: MoveChoice;
  incrementKg: string;
  stallSessions: string;
  repMin: string;
  repMax: string;
  overrideOn: boolean;
  overrideWeight: string;
  overrideReps: string;
};

export function blankRuleDraft(): RuleDraft {
  return { kind: "none", incrementKg: "2.5", stallSessions: "3", repMin: "8", repMax: "12" };
}

export function ruleToDraft(rule: ProgressionRule): RuleDraft {
  const blank = blankRuleDraft();
  if (rule.kind === "linear") {
    return {
      ...blank,
      kind: "linear",
      incrementKg: formatWeightInput(rule.incrementKg),
      stallSessions: String(rule.stallSessions),
    };
  }
  if (rule.kind === "double") {
    return {
      kind: "double",
      incrementKg: formatWeightInput(rule.incrementKg),
      stallSessions: String(rule.stallSessions),
      repMin: String(rule.repMin),
      repMax: String(rule.repMax),
    };
  }
  return blank;
}

export function parseRuleDraft(draft: Pick<RuleDraft, "kind" | "incrementKg" | "stallSessions" | "repMin" | "repMax">) {
  if (draft.kind === "none") return canonicalProgression({ kind: "none" });
  const incrementKg = Number(draft.incrementKg.trim());
  const stallSessions = Number(draft.stallSessions.trim());
  if (draft.kind === "linear") {
    return canonicalProgression({ kind: "linear", incrementKg, stallSessions });
  }
  return canonicalProgression({
    kind: "double",
    incrementKg,
    stallSessions,
    repMin: Number(draft.repMin.trim()),
    repMax: Number(draft.repMax.trim()),
  });
}

function numbersFrom(rule: ProgressionRule | null, fallback: ProgressionRule) {
  if (rule && rule.kind !== "none") return ruleToDraft(rule);
  if (fallback.kind !== "none") return ruleToDraft(fallback);
  return blankRuleDraft();
}

function draftsFor(workout: Workout): { rule: RuleDraft; moves: MoveDraft[] } {
  return {
    rule: ruleToDraft(workout.progression),
    moves: workout.moves.map((move) => {
      const numbers = numbersFrom(move.progression, workout.progression);
      return {
        id: move.id,
        choice: move.progression ? move.progression.kind : "inherit",
        incrementKg: numbers.incrementKg,
        stallSessions: numbers.stallSessions,
        repMin: numbers.repMin,
        repMax: numbers.repMax,
        overrideOn: move.targetOverride !== null,
        overrideWeight: move.targetOverride ? formatWeightInput(move.targetOverride.weightKg) : "",
        overrideReps: move.targetOverride ? String(move.targetOverride.reps) : "",
      };
    }),
  };
}

function LoadFields({
  idPrefix,
  value,
  onChange,
  showRange,
}: {
  idPrefix: string;
  value: Pick<RuleDraft, "incrementKg" | "stallSessions" | "repMin" | "repMax">;
  onChange: (patch: Partial<RuleDraft>) => void;
  showRange: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Add weight" htmlFor={`${idPrefix}-kg`} hint="kg">
        <Input
          id={`${idPrefix}-kg`}
          inputMode="decimal"
          value={value.incrementKg}
          onChange={(event) => onChange({ incrementKg: event.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label="Stalled sessions" htmlFor={`${idPrefix}-stall`} hint="Then deload">
        <Input
          id={`${idPrefix}-stall`}
          inputMode="numeric"
          value={value.stallSessions}
          onChange={(event) => onChange({ stallSessions: event.target.value })}
          className={inputClass}
        />
      </Field>
      {showRange ? (
        <>
          <Field label="Reps from" htmlFor={`${idPrefix}-min`}>
            <Input
              id={`${idPrefix}-min`}
              inputMode="numeric"
              value={value.repMin}
              onChange={(event) => onChange({ repMin: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Reps up to" htmlFor={`${idPrefix}-max`}>
            <Input
              id={`${idPrefix}-max`}
              inputMode="numeric"
              value={value.repMax}
              onChange={(event) => onChange({ repMax: event.target.value })}
              className={inputClass}
            />
          </Field>
        </>
      ) : null}
    </div>
  );
}

export function ProgressionFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: RuleDraft;
  onChange: (next: RuleDraft) => void;
}) {
  const hint =
    value.kind === "linear"
      ? "Adds weight when every working set hits the target reps."
      : value.kind === "double"
        ? "Adds a rep up to the top of the range, then adds weight and starts again."
        : "The next session repeats the last logged weight and reps.";
  return (
    <div className="flex flex-col gap-3">
      <Field label="Rule" htmlFor={`${idPrefix}-rule`} hint={hint}>
        <select
          id={`${idPrefix}-rule`}
          value={value.kind}
          onChange={(event) => onChange({ ...value, kind: event.target.value as RuleDraft["kind"] })}
          className={controlClass}
        >
          <option value="none">None</option>
          <option value="linear">Linear</option>
          <option value="double">Double</option>
        </select>
      </Field>
      {value.kind === "none" ? null : (
        <LoadFields
          idPrefix={idPrefix}
          value={value}
          showRange={value.kind === "double"}
          onChange={(patch) => onChange({ ...value, ...patch })}
        />
      )}
    </div>
  );
}

function readOverride(draft: MoveDraft): { ok: true; override: TargetOverride | null } | { ok: false; error: string } {
  if (!draft.overrideOn) return { ok: true, override: null };
  const weightKg = parseLoggedWeight(draft.overrideWeight);
  const reps = parseLoggedReps(draft.overrideReps);
  if (weightKg === null) return { ok: false, error: "Enter a target weight from 0 to 400 kg." };
  if (reps === null) return { ok: false, error: "Enter target reps from 0 to 100." };
  return { ok: true, override: { weightKg, reps } };
}

export function ProgressionEditor({
  workout,
  sessions,
  exercises,
  onSave,
}: {
  workout: Workout;
  sessions: readonly Session[];
  exercises: Exercise[];
  onSave: (input: {
    workoutId: string;
    progression: ProgressionRule;
    moves: Array<{ id: string; progression: ProgressionRule | null; targetOverride: TargetOverride | null }>;
  }) => Result;
}) {
  const initial = draftsFor(workout);
  const [rule, setRule] = useState(initial.rule);
  const [moves, setMoves] = useState(initial.moves);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateMove(id: string, patch: Partial<MoveDraft>) {
    setSaved(false);
    setMoves((current) => current.map((move) => (move.id === id ? { ...move, ...patch } : move)));
  }

  function preview(move: WorkoutMove, draft: MoveDraft) {
    const workoutRule = parseRuleDraft(rule);
    if (!workoutRule.ok) return workoutRule;
    let progression: ProgressionRule | null = null;
    if (draft.choice !== "inherit") {
      const moveRule = parseRuleDraft({ ...draft, kind: draft.choice });
      if (!moveRule.ok) return moveRule;
      progression = moveRule.rule;
    }
    const override = readOverride(draft);
    if (!override.ok) return override;
    return {
      ok: true as const,
      target: exerciseTarget({
        sessions,
        clientId: workout.clientId,
        workout: { ...workout, progression: workoutRule.rule },
        move: { ...move, progression, targetOverride: override.override },
      }),
    };
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workoutRule = parseRuleDraft(rule);
    if (!workoutRule.ok) {
      setSaved(false);
      setError(workoutRule.error);
      return;
    }
    const nextMoves: Array<{
      id: string;
      progression: ProgressionRule | null;
      targetOverride: TargetOverride | null;
    }> = [];
    for (const draft of moves) {
      let progression: ProgressionRule | null = null;
      if (draft.choice !== "inherit") {
        const moveRule = parseRuleDraft({ ...draft, kind: draft.choice });
        if (!moveRule.ok) {
          setSaved(false);
          setError(moveRule.error);
          return;
        }
        progression = moveRule.rule;
      }
      const override = readOverride(draft);
      if (!override.ok) {
        setSaved(false);
        setError(override.error);
        return;
      }
      nextMoves.push({ id: draft.id, progression, targetOverride: override.override });
    }
    const result = onSave({
      workoutId: workout.id,
      progression: workoutRule.rule,
      moves: nextMoves,
    });
    if (!result.ok) {
      setSaved(false);
      setError(result.error);
      return;
    }
    setError(null);
    setSaved(true);
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 dark:rounded-none"
      onSubmit={onSubmit}
      noValidate
    >
      <div>
        <h2 className="font-display text-2xl">Progression</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          A miss never adds weight. After the stalled-session count, the load drops 10%, rounded to the nearest 0.5 kg.
        </p>
      </div>
      <ProgressionFields
        idPrefix={`prog-${workout.id}`}
        value={rule}
        onChange={(next) => {
          setSaved(false);
          setRule(next);
        }}
      />
      <ul className="flex flex-col gap-4">
        {workout.moves.map((move, index) => {
          const draft = moves.find((item) => item.id === move.id);
          if (!draft) return null;
          const shown = preview(move, draft);
          return (
            <li key={move.id} className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">Move {index + 1}</p>
              <p className="font-display text-xl">{exerciseName(exercises, move.exerciseId)}</p>
              <Field label="This move" htmlFor={`move-rule-${move.id}`}>
                <select
                  id={`move-rule-${move.id}`}
                  value={draft.choice}
                  onChange={(event) => updateMove(move.id, { choice: event.target.value as MoveChoice })}
                  className={controlClass}
                >
                  <option value="inherit">Same as workout</option>
                  <option value="none">None</option>
                  <option value="linear">Linear</option>
                  <option value="double">Double</option>
                </select>
              </Field>
              {draft.choice === "linear" || draft.choice === "double" ? (
                <LoadFields
                  idPrefix={`move-${move.id}`}
                  value={draft}
                  showRange={draft.choice === "double"}
                  onChange={(patch) => updateMove(move.id, patch)}
                />
              ) : null}
              {shown.ok ? (
                <div>
                  <p className="text-sm font-medium tabular-nums">
                    Next {formatKg(shown.target.weightKg)} × {shown.target.reps}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {shown.target.reason ?? "Next session uses the last logged weight and reps."}
                  </p>
                </div>
              ) : (
                <p className="text-sm leading-5 text-destructive">{shown.error}</p>
              )}
              <label className="flex min-h-11 items-center gap-2 text-sm" htmlFor={`override-${move.id}`}>
                <input
                  id={`override-${move.id}`}
                  type="checkbox"
                  checked={draft.overrideOn}
                  onChange={(event) => {
                    const overrideOn = event.target.checked;
                    if (!overrideOn) {
                      updateMove(move.id, { overrideOn });
                      return;
                    }
                    const suggested = preview(move, { ...draft, overrideOn: false });
                    updateMove(move.id, {
                      overrideOn,
                      overrideWeight:
                        draft.overrideWeight ||
                        (suggested.ok ? formatWeightInput(suggested.target.weightKg) : ""),
                      overrideReps:
                        draft.overrideReps || (suggested.ok ? String(suggested.target.reps) : ""),
                    });
                  }}
                />
                Set the next target yourself
              </label>
              {draft.overrideOn ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Target weight" htmlFor={`ow-${move.id}`} hint="kg">
                    <Input
                      id={`ow-${move.id}`}
                      inputMode="decimal"
                      value={draft.overrideWeight}
                      onChange={(event) => updateMove(move.id, { overrideWeight: event.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Target reps" htmlFor={`or-${move.id}`}>
                    <Input
                      id={`or-${move.id}`}
                      inputMode="numeric"
                      value={draft.overrideReps}
                      onChange={(event) => updateMove(move.id, { overrideReps: event.target.value })}
                      className={inputClass}
                    />
                  </Field>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <FormError>{error}</FormError>
      {saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          Saved.
        </p>
      ) : null}
      <Button type="submit" className={actionClass}>
        Save progression
      </Button>
    </form>
  );
}
