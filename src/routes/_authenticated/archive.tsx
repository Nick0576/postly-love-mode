import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, timeAgo } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/archive")({
  head: () => ({
    meta: [
      { title: "Archive — Postly" },
      { name: "description", content: "View your archived chats and posts." },
      { property: "og:title", content: "Archive — Postly" },
      { property: "og:description", content: "View your archive." },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data: archivedChats, isLoading: chatsLoading } = useQuery({
    queryKey: ["archived-chats"],
    queryFn: async () => {
      const uid = await currentUserId();
      const { data, error } = await supabase
        .from("archived_chats")
        .select("*,profiles(*)")
        .eq("user_id", uid);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: archivedPosts, isLoading: postsLoading } = useQuery({
    queryKey: ["archived-posts"],
    queryFn: async () => {
      const uid = await currentUserId();
      const { data, error } = await supabase
        .from("archived_posts")
        .select("*,posts(*,profiles(*))")
        .eq("user_id", uid);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <AppShell title="Archive">
      <div className="space-y-6">
        {/* Archived Chats */}
        <section className="space-y-3 rounded-2xl border p-4">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            <h2 className="font-semibold">Archived Chats</h2>
          </div>
          {chatsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : archivedChats && archivedChats.length > 0 ? (
            <div className="space-y-2">
              {archivedChats.map((archived: any) => (
                <div key={archived.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <Avatar url={archived.profiles?.avatar_url} name={archived.profiles?.display_name} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{archived.profiles?.display_name || archived.profiles?.username}</p>
                    <p className="text-sm text-muted-foreground">@{archived.profiles?.username}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <Link to="/messages/$userId" params={{ userId: archived.chat_partner_id }}>
                      Open
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No archived chats</p>
          )}
        </section>

        {/* Archived Posts */}
        <section className="space-y-3 rounded-2xl border p-4">
          <div className="flex items-center gap-2">
            <ArchiveX className="h-5 w-5" />
            <h2 className="font-semibold">Archived Posts</h2>
          </div>
          {postsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : archivedPosts && archivedPosts.length > 0 ? (
            <div className="space-y-2">
              {archivedPosts.map((archived: any) => (
                <div key={archived.id} className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar url={archived.posts?.profiles?.avatar_url} name={archived.posts?.profiles?.display_name} size={24} />
                    <p className="text-sm font-medium">{archived.posts?.profiles?.display_name || archived.posts?.profiles?.username}</p>
                    <span className="text-xs text-muted-foreground">· {timeAgo(archived.created_at)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{archived.posts?.content}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    asChild
                  >
                    <Link to="/post/$postId" params={{ postId: archived.post_id }}>
                      View
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No archived posts</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
