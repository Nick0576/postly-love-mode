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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Middle of the song: where a preview should start playing.
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
}: {
  videoId: string;
  title?: string | null;
  autoplay?: boolean;
  previewDuration?: number;
  clipStart?: number | null;
  clipEnd?: number | null;
  hideControls?: boolean;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const previewStartRef = useRef<number>(0);
  const previewEndRef = useRef<number | null>(null);
  const clipStartRef = useRef<number | null>(clipStart || null);
  const clipEndRef = useRef<number | null>(clipEnd || null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  const isPreview = typeof previewDuration === "number" && previewDuration > 0;
  const hasClip = typeof clipStart === "number" && typeof clipEnd === "number";
  const windowLen = isPreview ? Math.max(1, previewDuration as number) : 1;

  // The playable window: a `previewDuration`-wide slice centered on the
  // middle of the song, so both the start and the end of the track are cut
  // off. `d` is the full song length in seconds.
  function windowBounds(d: number): { start: number; end: number } {
    const safe = Number.isFinite(d) && d > 0 ? d : duration;
    if (!safe) return { start: 0, end: windowLen };
    const center = midStart(safe);
    let start = clamp(center - windowLen / 2, 0, Math.max(0, safe - windowLen));
    let end = start + windowLen;
    if (end > safe) end = safe;
    start = Math.max(0, Math.min(start, end - 0.5));
    return { start, end };
  }

  // Start playback at the middle, inside the allowed window.
  function playFromMiddle() {
    const p = playerRef.current;
    if (!p) return;
    const d = p.getDuration?.() || duration || 0;
    const { start, end } = windowBounds(d);
    previewStartRef.current = start;
    previewEndRef.current = end;
    const seek = midStart(d);
    p.seekTo(clamp(seek, start, Math.max(start, end - 0.5)), true);
    setCurrent(clamp(seek, start, Math.max(start, end - 0.5)));
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
      if (end === null || current >= end - 0.2) {
        playFromMiddle();
      } else {
        p.playVideo();
      }
    } else if (hasClip) {
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
                const { start, end } = windowBounds(d);
                previewStartRef.current = start;
                previewEndRef.current = end;
                const seek = midStart(d);
                e.target.seekTo(clamp(seek, start, Math.max(start, end - 0.5)), true);
                setCurrent(clamp(seek, start, Math.max(start, end - 0.5)));
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
      // Pause at the end of the preview window so the whole song never plays.
      const end = previewEndRef.current;
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

  const previewStart = previewStartRef.current;
  const previewEnd = previewEndRef.current;
  const inPreview = isPreview && previewEnd !== null;
  const windowPos = inPreview
    ? Math.max(0, Math.min(windowLen, current - previewStart))
    : current;
  const remaining = inPreview ? Math.max(0, windowLen - windowPos) : 0;
  const barMin = inPreview ? previewStart : 0;
  const barMax = inPreview ? Math.max(previewEnd, previewStart + 0.5) : duration || 1;

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
          {previewDuration}s preview · {Math.ceil(remaining)}s left
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
            min={barMin}
            max={barMax}
            step={0.1}
            value={clamp(current, barMin, barMax)}
            onChange={(e) => {
              const t = Number(e.target.value);
              setCurrent(t);
              if (isPreview) {
                // Stay inside the middle window; seeking elsewhere is barred.
                const end = previewEndRef.current;
                if (end !== null && t >= end - 0.1) {
                  playerRef.current?.seekTo(Math.max(previewStart, end - 0.5), true);
                  return;
                }
                playerRef.current?.seekTo(t, true);
              } else {
                playerRef.current?.seekTo(t, true);
              }
            }}
            disabled={!ready || !duration}
            className="flex-1 accent-primary"
            aria-label="Seek"
          />
          <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
            {fmt(windowPos)} / {fmt(inPreview ? windowLen : barMax)}
          </span>
        </div>
      )}
    </div>
  );
}