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

export function YouTubeMusicPlayer({
  videoId,
  title,
  autoplay = true,
}: {
  videoId: string;
  title?: string | null;
  autoplay?: boolean;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let mount: HTMLDivElement | null = null;
    (async () => {
      const YT = await loadYT();
      if (cancelled || !holderRef.current) return;
      mount = document.createElement("div");
      holderRef.current.appendChild(mount);
      playerRef.current = new YT.Player(mount, {
        videoId,
        width: "0",
        height: "0",
        playerVars: { autoplay: autoplay ? 1 : 0, controls: 0, playsinline: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: (e: any) => {
            setReady(true);
            setDuration(e.target.getDuration() || 0);
            if (autoplay) {
              e.target.playVideo();
            }
          },
          onStateChange: (e: any) => {
            const s = e.data;
            setPlaying(s === YT.PlayerState.PLAYING);
            if (s === YT.PlayerState.PLAYING || s === YT.PlayerState.PAUSED) {
              setDuration(e.target.getDuration() || 0);
            }
          },
        },
      });
    })();
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch { /* noop */ }
      playerRef.current = null;
    };
  }, [videoId, autoplay]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (p?.getCurrentTime) {
        setCurrent(p.getCurrentTime() || 0);
        const d = p.getDuration() || 0;
        if (d) setDuration(d);
      }
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  function toggle() {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  }

  return (
    <div className="w-full rounded-2xl border bg-card p-3 shadow-soft">
      <div ref={holderRef} style={{ width: 0, height: 0, overflow: "hidden" }} />
      {title && <p className="mb-2 truncate text-sm font-medium">🎵 {title}</p>}
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
          max={duration || 1}
          step={0.1}
          value={Math.min(current, duration || 0)}
          onChange={(e) => {
            const t = Number(e.target.value);
            setCurrent(t);
            playerRef.current?.seekTo(t, true);
          }}
          disabled={!ready || !duration}
          className="flex-1 accent-primary"
          aria-label="Seek"
        />
        <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
          {fmt(current)} / {fmt(duration)}
        </span>
      </div>
    </div>
  );
}
