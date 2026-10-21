"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BootScreen, Field, FormError, actionClass, inputClass } from "@/components/sheet-ui";
import { useStore } from "@/lib/store";
import type { User } from "@/lib/types";

export default function LoginPage() {
  const { ready, sessionKnown, user, data, signIn } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !sessionKnown || !user) return;
    router.replace(user.role === "coach" ? "/coach" : "/home");
  }, [ready, sessionKnown, user, router]);

  if (!ready || !sessionKnown || !data || user) return <BootScreen />;

  const people = [...data.users].sort((a, b) => {
    if (a.role !== b.role) return a.role === "coach" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  function enter(person: User) {
    const result = signIn(person.email, person.password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.user.role === "coach" ? "/coach" : "/home");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter the email and password.");
      return;
    }
    const result = signIn(email, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.user.role === "coach" ? "/coach" : "/home");
  }

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background px-4 py-8"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 2rem)" }}
    >
      <p className="text-sm font-medium tracking-wide text-primary uppercase">One coach</p>
      <h1 className="mt-2 font-display text-5xl tracking-tight">Repsheet</h1>
      <p className="mt-3 max-w-sm text-base leading-6 text-muted-foreground">
        Stats, sessions, and example videos. The coach assigns the work. Clients log their own sets.
      </p>

      <section className="mt-8 flex flex-col gap-3" aria-label="People on this device">
        <h2 className="text-sm font-medium text-muted-foreground">On this device</h2>
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => enter(person)}
            className="flex w-full flex-col rounded-xl bg-card px-4 py-3 text-left ring-1 ring-foreground/10 hover:bg-accent"
          >
            <span className="font-display text-xl">{person.name}</span>
            <span className="mt-1 text-sm text-muted-foreground">
              {person.role === "coach" ? "Coach" : "Client"} · {person.email} · password{" "}
              {person.password}
            </span>
          </button>
        ))}
      </section>

      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <h2 className="text-sm font-medium text-muted-foreground">Or type a sign-in</h2>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" className={actionClass}>
          Sign in
        </Button>
        <p className="text-sm leading-5 text-muted-foreground">
          Sign-in stays on this phone. It is a demo sheet, not a real account system.
        </p>
      </form>
    </div>
  );
}
