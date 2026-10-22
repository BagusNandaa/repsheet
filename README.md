# Repsheet

A progressive web app for one fitness coach and their clients. The coach logs body stats and assigns workouts. Clients log their own workouts set by set (decision 2026-10-21). Each move uses a built-in example video.

Sheets are saved in the browser on this device. There is no server account and nothing is deployed.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

## Tests

```bash
npm test
npm run test:e2e
```

`npm test` runs the unit tests. It does not start the app and does not need Chrome.

`npm run test:e2e` checks that Home, the coach list, You, and a client sheet do not scroll sideways at 320, 360, and 768px. It needs Google Chrome on `PATH`. If nothing is already serving [http://127.0.0.1:43123](http://127.0.0.1:43123), the script starts `next dev` on port 44721.

## Demo sign-in

| Person | Role | Email | Password |
| --- | --- | --- | --- |
| Alex Rivera | Coach | alex@repsheet.app | coach |
| Jordan Hale | Client | jordan@repsheet.app | jordan |
| Sam Okonkwo | Client | sam@repsheet.app | sam |

On the sign-in screen, tap a person to open their sheet. Sign out from **You** to switch.

## On a phone

Use the browser menu to add Repsheet to the home screen, then open it from the icon. It runs full screen. There is no app store install.

- iPhone: Share, then Add to Home Screen.
- Android: browser menu, then Install app or Add to Home screen.

## What is included

- One coach can add a client, log weight and measurements, log a session, assign a workout, and put those workouts on a week.
- A single date can be skipped or moved onto another date. The standing week stays as it is.
- Clients log their own sets (decision 2026-10-21). A session stores who logged it, coach or client, and an optional link to the assigned workout.
- Each exercise in a session is stored as one row per set: weight, reps, done, warm-up, and completed time.
- The coach session form still takes one weight, one rep count, and a set count. Saving writes that many matching set rows.
- A client opens an assigned workout and logs each set. With no progression rule, weight and reps start from their last session for that exercise, or from the workout target when they have not logged it before. When a rule is set, the sets start at the progression target and the screen says why. 0 kg means bodyweight. A set can be marked as a warm-up. Marking a set done starts a 90 second rest.
- A client can see stats and session history, open an assigned workout, and play each move's example video.
- The coach sets a body-weight goal per client. Home shows how far the latest weigh-in is from that goal. The weight chart draws the goal and colours each change by whether it moves closer or farther.
- Home and the client sheet show a year of training days, plus consecutive weeks trained, workouts this week, and the total. Those counts use logged sessions. The week follows the sheet's week-start setting.
- Coach and client share the same built-in video library.
- The eight clips are short placeholders with a play control, labeled as example clips.

## Saved on this device

The current sheet is `repsheet.v2` with `version: 2`. A browser that still has `repsheet.v1` is migrated the next time the app opens. `repsheet.v2` is written first, then `repsheet.v1` is removed. If both keys exist, `repsheet.v2` is the sheet. No stored key means the demo seed.

`goalWeightKg` sits on the client, in kilograms. Null means no goal. A v2 sheet that omits the field still loads, and the goal is treated as unset. The sheet version stays 2. Other client fields are left as stored.

v1 stored one weight, one rep count, and a set count on each exercise. That count is expanded into rows:

- Each row copies that weight and those reps. Values are copied as stored, not rounded.
- `done` is true. The coach had already logged the work.
- `isWarmup` is false. v1 did not mark warm-ups, and these rows should still count for later PRs and progression.
- `completedAt` is null. v1 had a session date and no per-set clock time.
- `loggedBy` is `coach` when the field is missing. A v1 sheet could only be written by the coach. A stored `client` value stays `client`.
- `workoutId` is null when the session has no link. v1 sessions were not linked to an assigned workout.
- A positive integer set count becomes that many rows, up to 100. A missing, zero, fractional, or negative count becomes one row, so the weight and reps are kept.
- Row ids are the exercise entry id plus `-set-1`, `-set-2`, and so on (`se-1-set-1`). A missing entry id becomes `exercise-1` by position.
- Set order is the row order.
- Users, clients, measurements, and assigned workouts are copied unchanged. A workout move still stores a set count and a reps string such as `8` or `40 sec`. Only logged sessions become rows.
- A sheet that is already version 2 is not expanded again. Warm-up flags, done flags, and completed times stay as stored.

Per-set rows are the base for guided sessions, PRs, and progression. Warm-up rows are stored so that math can skip them. `completedAt` is the clock time a client marks a set done.

The rest timer lives beside the sheet, in `repsheet.rest`. A running rest stores the wall-clock time it ends. A paused rest stores the remaining milliseconds. Reload and a sleeping tab both read that record, so the countdown is not a tick count. The session rows themselves stay in `repsheet.v2`.

Each client can have a week plan: a workout id for Sunday (`0`) through Saturday (`6`). A missing weekday is a rest day. `overrides` skip one date, or move that date's planned workout onto another date. The week plan itself is unchanged. A sheet that is already version 2 and has no plan fields keeps its sessions and workouts. Missing `plans` and `overrides` become empty lists. A missing week start becomes Monday.

The week starts on Monday or Sunday. That setting is stored on the sheet. Home uses it for the week strip, the training heatmap, and streaks.

Home shows today's workout, and Start opens the guided session. On a rest day it names the next training day in the following 21 days, after skips and moves. The week strip marks a day done when that date has a logged working set, and planned when the plan plus overrides put a workout there. A day that is both is done. Today is highlighted. Warm-up-only rows do not mark a day done.

Estimated 1RM and personal records are computed from the saved sets. They are not a new stored field. The estimate uses Epley: weight × (1 + reps / 30), including a single. A set counts only when it is marked done, is not a warm-up, has a load above 0 kg, and has 1 to 12 reps. Sets above 12 reps are never used. The estimate names the set it came from (date, weight × reps). When two sets tie, the earlier one is kept: earlier date, then the session saved first, then the earlier set in that session. The other records are the heaviest weight and the most reps at a given weight. While a client logs, a set that strictly beats one of those shows a PR flag. Matching the current best does not. Home and the client sheet both link to an exercise history with the best set and the recent sessions.

An assigned workout can carry a progression rule, and each move can follow that rule or use its own, including None. None leaves the next session on the last logged weight and reps. Linear adds a set amount, 2.5 kg unless the coach changes it, when every done working set hit the move's target reps. Double adds one rep at a time from the bottom of a rep range to the top, then adds that same amount of weight and starts again at the bottom. The coach can also type the next weight and reps. That override is what the client sees until it is cleared.

Warm-up sets are left out of the rule. A session counts only when every working set is marked done. The load is the lightest of those sets. A miss never adds weight. After 3 stalled sessions (the coach can set 1 to 10), the next load drops by 10% of the weight that stalled, rounded to the nearest 0.5 kg, and never above that weight. A load under 5 kg can round back to itself; it then drops 0.5 kg instead. 0 kg stays bodyweight. Double progression also returns to the bottom of the range on a deload. The stall count resets after a deload or a hit. The client sees the target and a short reason, for example `+2.5 kg: all 3×5 hit last time`.

A sheet that is already version 2 and has no rule fields stays on None. Saving writes the rule onto the workout. The version stays 2.


## Backup

On **You**, download a JSON file of every `repsheet.*` value in this browser, or restore one. The file has `schemaVersion` and `exportedAt`. `schemaVersion` 1 is the current envelope. A file that is still a raw v1 or v2 sheet, with no envelope, is an older backup. Import runs the same v1-to-v2 migration the app uses on startup, then checks the result.

Known fields are checked against the current sheet, including a client's `goalWeightKg`. Extra fields and extra `repsheet.*` keys are kept, so a later weekly plan, e1RM, or progression rule can round-trip without a change to this backup. A file that breaks a known field, or that was written by a newer backup envelope, is refused and does not change this device.

Merge matches any list of records by `id`, including lists this version does not know about. The record in the file replaces the record on the device with that id. Nested rows, such as sets and workout moves, stay inside that record and are not matched on their own. Records only on the device stay. Records only in the file are added. Merging the same file again changes nothing. Other values in the file replace the device value for that key. Keys only on the device stay. Merge does not change who is signed in when this device already has someone signed in.

Replace makes this device's `repsheet.*` keys match the file after migration. Keys that are not in the file are removed.


## Out of scope

Coach-uploaded clips, YouTube links, payments, a native app, and deployment.
