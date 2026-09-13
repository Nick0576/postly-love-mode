import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type GifItem = { id: string; title: string; url: string };

export const searchGifs = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ q: z.string().max(100), cid: z.string().max(64) }).parse(data))
  .handler(async ({ data }): Promise<GifItem[]> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const klipyKey = process.env["KLIPY_API_KEY"];
    if (!lovableKey || !klipyKey) throw new Error("GIF service is not configured");

    const endpoint = data.q.trim() ? "search" : "trending";
    const params = new URLSearchParams({ customer_id: data.cid, per_page: "24" });
    if (data.q.trim()) params.set("q", data.q.trim());

    const res = await fetch(`https://connector-gateway.lovable.dev/klipy/gifs/${endpoint}?${params}`, {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": klipyKey },
    });
    if (!res.ok) throw new Error(`GIF request failed [${res.status}]: ${await res.text()}`);
    const json = await res.json();
    if (!json.result) throw new Error("GIF request failed");
    const items = (json.data?.data ?? []) as Array<{
      id: number | string;
      title?: string;
      file?: Record<string, Record<string, { url?: string } | undefined> | undefined>;
    }>;
    return items
      .map((it) => ({
        id: String(it.id),
        title: it.title ?? "GIF",
        url:
          it.file?.["md"]?.["gif"]?.url ??
          it.file?.["sm"]?.["gif"]?.url ??
          it.file?.["md"]?.["webp"]?.url ??
          it.file?.["hd"]?.["gif"]?.url ??
          "",
      }))
      .filter((g) => g.url);
  });
