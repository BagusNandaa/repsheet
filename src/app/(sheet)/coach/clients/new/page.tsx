"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BackLink,
  Field,
  FormError,
  PageIntro,
  actionClass,
  inputClass,
} from "@/components/sheet-ui";
import { useStore } from "@/lib/store";

export default function NewClientPage() {
  const { addClient } = useStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("welcome");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = addClient({ name, email, password });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/coach/clients/${result.clientId}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/coach">Clients</BackLink>
      <PageIntro title="Add a client">
        They can sign in on this device, see their sheet, and log their own sets.
      </PageIntro>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field label="Name" htmlFor="name">
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Email" htmlFor="client-email">
          <Input
            id="client-email"
            type="email"
            autoComplete="off"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="client-password"
          hint="Share this with them. It stays on this device."
        >
          <Input
            id="client-password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" className={actionClass}>
          Add client
        </Button>
      </form>
    </div>
  );
}
