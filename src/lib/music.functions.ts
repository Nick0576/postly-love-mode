import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MusicResult = {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
};

const PIPED_HOSTS = [
  "https://api.piped.private.coffee",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
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

// Search YouTube directly (no API key needed) by parsing the embedded
// ytInitialData payload. The "sp=EgIQAQ" filter restricts results to songs.
async function searchYouTubeSongs(q: string): Promise<MusicResult[]> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const marker = "var ytInitialData = ";
    const idx = html.indexOf(marker);
    if (idx === -1) return [];
    const start = idx + marker.length;
    const end = html.indexOf(";</script>", start);
    if (end === -1) return [];

    let data: any;
    try {
      data = JSON.parse(html.slice(start, end));
    } catch {
      return [];
    }

    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents ?? [];

    const results: MusicResult[] = [];
    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents ?? [];
      for (const c of items) {
        const v = c?.videoRenderer;
        if (!v?.videoId) continue;
        results.push({
          videoId: String(v.videoId),
          title: String((v.title?.runs ?? []).map((r: any) => r.text).join("") || "Untitled"),
          author: String((v.ownerText?.runs ?? []).map((r: any) => r.text).join("") || ""),
          thumbnail: String(
            v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url ?? "",
          ),
        });
      }
    }
    return results.slice(0, 24);
  } catch {
    return [];
  }
}

async function searchPiped(q: string): Promise<MusicResult[]> {
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
  return [];
}

export const searchMusic = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ q: z.string().max(100) }).parse(data))
  .handler(async ({ data }): Promise<MusicResult[]> => {
    const q = data.q.trim();
    if (!q) return [];

    const fromYoutube = await searchYouTubeSongs(q);
    if (fromYoutube.length) return fromYoutube;

    return searchPiped(q);
  });