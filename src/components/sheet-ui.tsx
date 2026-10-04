import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Label } from "@/components/ui/label";

export function BootScreen() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background px-5 py-10">
      <p className="font-display text-3xl tracking-tight">Repsheet</p>
      <p className="mt-3 text-base text-muted-foreground" role="status">
        Opening your sheet…
      </p>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

export function PageIntro({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <h1 className="font-display text-4xl tracking-tight">{title}</h1>
      {children ? (
        <p className="mt-2 text-base leading-6 text-muted-foreground">{children}</p>
      ) : null}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-muted px-4 py-3 text-base leading-6 text-muted-foreground">
      {children}
    </p>
  );
}

export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm leading-5 text-destructive">
      {children}
    </p>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor} className="text-base">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-sm leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const controlClass =
  "h-12 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ExerciseSelect({
  id,
  value,
  onChange,
  exercises,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  exercises: Array<{ id: string; name: string }>;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={controlClass}
    >
      <option value="">Choose an exercise</option>
      {exercises.map((exercise) => (
        <option key={exercise.id} value={exercise.id}>
          {exercise.name}
        </option>
      ))}
    </select>
  );
}

export const inputClass = "h-12 bg-card px-3 md:text-base";
export const actionClass = "h-12 w-full text-base";

export { controlClass };
