# Repsheet

A progressive web app for one fitness coach and their clients. The coach logs body stats and assigns workouts. Clients log their own workouts set by set (decision 2026-10-21). Each move uses a built-in example video.

Sheets are saved in the browser on this device. There is no server account and nothing is deployed.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

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

- One coach can add a client, log weight and measurements, log a session, and assign a workout.
- Clients log their own sets (decision 2026-10-21). A session stores who logged it, coach or client, and an optional link to the assigned workout.
- Each exercise in a session is stored as one row per set: weight, reps, done, warm-up, and completed time.
- The coach session form still takes one weight, one rep count, and a set count. Saving writes that many matching set rows.
- A client opens an assigned workout and logs each set. Weight and reps start from their last session for that exercise, or from the workout target when they have not logged it before. 0 kg means bodyweight. Marking a set done starts a 90 second rest.
- A client can see stats and session history, open an assigned workout, and play each move's example video.
- Coach and client share the same built-in video library.
- The eight clips are short placeholders with a play control, labeled as example clips.

## Saved on this device

The current sheet is `repsheet.v2` with `version: 2`. A browser that still has `repsheet.v1` is migrated the next time the app opens. `repsheet.v2` is written first, then `repsheet.v1` is removed. If both keys exist, `repsheet.v2` is the sheet. No stored key means the demo seed.

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

## Backup

On **You**, download a JSON file of every `repsheet.*` value in this browser, or restore one. The file has `schemaVersion` and `exportedAt`. `schemaVersion` 1 is the current envelope. A file that is still a raw v1 or v2 sheet, with no envelope, is an older backup. Import runs the same v1-to-v2 migration the app uses on startup, then checks the result.

Known fields are checked against the current sheet. Extra fields and extra `repsheet.*` keys are kept, so a later weekly plan, e1RM, or progression rule can round-trip without a change to this backup. A file that breaks a known field, or that was written by a newer backup envelope, is refused and does not change this device.

Merge matches any list of records by `id`, including lists this version does not know about. The record in the file replaces the record on the device with that id. Nested rows, such as sets and workout moves, stay inside that record and are not matched on their own. Records only on the device stay. Records only in the file are added. Merging the same file again changes nothing. Other values in the file replace the device value for that key. Keys only on the device stay. Merge does not change who is signed in when this device already has someone signed in.

Replace makes this device's `repsheet.*` keys match the file after migration. Keys that are not in the file are removed.

## Out of scope

Coach-uploaded clips, YouTube links, payments, a native app, and deployment.
