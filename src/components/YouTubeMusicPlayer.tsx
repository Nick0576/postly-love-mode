import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYT(): Promise<any> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(s);
    }
  });
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Preview window starts in the middle of the song rather than at the start.
function midStart(d: number): number {
  if (!d) return 0;
  return Math.min(d / 2, Math.max(0, d - 1));
}

export function YouTubeMusicPlayer({
  videoId,
  title,
  autoplay = true,
  previewDuration,
  clipStart,
  clipEnd,
  hideControls = false,
  noSeek = false,
}: {
  videoId: string;
  title?: string | null;
  autoplay?: boolean;
  previewDuration?: number;
  clipStart?: number | null;
  clipEnd?: number | null;
  hideControls?: boolean;
  noSeek?: boolean;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const previewEndRef = useRef<number | null>(null);
  const clipStartRef = useRef<number | null>(clipStart || null);
  const clipEndRef = useRef<number | null>(clipEnd || null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  const isPreview = typeof previewDuration === "number" && previewDuration > 0;
  const hasClip = typeof clipStart === "number" && typeof clipEnd === "number";

  function previewStartFor(d: number): number {
    return midStart(d);
  }

  // Start a preview window of `previewDuration` seconds from `startTime`.
  function playFrom(startTime: number) {
    const p = playerRef.current;
    if (!p) return;
    const d = p.getDuration?.() || duration || 0;
    const start = Math.max(0, d ? Math.min(startTime, Math.max(0, d - 0.5)) : startTime);
    previewEndRef.current = isPreview ? start + (previewDuration as number) : null;
    p.seekTo(start, true);
    setCurrent(start);
    p.playVideo();
  }

  function toggle() {
    const p = playerRef.current;
    if (!p) return;
    if (playing) {
      p.pauseVideo();
      return;
    }
    if (isPreview) {
      const end = previewEndRef.current;
      if (noSeek) {
        // Locked preview: always replay the same window from the middle.
        if (end === null || current >= end - 0.2) playFrom(previewStartFor(duration));
        else p.playVideo();
      } else if (end === null || current >= end - 0.2) {
        // Restart a fresh preview window when the last one finished.
        playFrom(current);
      } else {
        p.playVideo();
      }
    } else if (hasClip) {
      // For clips, seek to start and play
      p.seekTo(clipStartRef.current || 0, true);
      p.playVideo();
    } else {
      p.playVideo();
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const YT = await loadYT();
      if (cancelled || !holderRef.current) return;
      const mount = document.createElement("div");
      holderRef.current.appendChild(mount);
      playerRef.current = new YT.Player(mount, {
        videoId,
        width: "0",
        height: "0",
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: 0,
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
          start: !isPreview && hasClip ? clipStartRef.current : undefined,
          end: !isPreview && hasClip ? clipEndRef.current : undefined,
        },
        events: {
          onReady: (e: any) => {
            setReady(true);
            const d = e.target.getDuration?.() || 0;
            setDuration(d);
            if (autoplay) {
              if (isPreview) {
                const start = previewStartFor(d);
                previewEndRef.current = start + (previewDuration as number);
                e.target.seekTo(start, true);
                setCurrent(start);
                e.target.playVideo();
              } else if (hasClip) {
                e.target.seekTo(clipStartRef.current || 0, true);
                e.target.playVideo();
              } else {
                e.target.playVideo();
              }
            }
          },
          onStateChange: (e: any) => {
            setPlaying(e.data === YT.PlayerState.PLAYING);
            const d = e.target.getDuration?.() || 0;
            if (d) setDuration(d);
          },
        },
      });
    })();
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch { /* noop */ }
      playerRef.current = null;
    };
  }, [videoId, autoplay, isPreview, hasClip]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      const t = p.getCurrentTime() || 0;
      setCurrent(t);
      const d = p.getDuration?.() || 0;
      if (d) setDuration(d);
      const end = previewEndRef.current;
      // The preview window is `previewDuration` seconds long; pause at its end.
      if (isPreview && end !== null && t >= end) {
        p.pauseVideo();
      }
      // Auto-pause if we reach clip end
      if (!isPreview && hasClip && clipEndRef.current !== null && t >= clipEndRef.current) {
        p.pauseVideo();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [isPreview, hasClip]);

  const end = previewEndRef.current;
  const inPreview = isPreview && end !== null;
  const windowStart = inPreview ? end - (previewDuration as number) : 0;
  const windowPos = inPreview
    ? Math.max(0, Math.min(previewDuration as number, current - windowStart))
    : current;
  const remaining = inPreview
    ? Math.max(0, (previewDuration as number) - windowPos)
    : 0;
  // In locked-preview mode the bar represents only the allowed window so the
  // song cannot be scrubbed past the 30s limit.
  const barMax = noSeek && isPreview ? Math.max(0.5, previewDuration as number) : duration || 1;

  return (
    <div className="w-full rounded-2xl border bg-card p-3 shadow-soft">
      <div ref={holderRef} style={{ width: 0, height: 0, overflow: "hidden" }} />
      {title && <p className="mb-2 truncate text-sm font-medium">🎵 {title}</p>}
      {hasClip && !isPreview && (
        <div className="mb-2 text-xs text-muted-foreground">
          Clip: {fmt(clipStartRef.current || 0)} - {fmt(clipEndRef.current || 0)}
        </div>
      )}
      {isPreview && !hideControls && (
        <div className="mb-2 text-xs text-muted-foreground">
          {noSeek
            ? `${previewDuration}s preview · ${Math.ceil(remaining)}s left`
            : `${previewDuration}s preview — drag anywhere to preview that part · ${Math.ceil(remaining)}s left`}
        </div>
      )}
      {!hideControls && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            disabled={!ready}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={barMax}
            step={0.1}
            value={Math.min(windowPos, barMax)}
            onChange={(e) => {
              const t = Number(e.target.value);
              if (noSeek) return;
              setCurrent(t);
              if (isPreview) playFrom(t);
              else playerRef.current?.seekTo(t, true);
            }}
            disabled={!ready || !duration || noSeek}
            className="flex-1 accent-primary"
            aria-label="Seek"
          />
          <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
            {fmt(windowPos)} / {fmt(barMax)}
          </span>
        </div>
      )}
    </div>
  );
}