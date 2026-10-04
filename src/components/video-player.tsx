"use client";

import { useState } from "react";
import type { Exercise } from "@/lib/types";

export function VideoPlayer({ exercise }: { exercise: Exercise }) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm text-muted-foreground">
        Example clip. Placeholder footage, not a coaching film.
      </figcaption>
      <video
        key={exercise.id}
        className="aspect-video w-full rounded-xl bg-[#1a1814]"
        controls
        playsInline
        preload="metadata"
        poster={exercise.posterSrc}
        aria-label={`Example clip for ${exercise.name}`}
        onError={() => setFailed(true)}
      >
        <source src={exercise.videoSrc} type="video/mp4" />
        <track
          kind="captions"
          src={exercise.captionSrc}
          srcLang="en"
          label="English"
        />
        This browser cannot play the example clip.
      </video>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          This example clip did not load. Check the connection and try the play
          control again.
        </p>
      ) : null}
    </figure>
  );
}
