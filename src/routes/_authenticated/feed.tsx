import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
  const navigate = useNavigate();
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

  const toggleLike = useMutation({
    mutationFn: async ({ postId, hasLiked }: { postId: string; hasLiked: boolean }) => {
      const uid = await currentUserId();
      if (hasLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ post_id: postId, user_id: uid });
        if (error) throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  const togglePin = useMutation({
    mutationFn: async ({ postId, isPinned }: { postId: string; isPinned: boolean }) => {
      const uid = await currentUserId();
      console.log("Toggle pin called:", { postId, isPinned, uid });
      try {
        if (isPinned) {
          console.log("Unpinning post:", postId);
          const { error } = await supabase
            .from("posts")
            .update({ is_pinned: false })
            .eq("id", postId)
            .eq("user_id", uid);
          if (error) {
            console.error("Failed to unpin:", error);
            throw error;
          }
          console.log("Post unpinned successfully");
        } else {
          console.log("Pinning post:", postId);
          // First unpin any existing pinned post for this user
          await supabase
            .from("posts")
            .update({ is_pinned: false })
            .eq("user_id", uid)
            .eq("is_pinned", true);
          // Then pin the new post
          const { error } = await supabase
            .from("posts")
            .update({ is_pinned: true })
            .eq("id", postId)
            .eq("user_id", uid);
          if (error) {
            console.error("Failed to pin:", error);
            throw error;
          }
          console.log("Post pinned successfully");
        }
      } catch (e) {
        console.error("Error in togglePin:", e);
        throw e;
      }
    },
    onSuccess: () => {
      console.log("Pin mutation succeeded, invalidating queries");
      void qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (error) => {
      console.error("Pin mutation failed:", error);
      alert("Failed to pin post: " + (error instanceof Error ? error.message : String(error)));
    },
  });

  const editPost = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("posts").update({ content }).eq("id", postId).eq("user_id", uid);
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

  const postIds = posts.map(p => p.id);

  const { data: likeData } = useQuery({
    queryKey: ["likes-batch", postIds, me],
    queryFn: async () => {
      if (postIds.length === 0 || !me) return { liked: new Set<string>(), counts: new Map<string, number>() };
      
      const [likedResult, countsResult] = await Promise.all([
        supabase.from("likes").select("post_id").eq("user_id", me).in("post_id", postIds),
        // Fetch counts for each post
        Promise.all(postIds.map(async (postId) => {
          const { count } = await supabase
            .from("likes")
            .select("*", { count: "exact", head: true })
            .eq("post_id", postId);
          return { postId, count: count ?? 0 };
        }))
      ]);

      const liked = new Set(likedResult.data?.map(l => l.post_id) ?? []);
      const counts = new Map(countsResult.map(r => [r.postId, r.count]));
      
      return { liked, counts };
    },
    enabled: postIds.length > 0 && !!me,
  });

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
            hasLiked={likeData?.liked.has(p.id)}
            likeCount={likeData?.counts.get(p.id)}
            onToggleLike={() => toggleLike.mutate({ postId: p.id, hasLiked: likeData?.liked.has(p.id) ?? false })}
            isPinned={p.is_pinned}
            onTogglePin={
              p.user_id === me
                ? () => togglePin.mutate({ postId: p.id, isPinned: p.is_pinned })
                : undefined
            }
            onEdit={
              p.user_id === me
                ? () => navigate({ to: "/post/$postId", params: { postId: p.id } })
                : undefined
            }
          />
        ))}
        <div ref={sentinel} className="h-8" />
        {isFetchingNextPage && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
      </div>
      
      {/* Floating Action Button for Stories */}
      <Link to="/story" className="fixed bottom-24 right-4">
        <Button size="lg" className="rounded-full w-14 h-14 shadow-lg">
          <Plus className="h-6 w-6" />
        </Button>
      </Link>
    </AppShell>
  );
}
