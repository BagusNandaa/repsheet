import { formatDate, formatKg } from "@/lib/format";

export function WeightTrend({
  points,
}: {
  points: Array<{ date: string; weightKg: number }>;
}) {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.map((point) => point.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;
  const width = 320;
  const height = 72;
  const pad = 8;
  const coords = sorted.map((point, index) => {
    const x = pad + (index / (sorted.length - 1)) * (width - pad * 2);
    const y = height - pad - ((point.weightKg - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const label = `Weight from ${formatKg(first.weightKg)} on ${formatDate(first.date)} to ${formatKg(last.weightKg)} on ${formatDate(last.date)}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="weight-trend mt-3 h-16 w-full text-primary"
      role="img"
      aria-label={label}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}
