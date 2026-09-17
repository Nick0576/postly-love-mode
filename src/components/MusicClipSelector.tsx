import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/utils";
import type { MusicPick } from "./MusicPicker";

export type MusicClipPick = MusicPick & {
  clipStart: number;
  clipEnd: number;
};

export function MusicClipSelector({
  onPick,
  defaultStart = 0,
  defaultEnd = 30,
}: {
  onPick: (m: MusicClipPick) => void;
  defaultStart?: number;
  defaultEnd?: number;
}) {
  const [videoId, setVideoId] = useState("");
  const [title, setTitle] = useState("");
  const [clipStart, setClipStart] = useState(defaultStart);
  const [clipEnd, setClipEnd] = useState(defaultEnd);
  const [duration, setDuration] = useState(0);
  const [showClipSettings, setShowClipSettings] = useState(false);

  function extractId(input: string): string | null {
    const m = input.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
    return m ? m[1]! : /^[\w-]{11}$/.test(input.trim()) ? input.trim() : null;
  }

  function handleVideoIdChange() {
    const id = extractId(videoId);
    if (id) {
      setVideoId(id);
      setShowClipSettings(true);
      // Reset clip settings
      setClipStart(defaultStart);
      setClipEnd(defaultEnd);
    }
  }

  function handleSubmit() {
    if (!videoId) return;
    onPick({
      videoId,
      title: title || videoId,
      clipStart,
      clipEnd,
    });
  }

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="space-y-2">
        <Label htmlFor="musicUrl">YouTube URL or Video ID</Label>
        <Input
          id="musicUrl"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          placeholder="https://youtu.be/dQw4w9WgXcQ or dQw4w9WgXcQ"
          onBlur={handleVideoIdChange}
        />
        {showClipSettings && (
          <div className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="musicTitle">Song Title (optional)</Label>
              <Input
                id="musicTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter song title"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Clip Selection</Label>
                <span className="text-sm text-muted-foreground">
                  {formatTime(clipStart)} - {formatTime(clipEnd)}
                </span>
              </div>

              <div className="space-y-2">
                <Label>Start Time: {formatTime(clipStart)}</Label>
                <Slider
                  min={0}
                  max={duration || 300}
                  step={1}
                  value={[clipStart]}
                  onValueChange={([value]) => setClipStart(value)}
                  onMouseUp={() => {
                    if (clipEnd <= clipStart) {
                      setClipEnd(clipStart + 30);
                    }
                  }}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>End Time: {formatTime(clipEnd)}</Label>
                <Slider
                  min={clipStart + 1}
                  max={duration || 300}
                  step={1}
                  value={[clipEnd]}
                  onValueChange={([value]) => setClipEnd(value)}
                  className="w-full"
                />
              </div>

              <div className="text-xs text-muted-foreground">
                <p>Select a 10-60 second clip from the song.</p>
                <p>Viewers will hear only this section when they see your bubble.</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setClipStart(0);
                  setClipEnd(30);
                }}
              >
                Reset to 30s
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={!videoId}
              >
                Add to Bubble
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
