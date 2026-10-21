import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("calendar dates hold ahead of UTC and across a daylight-saving fall-back", () => {
  if (process.env.REPSHEET_TZ_CHILD === "1") return;
  const files = ["src/lib/schedule.test.ts", "src/lib/week-strip.test.ts"];
  for (const tz of ["Pacific/Auckland", "America/New_York", "Pacific/Chatham"]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
      cwd: root,
      env: { ...process.env, TZ: tz, REPSHEET_TZ_CHILD: "1" },
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      `${tz} exited ${result.status}\n${result.stdout}\n${result.stderr}`,
    );
  }
});
