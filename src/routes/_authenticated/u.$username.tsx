import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, currentUserId, type PostRow, type Profile } from "@/lib/postly";

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

  const { data } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const me = await currentUserId();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id,username,display_name,bio,avatar_url")
        .eq("username", username)
        .maybeSingle();
      if (!profile) return null;
      const p = profile as Profile;
      const [posts, following, followers] = await Promise.all([
        supabase.from("posts").select(POST_SELECT).eq("user_id", p.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("follows").select("follower_id").eq("follower_id", me).eq("following_id", p.id).maybeSingle(),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
      ]);
      return {
        profile: p,
        me,
        posts: (posts.data ?? []) as unknown as PostRow[],
        isFollowing: !!following.data,
        followers: followers.count ?? 0,
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
              <Avatar url={data.profile.avatar_url} name={data.profile.display_name} size={56} />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">
                  {data.profile.display_name || data.profile.username}
                </h2>
                <p className="text-xs text-muted-foreground">
                  @{data.profile.username} · {data.followers} followers
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
          <div className="mt-4 space-y-4">
            {data.posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
            {!data.posts.length && <p className="text-sm text-muted-foreground">No posts yet.</p>}
          </div>
        </>
      )}
    </AppShell>
  );
}
