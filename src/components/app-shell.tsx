"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, House, Library, UserRound, Users } from "lucide-react";
import { cn } from "cn";
import { AppearanceControls } from "@/components/appearance-controls";
import { useStore } from "@/lib/store";

const coachNav = [
  { href: "/coach", label: "Clients", icon: Users },
  { href: "/library", label: "Library", icon: Library },
  { href: "/account", label: "You", icon: UserRound },
];

const clientNav = [
  { href: "/home", label: "Home", icon: House },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/library", label: "Library", icon: Library },
  { href: "/account", label: "You", icon: UserRound },
];

function isCurrent(pathname: string, href: string) {
  if (href === "/coach") return pathname === "/coach" || pathname.startsWith("/coach/");
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useStore();
  const items = user?.role === "coach" ? coachNav : clientNav;
  const homeHref = user?.role === "coach" ? "/coach" : "/home";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
      <header className="app-header sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
        <div
          className="flex flex-col gap-2 px-4 pt-2 pb-2"
          style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
        >
          <div className="flex h-11 items-center justify-between gap-3">
            <Link href={homeHref} className="font-display text-2xl tracking-tight">
              Repsheet
            </Link>
            <p className="truncate text-sm text-muted-foreground">{user?.name}</p>
          </div>
          <AppearanceControls />
        </div>
      </header>
      <main className="flex flex-1 flex-col px-4 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm"
        aria-label="Primary"
      >
        <div
          className="mx-auto flex max-w-lg items-stretch pt-1"
          style={{
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingLeft: "max(0.25rem, env(safe-area-inset-left))",
            paddingRight: "max(0.25rem, env(safe-area-inset-right))",
          }}
        >
          {items.map((item) => {
            const current = isCurrent(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  current ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
