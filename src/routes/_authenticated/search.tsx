import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { Avatar } from "@/components/Media";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, type PostRow, type Profile } from "@/lib/postly";
import { applyTheme, loadThemeFromDatabase } from "@/lib/theme";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";

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

  useEffect(() => {
    loadThemeFromDatabase().then((dbTheme) => {
      if (dbTheme) applyTheme(dbTheme);
    });
  }, []);

  const { data } = useQuery({
    queryKey: ["search", term],
    enabled: term.length > 1,
    queryFn: async () => {
      const [users, posts] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,username,display_name,bio,avatar_url,theme")
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
    <AppShell title="Search">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people and posts"
        aria-label="Search"
      />
      <div className="mt-4 space-y-4">
        {data?.users.map((u) => (
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
        {data?.posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        {term.length > 1 && data && !data.users.length && !data.posts.length && (
          <p className="text-sm text-muted-foreground">No results.</p>
        )}
      </div>
    </AppShell>
  );
}
