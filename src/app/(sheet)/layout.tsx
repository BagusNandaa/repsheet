"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BootScreen } from "@/components/sheet-ui";
import { useStore } from "@/lib/store";

export default function SheetLayout({ children }: { children: ReactNode }) {
  const { ready, sessionKnown, user } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready || !sessionKnown) return;
    if (!user) {
      router.replace("/");
      return;
    }
    const workoutDetail = /^\/workouts\/[^/]+$/.test(pathname);
    const clientOnly =
      pathname === "/home" || (pathname.startsWith("/workouts") && !workoutDetail);
    if (pathname.startsWith("/coach") && user.role !== "coach") {
      router.replace("/home");
    } else if (clientOnly && user.role !== "client") {
      router.replace("/coach");
    }
  }, [ready, sessionKnown, user, router, pathname]);

  if (!ready || !sessionKnown || !user) return <BootScreen />;

  const workoutDetail = /^\/workouts\/[^/]+$/.test(pathname);
  const clientOnly =
    pathname === "/home" || (pathname.startsWith("/workouts") && !workoutDetail);
  if (pathname.startsWith("/coach") && user.role !== "coach") return <BootScreen />;
  if (clientOnly && user.role !== "client") return <BootScreen />;

  return <AppShell>{children}</AppShell>;
}
