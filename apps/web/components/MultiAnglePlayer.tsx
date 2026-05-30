"use client";

import type { Clip } from "@openeyes/shared";
import { useRef, useState } from "react";
import { API_URL } from "@/lib/config";

/**
 * The differentiator: several confirmed angles of one event, played in sync.
 * A single transport bar drives every <video> at once, so the audio lines up
 * and you can see the same moment from every uploader's phone.
 *
 * Media is streamed from the API (`GET /clips/{id}/media` proxies a presigned
 * S3 URL). Until the backend is live this shows placeholders.
 */
export function MultiAnglePlayer({ clips }: { clips: Clip[] }) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [playing, setPlaying] = useState(false);

  function eachVideo(fn: (v: HTMLVideoElement) => void) {
    for (const v of videoRefs.current) if (v) fn(v);
  }

  function toggle() {
    if (playing) {
      eachVideo((v) => v.pause());
    } else {
      // Re-sync every angle to the lead clip's position before playing.
      const lead = videoRefs.current[0];
      const t = lead?.currentTime ?? 0;
      eachVideo((v) => {
        v.currentTime = t;
        void v.play();
      });
    }
    setPlaying(!playing);
  }

  function restart() {
    eachVideo((v) => {
      v.currentTime = 0;
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {clips.map((clip, i) => (
          <div
            key={clip.id}
            className="border-edge bg-surface relative aspect-video overflow-hidden rounded-xl border"
          >
            <video
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              className="size-full object-cover"
              // First clip carries the audio; mute the rest to avoid echo.
              muted={i !== 0}
              playsInline
              preload="metadata"
              src={`${API_URL}/clips/${clip.id}/media`}
            />
            <span className="bg-ink/70 absolute left-2 top-2 rounded px-2 py-0.5 text-xs">
              angle {i + 1} · {clip.deviceId}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={toggle}
          className="bg-eye rounded-full px-5 py-2 text-sm font-medium text-black"
        >
          {playing ? "Pause all" : "Play all in sync"}
        </button>
        <button
          onClick={restart}
          className="border-edge text-mist rounded-full border px-5 py-2 text-sm hover:text-white"
        >
          Restart
        </button>
        <span className="text-mist text-xs">
          One transport drives every angle — audio confirms they share the same
          moment.
        </span>
      </div>
    </div>
  );
}
