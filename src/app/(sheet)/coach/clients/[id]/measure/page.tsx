"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BackLink,
  EmptyNote,
  Field,
  FormError,
  PageIntro,
  actionClass,
  inputClass,
} from "@/components/sheet-ui";
import { todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function MeasurePage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, addMeasurement } = useStore();
  const router = useRouter();
  const [date, setDate] = useState(todayISO);
  const [weight, setWeight] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [thigh, setThigh] = useState("");
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const result = addMeasurement({
      clientId: id,
      date,
      weightKg: Number(weight),
      chestCm: readOptional(chest),
      waistCm: readOptional(waist),
      hipsCm: readOptional(hips),
      thighCm: readOptional(thigh),
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
      <PageIntro title="Log stats">
        Weight is required. Leave a tape measurement blank if you did not take it.
      </PageIntro>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field label="Date" htmlFor="date">
          <Input
            id="date"
            type="date"
            max={todayISO()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Weight (kg)" htmlFor="weight">
          <Input
            id="weight"
            inputMode="decimal"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chest (cm)" htmlFor="chest">
            <Input id="chest" inputMode="decimal" value={chest} onChange={(event) => setChest(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Waist (cm)" htmlFor="waist">
            <Input id="waist" inputMode="decimal" value={waist} onChange={(event) => setWaist(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Hips (cm)" htmlFor="hips">
            <Input id="hips" inputMode="decimal" value={hips} onChange={(event) => setHips(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Thigh (cm)" htmlFor="thigh">
            <Input id="thigh" inputMode="decimal" value={thigh} onChange={(event) => setThigh(event.target.value)} className={inputClass} />
          </Field>
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" className={actionClass}>
          Save stats
        </Button>
      </form>
    </div>
  );
}

function readOptional(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return Number(trimmed);
}
