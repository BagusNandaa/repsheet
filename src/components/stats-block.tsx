import { WeightTrend } from "@/components/weight-trend";
import { formatDate, formatKg, formatWeightChange } from "@/lib/format";
import type { Measurement } from "@/lib/types";
import { formatGoalDistance, goalDirection, type GoalDirection } from "@/lib/weight-goal";

const directionLabel: Record<GoalDirection, string> = {
  toward: "toward the goal",
  away: "away from the goal",
  flat: "same distance from the goal",
};

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
  goalKg = null,
}: {
  latest: Measurement;
  previous?: Measurement;
  history: Measurement[];
  goalKg?: number | null;
}) {
  const direction =
    previous && goalKg != null ? goalDirection(previous.weightKg, latest.weightKg, goalKg) : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="kicker text-sm text-muted-foreground">Weight · {formatDate(latest.date)}</p>
        <p className="font-display text-4xl tracking-tight whitespace-nowrap tabular-nums min-[360px]:text-5xl">
          {formatKg(latest.weightKg)}
        </p>
        {previous ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {formatWeightChange(latest.weightKg, previous.weightKg)} since{" "}
            {formatDate(previous.date)}
            {direction ? (
              <>
                , <span className={`goal-${direction}`}>{directionLabel[direction]}</span>
              </>
            ) : null}
          </p>
        ) : null}
        {goalKg != null ? (
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">
            {formatGoalDistance(latest.weightKg, goalKg)}
          </p>
        ) : null}
        <WeightTrend
          points={history.map((item) => ({ date: item.date, weightKg: item.weightKg }))}
          goalKg={goalKg}
        />
        {goalKg != null ? (
          <p className="goal-key">
            <span>
              <span className="goal-swatch toward" aria-hidden /> Toward goal
            </span>
            <span>
              <span className="goal-swatch away" aria-hidden /> Away from goal
            </span>
            <span>
              <span className="goal-swatch goal" aria-hidden /> Goal
            </span>
          </p>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {tapes.map(([label, key]) => {
          const value = latest[key];
          return (
            <div key={key} className="min-w-0 rounded-lg bg-muted px-3 py-2">
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
