"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageIntro, actionClass } from "@/components/sheet-ui";
import { useStore } from "@/lib/store";

type InstallPrompt = Event & { prompt: () => Promise<void> };

export default function AccountPage() {
  const { user, signOut, resetDemo } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const iosStandalone =
      "standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const sync = () => setStandalone(media.matches || iosStandalone);
    sync();
    media.addEventListener("change", sync);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="You">
        {user.role === "coach"
          ? "You can add clients, log stats and sessions, and assign workouts."
          : "You log your own sets. Your coach still records weight and measurements."}
      </PageIntro>
      <div className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
        <p className="font-display text-2xl">{user.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.role === "coach" ? "Coach" : "Client"} · {user.email}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Home screen</h2>
        {standalone ? (
          <p className="text-base leading-6 text-muted-foreground">
            Repsheet is open full screen from your home screen.
          </p>
        ) : (
          <>
            <p className="text-base leading-6 text-muted-foreground">
              Add Repsheet to your home screen, then open it from the icon. It runs full screen,
              with no app store.
            </p>
            {installPrompt ? (
              <Button
                type="button"
                className={actionClass}
                onClick={() => {
                  void installPrompt.prompt();
                }}
              >
                Add to home screen
              </Button>
            ) : (
              <p className="text-sm leading-5 text-muted-foreground">
                On iPhone, use Share, then Add to Home Screen. On Android, use the browser menu,
                then Install app or Add to Home screen.
              </p>
            )}
          </>
        )}
      </section>

      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className={actionClass}
        onClick={() => {
          signOut();
          router.replace("/");
        }}
      >
        Sign out
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the demo sheet?</DialogTitle>
            <DialogDescription>
              This restores Alex, Jordan, and Sam, and removes anyone you added. Stats and sessions
              you logged on this device go back to the sample sheet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col">
            <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={() => {
                resetDemo();
                setOpen(false);
                setNotice("Demo sheet restored.");
              }}
            >
              Reset demo data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(true)}>
        Reset demo data
      </Button>
    </div>
  );
}
