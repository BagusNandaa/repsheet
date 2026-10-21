import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("streak and heatmap dates hold ahead of UTC and across daylight saving", () => {
  if (process.env.REPSHEET_TZ_CHILD === "1") return;
  for (const tz of ["Pacific/Auckland", "America/New_York", "Pacific/Chatham"]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "src/lib/activity.test.ts"], {
      cwd: root,
      env: { ...process.env, TZ: tz, REPSHEET_TZ_CHILD: "1" },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${tz} exited ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
});
