import { expandUniformSets } from "./migrate";
import type { AppData, Exercise, Session, SessionExercise } from "@/lib/types";

function coachExercise(
  id: string,
  exerciseId: string,
  weightKg: number,
  reps: number,
  sets: number,
): SessionExercise {
  return {
    id,
    exerciseId,
    sets: expandUniformSets(sets, weightKg, reps, (index) => `${id}-set-${index + 1}`),
  };
}

function coachSession(
  id: string,
  clientId: string,
  date: string,
  title: string,
  exercises: SessionExercise[],
): Session {
  return {
    id,
    clientId,
    date,
    title,
    loggedBy: "coach",
    workoutId: null,
    exercises,
  };
}

const exercises: Exercise[] = [
  {
    id: "ex-back-squat",
    name: "Back squat",
    muscle: "Quads, glutes",
    cue: "Brace, sit between your hips, and let the knees track over the toes.",
    videoSrc: "/videos/back-squat.mp4",
    posterSrc: "/videos/back-squat.jpg",
    captionSrc: "/captions/back-squat.vtt",
  },
  {
    id: "ex-bench-press",
    name: "Bench press",
    muscle: "Chest, triceps",
    cue: "Feet planted. The bar travels slightly back toward the rack.",
    videoSrc: "/videos/bench-press.mp4",
    posterSrc: "/videos/bench-press.jpg",
    captionSrc: "/captions/bench-press.vtt",
  },
  {
    id: "ex-romanian-deadlift",
    name: "Romanian deadlift",
    muscle: "Hamstrings",
    cue: "Soft knees, push the hips back, and stop when the hamstrings load.",
    videoSrc: "/videos/romanian-deadlift.mp4",
    posterSrc: "/videos/romanian-deadlift.jpg",
    captionSrc: "/captions/romanian-deadlift.vtt",
  },
  {
    id: "ex-push-up",
    name: "Push-up",
    muscle: "Chest, shoulders",
    cue: "Body in one line. The chest travels toward the floor.",
    videoSrc: "/videos/push-up.mp4",
    posterSrc: "/videos/push-up.jpg",
    captionSrc: "/captions/push-up.vtt",
  },
  {
    id: "ex-bent-over-row",
    name: "Bent-over row",
    muscle: "Back",
    cue: "Hinge first, keep the spine quiet, and pull the elbows toward the hips.",
    videoSrc: "/videos/bent-over-row.mp4",
    posterSrc: "/videos/bent-over-row.jpg",
    captionSrc: "/captions/bent-over-row.vtt",
  },
  {
    id: "ex-walking-lunge",
    name: "Walking lunge",
    muscle: "Quads, glutes",
    cue: "Tall torso. The back knee dips under the hip.",
    videoSrc: "/videos/walking-lunge.mp4",
    posterSrc: "/videos/walking-lunge.jpg",
    captionSrc: "/captions/walking-lunge.vtt",
  },
  {
    id: "ex-plank",
    name: "Plank",
    muscle: "Core",
    cue: "Ribs down. Squeeze the floor apart with your hands.",
    videoSrc: "/videos/plank.mp4",
    posterSrc: "/videos/plank.jpg",
    captionSrc: "/captions/plank.vtt",
  },
  {
    id: "ex-overhead-press",
    name: "Overhead press",
    muscle: "Shoulders",
    cue: "Glutes tight. Finish with the bar over the mid-foot.",
    videoSrc: "/videos/overhead-press.mp4",
    posterSrc: "/videos/overhead-press.jpg",
    captionSrc: "/captions/overhead-press.vtt",
  },
];

