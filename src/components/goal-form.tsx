"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, actionClass, inputClass } from "@/components/sheet-ui";

export function GoalForm({
  goalKg,
  onSave,
}: {
  goalKg: number | null;
  onSave: (goalKg: number | null) => string | null;
}) {
  const [value, setValue] = useState(goalKg == null ? "" : String(goalKg));
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    setError(onSave(trimmed === "" ? null : Number(trimmed)));
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
      <Field
        label="Goal weight (kg)"
        htmlFor="goal-weight"
        hint="Leave blank and save to clear the goal."
      >
        <Input
          id="goal-weight"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={inputClass}
        />
      </Field>
      <FormError>{error}</FormError>
      <Button type="submit" className={actionClass}>
        Save goal
      </Button>
    </form>
  );
}
