"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, actionClass } from "@/components/sheet-ui";
import {
  applyImport,
  backupFilename,
  browserStorage,
  exportBackup,
  prepareImport,
  serializeBackup,
  type BackupSummary,
  type PreparedBackup,
} from "@/lib/backup";
import { SESSION_KEY, STORAGE_KEY_V2, persistedSheet } from "@/lib/migrate";
import { useStore } from "@/lib/store";

function exportedLabel(exportedAt: string | null) {
  if (!exportedAt) {
    return "This file has no export time. It will be migrated to the current sheet.";
  }
  const date = new Date(exportedAt);
  if (Number.isNaN(date.getTime())) return `Exported ${exportedAt}.`;
  const formatted = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
  return `Exported ${formatted} UTC.`;
}

function countLine(summary: BackupSummary) {
  const parts = [
    [summary.clients, "client", "clients"],
    [summary.workouts, "workout", "workouts"],
    [summary.sessions, "session", "sessions"],
    [summary.measurements, "measurement", "measurements"],
    [summary.users, "person", "people"],
  ] as const;
  return parts
    .map(([count, singular, plural]) => `${count} ${count === 1 ? singular : plural}`)
    .join(" · ");
}

export function BackupControls() {
  const { data, user } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedBackup | null>(null);

  function onExport() {
    try {
      if (data && localStorage.getItem(STORAGE_KEY_V2) === null) {
        localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(persistedSheet(data)));
      }
      if (user && localStorage.getItem(SESSION_KEY) === null) {
        localStorage.setItem(SESSION_KEY, user.id);
      }
      const file = exportBackup(browserStorage(), new Date());
      const blob = new Blob([serializeBackup(file)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = backupFilename(file.exportedAt);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setError("Could not read the sheet on this device.");
    }
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = prepareImport(text);
      if (!result.ok) {
        setPrepared(null);
        setError(result.error);
        return;
      }
      setError(null);
      setPrepared(result.backup);
    };
    reader.onerror = () => {
      setPrepared(null);
      setError("Could not read that file. Nothing was changed.");
    };
    reader.readAsText(file);
  }

  function onApply(mode: "merge" | "replace") {
    if (!prepared) return;
    try {
      applyImport(browserStorage(), prepared, mode);
    } catch {
      setError("Could not finish writing the backup on this device.");
      return;
    }
    window.location.reload();
  }

  const otherKeys = prepared?.summary.keys.filter((key) => key !== STORAGE_KEY_V2) ?? [];

  return (
    <section className="flex flex-col gap-3" aria-label="Backup">
      <h2 className="font-display text-2xl">Backup</h2>
      <p className="text-base leading-6 text-muted-foreground">
        Download every Repsheet value stored in this browser, or restore a file. The file includes
        sign-in passwords. Keep it private.
      </p>
      <Button type="button" className={actionClass} onClick={onExport}>
        Download backup
      </Button>
      <Button
        type="button"
        variant="outline"
        className={actionClass}
        onClick={() => fileRef.current?.click()}
      >
        Restore from file
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Backup file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onPick(file);
        }}
      />
      <FormError>{error}</FormError>
      {prepared ? (
        <div className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
          <h3 className="text-base font-medium">Check this file</h3>
          <p className="mt-2 text-sm leading-5 text-foreground">{countLine(prepared.summary)}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {exportedLabel(prepared.summary.exportedAt)}
          </p>
          {otherKeys.length > 0 ? (
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Also in the file: {otherKeys.join(", ")}.
            </p>
          ) : null}
          <p className="mt-3 text-sm leading-5 text-muted-foreground">
            Merge keeps records already on this device and replaces a record when the id matches.
            Importing this file again does not add duplicates. Replace makes this device match the
            file and removes Repsheet data that is not in it.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Button type="button" className={actionClass} onClick={() => onApply("merge")}>
              Merge into this device
            </Button>
            <Button
              type="button"
              variant="destructive"
              className={actionClass}
              onClick={() => onApply("replace")}
            >
              Replace this device
            </Button>
            <Button
              type="button"
              variant="outline"
              className={actionClass}
              onClick={() => {
                setPrepared(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
