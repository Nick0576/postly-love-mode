import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/PostCard";
import { YouTubeMusicPlayer } from "@/components/YouTubeMusicPlayer";
import { MusicPicker, type MusicPick } from "@/components/MusicPicker";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, signedUrl, type Profile, isUserOnline, recordProfileView, getProfileViews, timeAgo, cleanupOldProfileViews, blockUser, unblockUser, isUserBlocked } from "@/lib/postly";
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showBubbleOverlay, setShowBubbleOverlay] = useState(false);

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data, error: profileError, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const me = await currentUserId();
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      if (!profile) return null;
      const p = profile as Profile;
      const [posts, following, followers, followingCount, followsBack, loveAnswers, myLoveAnswers, blocked] = await Promise.all([
        supabase.from("posts").select(POST_SELECT).eq("user_id", p.id).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(20),
        supabase.from("follows").select("following_id").eq("follower_id", me),
        supabase.from("follows").select("follower_id").eq("following_id", me),
        supabase.from("follows").select("follower_id").eq("following_id", p.id),
        supabase.from("follows").select("follower_id").eq("follower_id", p.id),
        supabase.from("love_answers").select("answers").eq("user_id", p.id).maybeSingle(),
        supabase.from("love_answers").select("answers").eq("user_id", me).maybeSingle(),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", me).eq("blocked_id", p.id).maybeSingle()
      ]);
      const followingSet = new Set((following?.data ?? []).map((r) => r.following_id));
      const followersSet = new Set((followers?.data ?? []).map((r) => r.follower_id));
      let loveMatch: number | null = null;
      if (loveAnswers?.data && myLoveAnswers?.data) {
        const theirs = (loveAnswers.data as { answers: number[] }).answers ?? [];
        const mine = (myLoveAnswers.data as { answers: number[] }).answers ?? [];
        if (mine.length > 0 && theirs.length > 0) {
          const same = mine.filter((a, i) => a !== -1 && a === theirs[i]).length;
          loveMatch = Math.round((same / mine.length) * 100);
        }
      }
      return {
        me,
        profile: p,
        posts: (posts?.data ?? []) as PostRow[],
        isFollowing: followingSet.has(p.id),
        isMutual: followingSet.has(p.id) && followersSet.has(p.id),
        followingCount: followingCount?.data?.length ?? 0,
        followersCount: followers?.data?.length ?? 0,
        followsBack: (followsBack?.data?.length ?? 0) > 0,
        loveMatch,
        isBlocked: !!blocked?.data,
        favoriteGames: (p.favorite_games as string[] | null) ?? []
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

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!data) return;
      try {
        await blockUser(data.profile.id);
      } catch (error) {
        console.error("Block error:", error);
        throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profile", username] }),
    onError: (error: any) => {
      console.error("Block mutation error:", error);
      const errorMessage = error?.message || error?.error?.message || JSON.stringify(error);
      alert("Failed to block user: " + errorMessage);
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async () => {
      if (!data) return;
      try {
        await unblockUser(data.profile.id);
      } catch (error) {
        console.error("Unblock error:", error);
        throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profile", username] }),
    onError: (error: any) => {
      console.error("Unblock mutation error:", error);
      const errorMessage = error?.message || error?.error?.message || JSON.stringify(error);
      alert("Failed to unblock user: " + errorMessage);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("posts").delete().eq("id", id).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profile", username] }),
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profile", username] }),
  });

  const togglePin = useMutation({
    mutationFn: async ({ postId, isPinned }: { postId: string; isPinned: boolean }) => {
      const uid = await currentUserId();
      if (isPinned) {
        const { error } = await supabase
          .from("posts")
          .update({ is_pinned: false })
          .eq("id", postId)
          .eq("user_id", uid);
        if (error) throw error;
      } else {
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
        if (error) throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profile", username] }),
  });

  useEffect(() => {
    if (data && data.profile && data.me !== data.profile.id) {
      void recordProfileView(data.profile.id);
    }
  }, [data]);

  const { data: profileViews } = useQuery({
    queryKey: ["profile-views", data?.profile?.id],
    queryFn: () => data?.profile ? getProfileViews(data.profile.id) : Promise.resolve([]),
    enabled: !!data && !!data.profile && data.me === data.profile.id && data.profile.profile_view_history_enabled,
  });

  const postIds = data?.posts.map(p => p.id) ?? [];

  const { data: likeData } = useQuery({
    queryKey: ["likes-batch", postIds, data?.me],
    queryFn: async () => {
      if (postIds.length === 0 || !data?.me) return { liked: new Set<string>(), counts: new Map<string, number>() };
      
      const [likedResult, countsResult] = await Promise.all([
        supabase.from("likes").select("post_id").eq("user_id", data.me).in("post_id", postIds),
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
    enabled: postIds.length > 0 && !!data?.me,
  });

  useEffect(() => {
    if (data && data.profile && data.me === data.profile.id) {
      void cleanupOldProfileViews();
    }
  }, [data]);

  if (profileLoading) {
    return (
      <AppShell title="Profile">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </AppShell>
    );
  }

  if (profileError) {
    const msg = profileError instanceof Error ? profileError.message : ((profileError as { message?: string })?.message ?? String(profileError));
    return (
      <AppShell title="Profile">
        <p className="text-sm text-red-600">Error loading profile: {msg}</p>
        <p className="text-xs text-muted-foreground mt-2">If this mentions favorite_games, the database migration has not been applied yet. Run pnpm db:migrate.</p>
      </AppShell>
    );
  }

  if (data === null) {
    return (
      <AppShell title="Profile">
        <p className="text-sm text-muted-foreground">User not found.</p>
      </AppShell>
    );
  }

  if (!data || !data.profile) {
    return (
      <AppShell title="Profile">
        <p className="text-sm text-muted-foreground">No profile data.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={`@${data.profile.username}`}>
      {data && data.profile && (
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
                      {data.followersCount} followers
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
            {data.favoriteGames && data.favoriteGames.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.favoriteGames.map((game) => (
                  <span key={game} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    🎮 {game}
                  </span>
                ))}
              </div>
            )}
            {data.me !== data.profile.id && (
              <div className="mt-4 flex gap-2 flex-wrap">
                <Button onClick={() => toggle.mutate()} variant={data.isFollowing ? "outline" : "default"}>
                  {data.isFollowing ? "Unfollow" : "Follow"}
                </Button>
                <Button asChild variant="outline">
                  <Link to="/messages/$userId" params={{ userId: data.profile.id }}>
                    Message
                  </Link>
                </Button>
                <Button 
                  onClick={() => data.isBlocked ? unblockMutation.mutate() : blockMutation.mutate()} 
                  variant={data.isBlocked ? "outline" : "destructive"}
                >
                  {data.isBlocked ? "Unblock" : "Block"}
                </Button>
              </div>
            )}
          </div>
          <FavoriteSongs userId={data.profile.id} isOwner={data.me === data.profile.id} />
          {data.isMutual && (
            <div className="mt-4 rounded-2xl border p-4 bg-gradient-to-r from-pink-50 to-red-50 dark:from-pink-950/20 dark:to-red-950/20">
              <div className="flex items-center gap-3">
                <span className="text-2xl">❤️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Love Mode</h3>
                  {data.loveMatch !== null ? (
                    <p className="text-sm text-muted-foreground">You and @{data.profile.username} are {data.loveMatch}% compatible!</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Answer questions to see your compatibility with @{data.profile.username}!</p>
                  )}
                </div>
                <Button asChild size="sm">
                  <Link to="/love">
                    {data.loveMatch !== null ? "Retake" : "Start"}
                  </Link>
                </Button>
              </div>
              {data.loveMatch !== null && data.loveMatch >= 70 && (
                <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">✨ Great match!</p>
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
                hasLiked={likeData?.liked.has(p.id)}
                likeCount={likeData?.counts.get(p.id)}
                onToggleLike={() => toggleLike.mutate({ postId: p.id, hasLiked: likeData?.liked.has(p.id) ?? false })}
                isPinned={p.is_pinned}
                onTogglePin={
                  data.me === data.profile.id
                    ? () => togglePin.mutate({ postId: p.id, isPinned: p.is_pinned })
                    : undefined
                }
                onEdit={
                  data.me === data.profile.id
                    ? () => navigate({ to: "/post/$postId", params: { postId: p.id } })
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
              {data.profile.chat_bubble_music_video_id && (
                <div className="w-full">
                  <YouTubeMusicPlayer 
                    videoId={data.profile.chat_bubble_music_video_id}
                    title={data.profile.chat_bubble_music_title ?? null}
                    autoplay={true}
                    previewDuration={30}
                    clipStart={data.profile.chat_bubble_music_clip_start ?? null}
                    clipEnd={data.profile.chat_bubble_music_clip_end ?? null}
                    hideControls
                  />
                </div>
              )}
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

function FavoriteSongs({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<{ videoId: string; title: string } | null>(null);

  const { data: songs } = useQuery({
    queryKey: ["favorite-songs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorite_songs")
        .select("id,video_id,title")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const add = useMutation({
    mutationFn: async (m: MusicPick) => {
      const uid = await currentUserId();
      const { error } = await supabase
        .from("favorite_songs")
        .insert({ user_id: uid, video_id: m.videoId, title: m.title });
      if (error) throw error;
    },
    onSuccess: () => {
      setAdding(false);
      void qc.invalidateQueries({ queryKey: ["favorite-songs", userId] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("favorite_songs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["favorite-songs", userId] }),
  });

  return (
    <div className="mt-4 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">🎵 Favorite songs</h3>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {isOwner && (
            adding ? (
              <div className="space-y-2">
                <MusicPicker onPick={(m) => add.mutate(m)} />
                <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setAdding(true)}>
                Add song
              </Button>
            )
          )}

          {songs && songs.length > 0 ? (
            <ul className="space-y-2">
              {songs.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg border p-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm"
                    onClick={() => setNowPlaying({ videoId: s.video_id, title: s.title })}
                  >
                    {s.title}
                  </button>
                  {isOwner && (
                    <Button variant="ghost" size="sm" onClick={() => remove.mutate(s.id)}>
                      Delete
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No favorite songs yet.</p>
          )}

          {nowPlaying && (
            <div className="space-y-2">
<YouTubeMusicPlayer
                key={nowPlaying.videoId}
                videoId={nowPlaying.videoId}
                title={nowPlaying.title}
                autoplay={true}
                previewDuration={30}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open("https://drive.google.com/file/d/13bZbdTY6SJlwkL74yzBvWNZAFvQ1k27L/view?usp=drivesdk", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Play full song in TipTop Music
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
