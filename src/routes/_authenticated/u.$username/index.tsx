import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, signedUrl, type Profile, isUserOnline, recordProfileView, getProfileViews, timeAgo, cleanupOldProfileViews } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";
import type { PostRow } from "@/lib/postly";
import { POST_SELECT } from "@/lib/postly";

export const Route = createFileRoute("/_authenticated/u/$username/")({
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
        .select("id,username,display_name,bio,avatar_url,banner_url,chat_bubble_text,chat_bubble_enabled,last_seen,is_online,profile_view_history_enabled")
        .eq("username", username)
        .maybeSingle();
      if (!profile) return null;
      const p = profile as Profile;
      const [posts, following, followers, followingCount, followsBack, loveAnswers] = await Promise.all([
        supabase.from("posts").select(POST_SELECT).eq("user_id", p.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("follows").select("follower_id").eq("follower_id", me).eq("following_id", p.id).maybeSingle(),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
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
        followingCount: followingCount.count ?? 0,
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

  useEffect(() => {
    if (data && data.me !== data.profile.id) {
      void recordProfileView(data.profile.id);
    }
  }, [data]);

  const { data: profileViews } = useQuery({
    queryKey: ["profile-views", data?.profile.id],
    queryFn: () => data ? getProfileViews(data.profile.id) : Promise.resolve([]),
    enabled: !!data && data.me === data.profile.id && data.profile.profile_view_history_enabled,
  });

  useEffect(() => {
    if (data && data.me === data.profile.id) {
      void cleanupOldProfileViews();
    }
  }, [data]);

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
            {data.profile.banner_url && (
              <div className="relative -mx-4 -mt-4 mb-4 h-32 overflow-hidden rounded-t-2xl">
                <Banner url={data.profile.banner_url} />
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar url={data.profile.avatar_url} name={data.profile.display_name} size={56} />
                {isUserOnline(data.profile) && (
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background" />
                )}
                {!isUserOnline(data.profile) && (
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-gray-400 border-2 border-background" />
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
                <div className="flex items-center gap-2 mt-1">
                  <Button variant="outline" size="sm" className="h-7" asChild>
                    <Link to="/u/$username/followers" params={{ username: data.profile.username }}>
                      {data.followers} followers
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="h-7" asChild>
                    <Link to="/u/$username/following" params={{ username: data.profile.username }}>
                      {data.followingCount} following
                    </Link>
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {isUserOnline(data.profile) ? "Online" : "Offline"}
                  </span>
                </div>
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
          {data.me === data.profile.id && data.profile.profile_view_history_enabled && (
            <div className="mt-4 rounded-2xl border p-4">
              <h3 className="font-semibold mb-3">Profile Views</h3>
              {profileViews && profileViews.length > 0 ? (
                <div className="space-y-2">
                  {profileViews.map(({ viewer, viewed_at }) => (
                    <Link
                      key={viewer.id}
                      to="/u/$username"
                      params={{ username: viewer.username }}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Avatar url={viewer.avatar_url} name={viewer.display_name || viewer.username} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{viewer.display_name || viewer.username}</p>
                        <p className="text-xs text-muted-foreground">@{viewer.username}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{timeAgo(viewed_at)}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No profile views yet.</p>
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
      
      {showBubbleOverlay && data?.profile.chat_bubble_enabled && data.profile.chat_bubble_text && (
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

function Banner({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  
  useEffect(() => {
    signedUrl(url).then(setSrc);
  }, [url]);
  
  if (!src) return null;
  
  return (
    <img 
      src={src} 
      alt="Banner" 
      className="w-full h-full object-cover"
    />
  );
}
