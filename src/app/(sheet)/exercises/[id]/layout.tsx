import type { ReactNode } from "react";
import { STATIC_PARAM } from "@/lib/static-params";

export function generateStaticParams() {
  return [{ id: STATIC_PARAM }];
}

export default function ExerciseSegmentLayout({ children }: { children: ReactNode }) {
  return children;
}
