import type { ReactNode } from "react";
import { STATIC_PARAM } from "@/lib/static-params";

export function generateStaticParams() {
  return [{ exerciseId: STATIC_PARAM }];
}

export default function ClientExerciseSegmentLayout({ children }: { children: ReactNode }) {
  return children;
}
