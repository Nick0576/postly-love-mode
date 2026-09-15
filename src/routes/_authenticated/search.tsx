import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { PostCard } from "@/components/PostCard";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, currentUserId, type PostRow, type Profile, isUserOnline } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "Search — Postly" },
      { name: "description", content: "Find people and posts on Postly." },
      { property: "og:title", content: "Search — Postly" },
      { property: "og:description", content: "Find people and posts on Postly." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const term = q.trim();
  const qc = useQueryClient();

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  // Fetch all users for People section
  const { data: allUsers } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const me = await currentUserId();
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name,bio,avatar_url,last_seen,is_online")
        .neq("id", me)
        .order("username", { ascending: true })
        .limit(50);
      return data as Profile[];
    },
  });

  const { data } = useQuery({
    queryKey: ["search", term],
    enabled: term.length > 1,
    queryFn: async () => {
      const me = await currentUserId();
      const [users, posts] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,username,display_name,bio,avatar_url,last_seen,is_online")
          .neq("id", me)
          .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
          .limit(10),
        supabase.from("posts").select(POST_SELECT).ilike("content", `%${term}%`).limit(10),
      ]);
      return {
        users: (users.data ?? []) as Profile[],
        posts: (posts.data ?? []) as unknown as PostRow[],
      };
    },
  });

  return (
    <AppShell title="Discover">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people and posts"
        aria-label="Search"
      />
      <div className="mt-4 space-y-4">
        {!term && (
          <section>
            <h2 className="font-semibold mb-3">People</h2>
            <div className="space-y-3">
              {allUsers?.map((u) => (
                <UserCard key={u.id} user={u} />
              ))}
              {!allUsers?.length && (
                <p className="text-sm text-muted-foreground">No people to discover yet.</p>
              )}
            </div>
          </section>
        )}
        {term && data?.users.map((u) => (
          <Link
            key={u.id}
            to="/u/$username"
            params={{ username: u.username }}
            className="flex items-center gap-3 rounded-xl border p-3"
          >
            <Avatar url={u.avatar_url} name={u.display_name || u.username} size={36} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{u.display_name || u.username}</p>
              <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
            </div>
          </Link>
        ))}
        {term && data?.posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        {term.length > 1 && data && !data.users.length && !data.posts.length && (
          <p className="text-sm text-muted-foreground">No results.</p>
        )}
      </div>
    </AppShell>
  );
}

function UserCard({ user }: { user: Profile }) {
  const qc = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(false);

  const { data: following } = useQuery({
    queryKey: ["following", user.id],
    queryFn: async () => {
      const me = await currentUserId();
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", me)
        .eq("following_id", user.id)
        .maybeSingle();
      return !!data;
    },
  });

  useEffect(() => {
    setIsFollowing(following ?? false);
  }, [following]);

  const toggle = useMutation({
    mutationFn: async () => {
      const me = await currentUserId();
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", me).eq("following_id", user.id);
      } else {
        await supabase.from("follows").insert({ follower_id: me, following_id: user.id });
      }
    },
    onSuccess: () => {
      setIsFollowing(!isFollowing);
      void qc.invalidateQueries({ queryKey: ["following", user.id] });
    },
  });

  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <Link
        to="/u/$username"
        params={{ username: user.username }}
        className="flex items-center gap-3 flex-1"
      >
        <div className="relative">
          <Avatar url={user.avatar_url} name={user.display_name || user.username} size={48} />
          {isUserOnline(user) && (
            <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background" />
          )}
          {!isUserOnline(user) && (
            <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-gray-400 border-2 border-background" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.display_name || user.username}</p>
          <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
          {user.bio && <p className="truncate text-xs text-muted-foreground mt-1">{user.bio}</p>}
        </div>
      </Link>
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          variant={isFollowing ? "outline" : "default"}
          onClick={() => toggle.mutate()}
        >
          {isFollowing ? "Unfollow" : "Follow"}
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/u/$username" params={{ username: user.username }}>
            View Profile
          </Link>
        </Button>
      </div>
    </div>
  );
}
