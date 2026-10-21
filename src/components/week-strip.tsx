import { cn } from "cn";
import type { WeekDayStatus, WeekStripDay } from "@/lib/week-strip";

const weekdayLetters = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

const statusLabel: Record<WeekDayStatus, string> = {
  done: "done",
  planned: "planned",
  none: "rest",
};

function parseISODate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

export function WeekStrip({ days, today }: { days: WeekStripDay[]; today: string }) {
  return (
    <section aria-label="This week" className="rounded-xl border border-border bg-card px-3 py-3">
      <h2 className="text-sm font-medium text-muted-foreground">This week</h2>
      <p className="sr-only">
        A filled dot is a finished day. A ring is a planned day. Today is circled.
      </p>
      <ol className="mt-3 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const date = parseISODate(day.date);
          const current = day.date === today;
          const spoken = new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(date);
          return (
            <li key={day.date} className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                {weekdayLetters[date.getDay()]}
              </span>
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-sm font-semibold tracking-[-0.03em] tabular-nums",
                  current ? "bg-primary text-primary-foreground" : "text-foreground",
                )}
                aria-current={current ? "date" : undefined}
              >
                <span className="sr-only">
                  {spoken}, {statusLabel[day.status]}
                </span>
                <span aria-hidden>{date.getDate()}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  day.status === "done" && "bg-[var(--brand-text)]",
                  day.status === "planned" && "border border-[var(--brand-text)]",
                  day.status === "none" && "bg-transparent",
                )}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
