import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Music } from "lucide-react";

export type MusicPick = { videoId: string; title: string };

type PipedItem = { url?: string; title?: string; thumbnail?: string; uploaderName?: string };

const PIPED_HOSTS = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.leptons.xyz",
];

function extractId(input: string): string | null {
  const m = input.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1]! : /^[\w-]{11}$/.test(input.trim()) ? input.trim() : null;
}

export function MusicPicker({ onPick }: { onPick: (m: MusicPick) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PipedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const query = q.trim();
    if (!query) return;
    setError(null);

    const id = extractId(query);
    if (id) {
      onPick({ videoId: id, title: query });
      return;
    }

    setLoading(true);
    setItems([]);
    for (const host of PIPED_HOSTS) {
      try {
        const res = await fetch(`${host}/search?q=${encodeURIComponent(query)}&filter=music_songs`);
        if (!res.ok) continue;
        const json = await res.json();
        const list = (json.items ?? []) as PipedItem[];
        if (list.length) {
          setItems(list.slice(0, 20));
          setLoading(false);
          return;
        }
      } catch {
        // try next host
      }
    }
    setLoading(false);
    setError("Search unavailable — paste a YouTube link instead.");
  }

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search music or paste YouTube link"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <Button type="button" onClick={() => void search()} disabled={loading}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {loading && <p className="text-xs text-muted-foreground">Searching…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {items.length > 0 && (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {items.map((r) => {
            const vid = r.url?.split("v=")[1]?.split("&")[0] ?? "";
            if (!vid) return null;
            return (
              <li key={vid}>
                <button
                  type="button"
                  onClick={() => onPick({ videoId: vid, title: r.title ?? "Untitled" })}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted"
                >
                  {r.thumbnail ? (
                    <img src={r.thumbnail} alt="" className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                      <Music className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.uploaderName}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
