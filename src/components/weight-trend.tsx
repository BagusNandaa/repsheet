import { formatDate, formatKg } from "@/lib/format";
import { goalDirection, type GoalDirection } from "@/lib/weight-goal";

type Point = { date: string; weightKg: number };

const directionWords: Record<GoalDirection, string> = {
  toward: "toward the goal",
  away: "away from the goal",
  flat: "the same distance from the goal",
};

export function WeightTrend({
  points,
  goalKg = null,
}: {
  points: Point[];
  goalKg?: number | null;
}) {
  if (points.length === 0) return null;
  if (points.length < 2 && goalKg == null) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.map((point) => point.weightKg);
  if (goalKg != null) weights.push(goalKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;
  const width = 320;
  const height = 96;
  const pad = 10;

  function position(index: number, weightKg: number) {
    const x =
      sorted.length === 1 ? width / 2 : pad + (index / (sorted.length - 1)) * (width - pad * 2);
    const y = height - pad - ((weightKg - min) / span) * (height - pad * 2);
    return { x, y };
  }

  const coords = sorted.map((point, index) => position(index, point.weightKg));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;

  let label = `Weight from ${formatKg(first.weightKg)} on ${formatDate(first.date)} to ${formatKg(last.weightKg)} on ${formatDate(last.date)}`;
  if (goalKg != null) {
    label += `. Goal ${formatKg(goalKg)}`;
    const previous = sorted[sorted.length - 2];
    if (previous) {
      const direction = goalDirection(previous.weightKg, last.weightKg, goalKg);
      label += `. The latest change moves ${directionWords[direction]}`;
    }
  }

  const goalY = goalKg == null ? null : position(0, goalKg).y;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="weight-trend mt-3 h-24 w-full text-primary"
      role="img"
      aria-label={label}
    >
      {goalY != null ? (
        <>
          <line className="trend-goal" x1={pad} x2={width - pad} y1={goalY} y2={goalY}>
            <title>{`Goal, ${formatKg(goalKg ?? 0)}`}</title>
          </line>
          <text x={width - pad} y={goalY < 18 ? goalY + 14 : goalY - 6} textAnchor="end">
            Goal
          </text>
        </>
      ) : null}
      {goalKg == null ? (
        <polyline
          className="trend-line"
          fill="none"
          points={coords.map((coord) => `${coord.x},${coord.y}`).join(" ")}
        />
      ) : sorted.length === 1 ? (
        <circle className="trend-flat" cx={coords[0]?.x} cy={coords[0]?.y} r="4" />
      ) : (
        sorted.slice(1).map((point, index) => {
          const previous = sorted[index];
          const from = coords[index];
          const to = coords[index + 1];
          if (!previous || !from || !to || goalKg == null) return null;
          const direction = goalDirection(previous.weightKg, point.weightKg, goalKg);
          return (
            <line
              key={`${point.date}-${index}`}
              className={`trend-${direction}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            >
              <title>
                {`${formatDate(previous.date)} to ${formatDate(point.date)}, ${directionWords[direction]}`}
              </title>
            </line>
          );
        })
      )}
    </svg>
  );
}
