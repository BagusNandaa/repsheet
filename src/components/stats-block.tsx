import { WeightTrend } from "@/components/weight-trend";
import { formatDate, formatKg, formatWeightChange } from "@/lib/format";
import type { Measurement } from "@/lib/types";

const tapes = [
  ["Chest", "chestCm"],
  ["Waist", "waistCm"],
  ["Hips", "hipsCm"],
  ["Thigh", "thighCm"],
] as const;

export function StatsBlock({
  latest,
  previous,
  history,
}: {
  latest: Measurement;
  previous?: Measurement;
  history: Measurement[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="kicker text-sm text-muted-foreground">Weight · {formatDate(latest.date)}</p>
        <p className="font-display text-5xl tracking-tight tabular-nums">
          {formatKg(latest.weightKg)}
        </p>
        {previous ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {formatWeightChange(latest.weightKg, previous.weightKg)} since{" "}
            {formatDate(previous.date)}
          </p>
        ) : null}
        <WeightTrend points={history.map((item) => ({ date: item.date, weightKg: item.weightKg }))} />
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {tapes.map(([label, key]) => {
          const value = latest[key];
          return (
            <div key={key} className="rounded-lg bg-muted px-3 py-2">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-display text-2xl tabular-nums">
                {value ?? "—"}
                {value !== undefined ? (
                  <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">
                    cm
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
