import assert from "node:assert/strict";
import test from "node:test";
import { readSheetParams } from "./static-params.ts";

test("reads ids from static-hosted dynamic paths", () => {
  assert.deepEqual(readSheetParams("/exercises/ex-back-squat"), { id: "ex-back-squat" });
  assert.deepEqual(readSheetParams("/library/ex-bench-press/"), { id: "ex-bench-press" });
  assert.deepEqual(readSheetParams("/workouts/workout-jordan-a"), { id: "workout-jordan-a" });
  assert.deepEqual(readSheetParams("/workouts/workout-jordan-a/session"), {
    id: "workout-jordan-a",
  });
  assert.deepEqual(readSheetParams("/coach/clients/client-jordan"), { id: "client-jordan" });
  assert.deepEqual(readSheetParams("/coach/clients/client-jordan/measure"), {
    id: "client-jordan",
  });
  assert.deepEqual(readSheetParams("/coach/clients/client-jordan/workout"), {
    id: "client-jordan",
  });
  assert.deepEqual(readSheetParams("/coach/clients/client-jordan/session/"), {
    id: "client-jordan",
  });
  assert.deepEqual(
    readSheetParams("/coach/clients/client-jordan/exercises/ex-back-squat"),
    { id: "client-jordan", exerciseId: "ex-back-squat" },
  );
});

test("decodes path segments and ignores other routes", () => {
  assert.deepEqual(readSheetParams("/exercises/id%20with%20space"), { id: "id with space" });
  assert.deepEqual(readSheetParams("/home"), {});
  assert.deepEqual(readSheetParams("/coach/clients/new"), { id: "new" });
  assert.deepEqual(readSheetParams("/exercises"), {});
  assert.deepEqual(readSheetParams("/exercises/%E0%A4%A"), {});
});