export function createSeed(): AppData {
  return {
    users: [
      {
        id: "user-alex",
        name: "Alex Rivera",
        email: "alex@repsheet.app",
        password: "coach",
        role: "coach",
      },
      {
        id: "user-jordan",
        name: "Jordan Hale",
        email: "jordan@repsheet.app",
        password: "jordan",
        role: "client",
        clientId: "client-jordan",
      },
      {
        id: "user-sam",
        name: "Sam Okonkwo",
        email: "sam@repsheet.app",
        password: "sam",
        role: "client",
        clientId: "client-sam",
      },
    ],
    clients: [
      {
        id: "client-jordan",
        name: "Jordan Hale",
        email: "jordan@repsheet.app",
        userId: "user-jordan",
        createdAt: "2026-08-12",
      },
      {
        id: "client-sam",
        name: "Sam Okonkwo",
        email: "sam@repsheet.app",
        userId: "user-sam",
        createdAt: "2026-09-10",
      },
    ],
    measurements: [
      {
        id: "m-jordan-1",
        clientId: "client-jordan",
        date: "2026-08-12",
        weightKg: 74.2,
        chestCm: 98,
        waistCm: 84,
        hipsCm: 99,
        thighCm: 58,
      },
      {
        id: "m-jordan-2",
        clientId: "client-jordan",
        date: "2026-09-02",
        weightKg: 73.5,
        chestCm: 98,
        waistCm: 82,
        hipsCm: 98,
        thighCm: 58,
      },
      {
        id: "m-jordan-3",
        clientId: "client-jordan",
        date: "2026-09-23",
        weightKg: 72.8,
        chestCm: 99,
        waistCm: 81,
        hipsCm: 98,
        thighCm: 57,
      },
      {
        id: "m-sam-1",
        clientId: "client-sam",
        date: "2026-09-10",
        weightKg: 81,
        chestCm: 104,
        waistCm: 90,
        hipsCm: 102,
        thighCm: 62,
      },
      {
        id: "m-sam-2",
        clientId: "client-sam",
        date: "2026-09-28",
        weightKg: 80.2,
        chestCm: 104,
        waistCm: 88,
        hipsCm: 102,
        thighCm: 62,
      },
    ],
    sessions: [
      coachSession("session-jordan-lower", "client-jordan", "2026-09-23", "Lower body", [
        coachExercise("se-1", "ex-back-squat", 100, 5, 3),
        coachExercise("se-2", "ex-romanian-deadlift", 80, 8, 3),
        coachExercise("se-3", "ex-walking-lunge", 16, 10, 3),
      ]),
      coachSession("session-jordan-upper", "client-jordan", "2026-09-30", "Upper body", [
        coachExercise("se-4", "ex-bench-press", 70, 6, 4),
        coachExercise("se-5", "ex-bent-over-row", 60, 8, 3),
        coachExercise("se-6", "ex-overhead-press", 40, 8, 3),
      ]),
      coachSession("session-sam-home", "client-sam", "2026-09-28", "Home circuit", [
        coachExercise("se-7", "ex-push-up", 0, 12, 3),
        coachExercise("se-8", "ex-walking-lunge", 0, 10, 3),
        coachExercise("se-9", "ex-plank", 0, 40, 3),
      ]),
      coachSession("session-jordan-monday", "client-jordan", "2026-10-19", "Strength A", [
        coachExercise("se-10", "ex-back-squat", 100, 5, 4),
        coachExercise("se-11", "ex-bench-press", 70, 6, 4),
      ]),
    ],
    workouts: [
      {
        id: "workout-jordan-a",
        clientId: "client-jordan",
        name: "Strength A",
        assignedAt: "2026-09-30",
        progression: { kind: "linear", incrementKg: 2.5, stallSessions: 3 },
        moves: [
          { id: "wm-1", exerciseId: "ex-back-squat", sets: 4, reps: "5", progression: null, targetOverride: null },
          { id: "wm-2", exerciseId: "ex-bench-press", sets: 4, reps: "6", progression: null, targetOverride: null },
          { id: "wm-3", exerciseId: "ex-bent-over-row", sets: 3, reps: "8", progression: null, targetOverride: null },
          {
            id: "wm-4",
            exerciseId: "ex-plank",
            sets: 3,
            reps: "40 sec",
            progression: { kind: "none" },
            targetOverride: null,
          },
        ],
      },
      {
        id: "workout-sam-home",
        clientId: "client-sam",
        name: "Home circuit",
        assignedAt: "2026-09-28",
        progression: { kind: "none" },
        moves: [
          { id: "wm-5", exerciseId: "ex-push-up", sets: 3, reps: "12", progression: null, targetOverride: null },
          { id: "wm-6", exerciseId: "ex-walking-lunge", sets: 3, reps: "10 each", progression: null, targetOverride: null },
          { id: "wm-7", exerciseId: "ex-plank", sets: 3, reps: "40 sec", progression: null, targetOverride: null },
        ],
      },
    ],
    plans: [
      {
        clientId: "client-jordan",
        days: {
          1: "workout-jordan-a",
          3: "workout-jordan-a",
          5: "workout-jordan-a",
        },
      },
      {
        clientId: "client-sam",
        days: {
          2: "workout-sam-home",
          4: "workout-sam-home",
          6: "workout-sam-home",
        },
      },
    ],
    overrides: [],
    weekStartsOn: "monday",
    exercises,
  };
}
