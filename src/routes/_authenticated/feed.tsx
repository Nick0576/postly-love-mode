import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, currentUserId, type PostRow, type Story, isStoryExpired } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

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

  const { data: stories } = useQuery({
    queryKey: ["stories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stories")
        .select("*,profiles(*)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(20);
      return data as Story[];
    },
  });

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
    applyTheme(getTheme());
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
        {/* Stories Section */}
        {stories && stories.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            <Link to="/story" className="flex-shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 to-purple-500 p-0.5">
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                      <span className="text-2xl">+</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs">Add Story</span>
              </div>
            </Link>
            {stories.filter(s => !isStoryExpired(s)).map((story) => (
              <Link
                key={story.id}
                to="/story/view/$storyId"
                params={{ storyId: story.id }}
                className="flex-shrink-0"
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 to-purple-500 p-0.5">
                      <Avatar
                        url={story.profiles?.avatar_url}
                        name={story.profiles?.display_name || story.profiles?.username}
                        size={60}
                        className="rounded-full"
                      />
                    </div>
                  </div>
                  <span className="text-xs truncate w-16 text-center">
                    {story.profiles?.username}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Posts */}
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
