import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, type Profile } from "@/lib/postly";
import { applyTheme, loadThemeFromDatabase } from "@/lib/theme";

type Msg = { id: string; sender_id: string; content: string; created_at: string };

export const Route = createFileRoute("/_authenticated/messages/$userId")({
  head: () => ({
    meta: [
      { title: "Chat — Postly" },
      { name: "description", content: "Send and receive live direct messages on Postly." },
      { property: "og:title", content: "Chat — Postly" },
      { property: "og:description", content: "Send and receive live direct messages on Postly." },
    ],
  }),
  component: Chat,
});

function Chat() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data } = useQuery({
    queryKey: ["chat", userId],
    queryFn: async () => {
      const me = await currentUserId();
      const [msgs, person] = await Promise.all([
        supabase
          .from("messages")
          .select("id,sender_id,content,created_at")
          .or(
            `and(sender_id.eq.${me},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${me})`,
          )
          .order("created_at", { ascending: true })
          .limit(100),
        supabase.from("profiles").select("id,username,display_name,bio,avatar_url").eq("id", userId).maybeSingle(),
      ]);
      return { me, msgs: (msgs.data ?? []) as Msg[], person: person.data as Profile | null };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`dm-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void qc.invalidateQueries({ queryKey: ["chat", userId] });
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [userId, qc]);

  async function send() {
    const body = text.trim();
    if (!body || !data) return;
    setText("");
    await supabase.from("messages").insert({ sender_id: data.me, recipient_id: userId, content: body });
    void qc.invalidateQueries({ queryKey: ["chat", userId] });
  }

  return (
    <AppShell title={data?.person ? `@${data.person.username}` : "Chat"}>
      <div className="space-y-2">
        {data?.msgs.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              m.sender_id === data.me
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {m.content}
          </div>
        ))}
        {data && !data.msgs.length && <p className="text-sm text-muted-foreground">Say hello.</p>}
      </div>
      <div className="fixed inset-x-0 bottom-16 mx-auto flex max-w-xl gap-2 bg-background px-4 py-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder="Message"
          aria-label="Message"
        />
        <Button onClick={() => void send()}>Send</Button>
      </div>
    </AppShell>
  );
}
