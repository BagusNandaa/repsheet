/** Segment emitted by `output: 'export'`. Real ids are created in the browser. */
export const STATIC_PARAM = "placeholder";

export type SheetParams = {
  id?: string;
  exerciseId?: string;
};

function decodeSegment(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

/**
 * Ids from the address bar. Static hosting serves one HTML shell per route,
 * so the Next param is `placeholder` while the URL still has the real id.
 */
export function readSheetParams(pathname: string): SheetParams {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const coachExercise = path.match(/^\/coach\/clients\/([^/]+)\/exercises\/([^/]+)$/);
  if (coachExercise) {
    const id = decodeSegment(coachExercise[1]);
    const exerciseId = decodeSegment(coachExercise[2]);
    if (!id || !exerciseId) return {};
    return { id, exerciseId };
  }

  const match = path.match(
    /^\/(?:exercises|library|workouts|coach\/clients)\/([^/]+)(?:\/(?:session|workout|measure))?$/,
  );
  if (!match) return {};
  const id = decodeSegment(match[1]);
  return id ? { id } : {};
}
