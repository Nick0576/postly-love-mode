import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, currentUserId, type PostRow, type Profile, isUserOnline } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: () => ({
    meta: [
      { title: "Profile — Postly" },
      { name: "description", content: "View a Postly profile, their posts and follow them." },
      { property: "og:title", content: "Profile — Postly" },
      { property: "og:description", content: "View a Postly profile, their posts and follow them." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const qc = useQueryClient();
  const [showBubbleOverlay, setShowBubbleOverlay] = useState(false);

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const me = await currentUserId();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id,username,display_name,bio,avatar_url,chat_bubble_text,chat_bubble_enabled,last_seen,is_online")
        .eq("username", username)
        .maybeSingle();
      if (!profile) return null;
      const p = profile as Profile;
      const [posts, following, followers, followsBack, loveAnswers] = await Promise.all([
        supabase.from("posts").select(POST_SELECT).eq("user_id", p.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("follows").select("follower_id").eq("follower_id", me).eq("following_id", p.id).maybeSingle(),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
        supabase.from("follows").select("follower_id").eq("follower_id", p.id).eq("following_id", me).maybeSingle(),
        supabase.from("love_answers").select("user_id,answers").in("user_id", [me, p.id]),
      ]);
      const isMutual = !!followsBack.data && !!following.data;
      let loveMatch = null;
      if (isMutual && loveAnswers.data && loveAnswers.data.length === 2) {
        const myAnswers = loveAnswers.data.find((a) => a.user_id === me)?.answers as number[];
        const theirAnswers = loveAnswers.data.find((a) => a.user_id === p.id)?.answers as number[];
        if (myAnswers && theirAnswers) {
          const same = myAnswers.filter((a, i) => a === theirAnswers[i]).length;
          loveMatch = Math.round((same / 20) * 100);
        }
      }
      return {
        profile: p,
        me,
        posts: (posts.data ?? []) as unknown as PostRow[],
        isFollowing: !!following.data,
        followers: followers.count ?? 0,
        isMutual,
        loveMatch,
      };
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!data) return;
      if (data.isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", data.me).eq("following_id", data.profile.id);
      } else {
        await supabase.from("follows").insert({ follower_id: data.me, following_id: data.profile.id });
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profile", username] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("posts").delete().eq("id", id).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profile", username] }),
  });

  if (data === null) {
    return (
      <AppShell title="Profile">
        <p className="text-sm text-muted-foreground">User not found.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={data ? `@${data.profile.username}` : "Profile"}>
      {data && (
        <>
          <div className="rounded-2xl border p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar url={data.profile.avatar_url} name={data.profile.display_name} size={56} />
                {isUserOnline(data.profile) && (
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background" />
                )}
                {data.profile.chat_bubble_enabled && data.profile.chat_bubble_text && (
                  <div 
                    className="absolute -top-10 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-2xl shadow-md whitespace-nowrap cursor-pointer"
                    onClick={() => setShowBubbleOverlay(true)}
                  >
                    {data.profile.chat_bubble_text}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rotate-45"></div>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">
                  {data.profile.display_name || data.profile.username}
                </h2>
                <p className="text-xs text-muted-foreground">
                  @{data.profile.username} · {data.followers} followers
                  {isUserOnline(data.profile) && " · Online"}
                </p>
              </div>
            </div>
            {data.profile.bio && <p className="mt-3 text-sm">{data.profile.bio}</p>}
            {data.me !== data.profile.id && (
              <div className="mt-4 flex gap-2">
                <Button onClick={() => toggle.mutate()} variant={data.isFollowing ? "outline" : "default"}>
                  {data.isFollowing ? "Unfollow" : "Follow"}
                </Button>
                <Button asChild variant="outline">
                  <Link to="/messages/$userId" params={{ userId: data.profile.id }}>
                    Message
                  </Link>
                </Button>
              </div>
            )}
          </div>
          {data.isMutual && (
            <div className="mt-4 rounded-2xl border p-4 bg-gradient-to-r from-pink-50 to-red-50 dark:from-pink-950/20 dark:to-red-950/20">
              <div className="flex items-center gap-3">
                <span className="text-2xl">❤️</span>
                <div>
                  <h3 className="font-semibold text-lg">Love Mode</h3>
                  {data.loveMatch !== null ? (
                    <p className="text-sm text-muted-foreground">You and @{data.profile.username} are {data.loveMatch}% compatible!</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Answer questions to see your compatibility with @{data.profile.username}!</p>
                  )}
                </div>
              </div>
              {data.loveMatch !== null && data.loveMatch >= 70 && (
                <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">✨ Great match!</p>
              )}
              {data.loveMatch === null && (
                <Button asChild className="mt-3" size="sm">
                  <Link to="/love">Answer questions</Link>
                </Button>
              )}
            </div>
          )}
          <div className="mt-4 space-y-4">
            {data.posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onDelete={
                  data.me === data.profile.id
                    ? () => {
                        if (confirm("Delete this post?")) remove.mutate(p.id);
                      }
                    : undefined
                }
              />
            ))}
            {!data.posts.length && <p className="text-sm text-muted-foreground">No posts yet.</p>}
          </div>
        </>
      )}
      
      {showBubbleOverlay && data.profile.chat_bubble_enabled && data.profile.chat_bubble_text && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowBubbleOverlay(false)}
        >
          <div 
            className="relative bg-background rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowBubbleOverlay(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-muted hover:bg-muted/80"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="bg-primary text-primary-foreground text-lg px-6 py-4 rounded-3xl shadow-lg text-center max-w-xs">
                  {data.profile.chat_bubble_text}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary rotate-45"></div>
                </div>
              </div>
              <Avatar url={data.profile.avatar_url} name={data.profile.display_name} size={120} />
              <p className="text-center text-muted-foreground">
                {data.profile.display_name || data.profile.username}
              </p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
