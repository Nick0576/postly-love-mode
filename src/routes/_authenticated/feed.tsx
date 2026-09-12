import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, currentUserId, type PostRow } from "@/lib/postly";
import { applyTheme, loadThemeFromDatabase } from "@/lib/theme";

const PAGE = 10;

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Home Feed — Postly" },
      { name: "description", content: "See the latest posts from people you follow on Postly." },
      { property: "og:title", content: "Home Feed — Postly" },
      { property: "og:description", content: "See the latest posts on Postly." },
    ],
  }),
  component: Feed,
});

function Feed() {
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["feed"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE - 1);
      if (error) throw error;
      return (data ?? []) as unknown as PostRow[];
    },
    getNextPageParam: (last, all) => (last.length < PAGE ? undefined : all.length * PAGE),
  });

  useEffect(() => {
    loadThemeFromDatabase().then((dbTheme) => {
      if (dbTheme) applyTheme(dbTheme);
    });
    currentUserId()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("posts").delete().eq("id", id).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = data?.pages.flat() ?? [];

  return (
    <AppShell title="Postly">
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && posts.length === 0 && (
          <p className="text-sm text-muted-foreground">No posts yet. Be the first to post.</p>
        )}
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onDelete={
              p.user_id === me
                ? () => {
                    if (confirm("Delete this post?")) remove.mutate(p.id);
                  }
                : undefined
            }
          />
        ))}
        <div ref={sentinel} className="h-8" />
        {isFetchingNextPage && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
      </div>
    </AppShell>
  );
}
