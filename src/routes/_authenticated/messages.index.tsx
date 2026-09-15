import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ChatContextMenu, type ConversationMeta } from "@/components/ChatContextMenu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, timeAgo, type Profile, type GroupChat, getChatMeta, setChatMeta, deleteGroupChat } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

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
  const qc = useQueryClient();

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const me = await currentUserId();
      
      // Get direct messages
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id,recipient_id,content,created_at")
        .is("group_id", null)
        .order("created_at", { ascending: false })
        .limit(100);
      const seen = new Map<string, { content: string; created_at: string }>();
      for (const m of msgs ?? []) {
        const other = m.sender_id === me ? m.recipient_id : m.sender_id;
        if (!seen.has(other)) seen.set(other, { content: m.content, created_at: m.created_at });
      }
      const ids = [...seen.keys()];
      
      let directChats: { profile: Profile; last: { content: string; created_at: string } }[] = [];
      if (ids.length) {
        const { data: people } = await supabase
          .from("profiles")
          .select("id,username,display_name,bio,avatar_url")
          .in("id", ids);
        directChats = (people ?? []).map((p) => ({ profile: p as Profile, last: seen.get(p.id)! }));
      }
      
      // Get group chats
      const { data: groupData } = await (supabase as any)
        .from("group_members")
        .select("group_id,group_chats(*)")
        .eq("user_id", me);
      
      const groups: { group: GroupChat; groupId: string }[] = (groupData ?? []).map((g: any) => ({
        group: g.group_chats as GroupChat,
        groupId: g.group_id as string,
      }));
      
      return { directChats, groups };
    },
  });

  const [metaMap, setMetaMap] = useState<Record<string, ConversationMeta>>({});

  useEffect(() => {
    if (!data) return;
    const entries: Record<string, ConversationMeta> = {};
    for (const { profile } of data.directChats) {
      entries[`dm-${profile.id}`] = getChatMeta(profile.id);
    }
    for (const { groupId } of data.groups) {
      entries[`group-${groupId}`] = getChatMeta(groupId);
    }
    setMetaMap(entries);
  }, [data]);

  function handleAction(action: "unread" | "mute" | "archive" | "delete", id: string, kind: "dm" | "group") {
    const key = `${kind}-${id}`;
    const current = metaMap[key] || {};
    switch (action) {
      case "unread": {
        const next = { ...current, unread: !current.unread };
        setChatMeta(id, { unread: next.unread });
        setMetaMap((prev) => ({ ...prev, [key]: next }));
        toast.success(next.unread ? "Marked as unread" : "Marked as read");
        break;
      }
      case "mute": {
        const next = { ...current, muted: !current.muted };
        setChatMeta(id, { muted: next.muted });
        setMetaMap((prev) => ({ ...prev, [key]: next }));
        toast.success(next.muted ? "Muted" : "Unmuted");
        break;
      }
      case "archive": {
        const next = { ...current, archived: !current.archived };
        setChatMeta(id, { archived: next.archived });
        setMetaMap((prev) => ({ ...prev, [key]: next }));
        toast.success(next.archived ? "Archived" : "Unarchived");
        break;
      }
      case "delete": {
        const label = kind === "group" ? "this group chat" : "this conversation";
        if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
        (async () => {
          try {
            if (kind === "group") {
              await deleteGroupChat(id);
            } else {
              const me = await currentUserId();
              await supabase.from("messages").delete().or(
                `and(sender_id.eq.${me},recipient_id.eq.${id}),and(sender_id.eq.${id},recipient_id.eq.${me})`
              );
            }
            toast.success("Deleted");
            void qc.invalidateQueries({ queryKey: ["chats"] });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to delete");
          }
        })();
        break;
      }
    }
  }

  return (
    <AppShell title="Chats" headerAction={
      <Button variant="ghost" size="icon" asChild>
        <Link to="/create-group">
          <Plus className="h-5 w-5" />
        </Link>
      </Button>
    }>
      <div className="space-y-4">
        {/* Group Chats */}
        {data?.groups && data.groups.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Groups</h3>
            {data.groups.map(({ group, groupId }) => {
              const meta = metaMap[`group-${groupId}`] || {};
              return (
                <ChatContextMenu
                  key={groupId}
                  id={groupId}
                  kind="group"
                  name={group.name}
                  subtitle="Group chat"
                  avatarUrl={null}
                  meta={meta}
                  onAction={handleAction}
                >
                  <Link
                    to="/messages/group/$groupId"
                    params={{ groupId }}
                    className="flex items-center gap-3 rounded-xl border p-3"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{group.name}</p>
                      <p className="truncate text-xs text-muted-foreground">Group chat</p>
                    </div>
                  </Link>
                </ChatContextMenu>
              );
            })}
          </div>
        )}
        
        {/* Direct Messages */}
        {data?.directChats && data.directChats.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Direct Messages</h3>
            {data.directChats.map(({ profile, last }) => {
              const meta = metaMap[`dm-${profile.id}`] || {};
              return (
                <ChatContextMenu
                  key={profile.id}
                  id={profile.id}
                  kind="dm"
                  name={profile.display_name || profile.username}
                  subtitle={last.content}
                  avatarUrl={profile.avatar_url}
                  meta={meta}
                  onAction={handleAction}
                >
                  <Link
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
                </ChatContextMenu>
              );
            })}
          </div>
        )}
        
        {data && !data.directChats.length && !data.groups.length && (
          <p className="text-sm text-muted-foreground">
            No chats yet. Open someone's profile and tap Message, or create a group.
          </p>
        )}
      </div>
    </AppShell>
  );
}
