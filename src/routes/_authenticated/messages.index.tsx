import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Media";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, timeAgo, type Profile } from "@/lib/postly";
import { applyTheme, loadThemeFromDatabase } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({
    meta: [
      { title: "Chats — Postly" },
      { name: "description", content: "Your Postly direct message conversations." },
      { property: "og:title", content: "Chats — Postly" },
      { property: "og:description", content: "Your Postly direct message conversations." },
    ],
  }),
  component: Chats,
});

function Chats() {
  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const me = await currentUserId();
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id,recipient_id,content,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      const seen = new Map<string, { content: string; created_at: string }>();
      for (const m of msgs ?? []) {
        const other = m.sender_id === me ? m.recipient_id : m.sender_id;
        if (!seen.has(other)) seen.set(other, { content: m.content, created_at: m.created_at });
      }
      const ids = [...seen.keys()];
      if (!ids.length) return [];
      const { data: people } = await supabase
        .from("profiles")
        .select("id,username,display_name,bio,avatar_url")
        .in("id", ids);
      return (people ?? []).map((p) => ({ profile: p as Profile, last: seen.get(p.id)! }));
    },
  });

  return (
    <AppShell title="Chats">
      <div className="space-y-2">
        {data?.map(({ profile, last }) => (
          <Link
            key={profile.id}
            to="/messages/$userId"
            params={{ userId: profile.id }}
            className="flex items-center gap-3 rounded-xl border p-3"
          >
            <Avatar url={profile.avatar_url} name={profile.display_name || profile.username} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{profile.display_name || profile.username}</p>
              <p className="truncate text-xs text-muted-foreground">{last.content}</p>
            </div>
            <span className="text-xs text-muted-foreground">{timeAgo(last.created_at)}</span>
          </Link>
        ))}
        {data && !data.length && (
          <p className="text-sm text-muted-foreground">
            No chats yet. Open someone's profile and tap Message.
          </p>
        )}
      </div>
    </AppShell>
  );
}
