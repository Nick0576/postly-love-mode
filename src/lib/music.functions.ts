import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MusicResult = {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
};

const PIPED_HOSTS = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
];

const INVIDIOUS_HOSTS = [
  "https://inv.nadeko.net",
  "https://yewtu.be",
  "https://invidious.nerdvpn.de",
];

async function fetchJson(url: string, ms = 6000): Promise<any | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(ms),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function idFromUrl(url: string | undefined): string {
  if (!url) return "";
  const m = url.match(/[?&]v=([\w-]{11})/);
  return m?.[1] ?? "";
}

export const searchMusic = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ q: z.string().max(100) }).parse(data))
  .handler(async ({ data }): Promise<MusicResult[]> => {
    const q = data.q.trim();
    if (!q) return [];

    // Try Piped API first (already filters for music_songs)
    for (const host of PIPED_HOSTS) {
      const json = await fetchJson(
        `${host}/search?q=${encodeURIComponent(q)}&filter=music_songs`,
      );
      const items = Array.isArray(json?.items) ? json.items : [];
      const mapped: MusicResult[] = items
        .map((r: any) => ({
          videoId: idFromUrl(r?.url),
          title: String(r?.title ?? "Untitled"),
          author: String(r?.uploaderName ?? ""),
          thumbnail: String(r?.thumbnail ?? ""),
        }))
        .filter((r: MusicResult) => r.videoId)
        .slice(0, 24);
      if (mapped.length) return mapped;
    }

    // Fallback to YouTube Music API if available, or filter video results for music
    // Try searching with music-related keywords to get better results
    const musicKeywords = ["official", "audio", "lyrics", "music video", "official video"];
    const searchQueries = [q, ...musicKeywords.map(kw => `${q} ${kw}`)].filter(Boolean);

    for (const query of searchQueries) {
      for (const host of PIPED_HOSTS) {
        const json = await fetchJson(
          `${host}/search?q=${encodeURIComponent(query)}&filter=music_songs`,
        );
        const items = Array.isArray(json?.items) ? json.items : [];
        const mapped: MusicResult[] = items
          .map((r: any) => ({
            videoId: idFromUrl(r?.url),
            title: String(r?.title ?? "Untitled"),
            author: String(r?.uploaderName ?? ""),
            thumbnail: String(r?.thumbnail ?? ""),
          }))
          .filter((r: MusicResult) => r.videoId)
          .slice(0, 24);
        if (mapped.length) return mapped;
      }
    }

    return [];
  });
