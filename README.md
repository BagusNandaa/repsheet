# Repsheet

A progressive web app for one fitness coach and their clients. The coach logs body stats and training sessions, and assigns workouts. Each move uses a built-in example video. Clients can view their sheet and play those videos. They cannot edit the numbers.

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

- One coach can add a client, log weight and measurements, log a session (exercise, weight, reps, sets), and assign a workout.
- A client can see stats and session history, open an assigned workout, and play each move's example video.
- Coach and client share the same built-in video library.
- The eight clips are short placeholders with a play control, labeled as example clips.

## Out of scope

Client logging, coach-uploaded clips, YouTube links, payments, a native app, and deployment.
