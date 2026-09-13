import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchGifs, type GifItem } from "@/lib/gifs.functions";

export function GifPicker({ customerId, onPick }: { customerId: string; onPick: (gif: GifItem) => void }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      searchGifs({ data: { q, cid: customerId } })
        .then((res) => {
          if (!cancelled) setGifs(res);
        })
        .catch(() => {
          if (!cancelled) setGifs([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, customerId]);

  return (
    <div className="fixed inset-x-0 bottom-32 mx-auto max-w-xl rounded-2xl border bg-background p-3 shadow-lg">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs" aria-label="Search GIFs" />
      <div className="mt-2 grid max-h-64 grid-cols-3 gap-1 overflow-y-auto">
        {loading && <p className="col-span-3 py-4 text-center text-xs text-muted-foreground">Loading…</p>}
        {!loading && !gifs.length && <p className="col-span-3 py-4 text-center text-xs text-muted-foreground">No GIFs found</p>}
        {gifs.map((g) => (
          <button key={g.id} onClick={() => onPick(g)} aria-label={g.title}>
            <img src={g.url} alt={g.title} loading="lazy" className="h-24 w-full rounded-lg object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
