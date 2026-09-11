import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, currentUserId, timeAgo, type PostRow, type Profile } from "@/lib/postly";

type CommentRow = {
  id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  profiles: Profile | null;
};

export const Route = createFileRoute("/_authenticated/post/$postId")({
  head: () => ({
    meta: [
      { title: "Post — Postly" },
      { name: "description", content: "Read a Postly post and its threaded comments." },
      { property: "og:title", content: "Post — Postly" },
      { property: "og:description", content: "Read a Postly post and its threaded comments." },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { postId } = Route.useParams();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const { data: post } = useQuery({
    queryKey: ["post", postId],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select(POST_SELECT).eq("id", postId).maybeSingle();
      if (error) throw error;
      return data as unknown as PostRow | null;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id,parent_id,user_id,content,created_at,profiles(id,username,display_name,bio,avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CommentRow[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const uid = await currentUserId();
      const { error } = await supabase
        .from("comments")
        .insert({ post_id: postId, parent_id: replyTo, user_id: uid, content: text.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      void qc.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });

  const list = comments ?? [];
  const roots = list.filter((c) => !c.parent_id);
  const replies = (id: string) => list.filter((c) => c.parent_id === id);

  const item = (c: CommentRow, depth: number) => (
    <div key={c.id} style={{ marginLeft: depth * 16 }} className="mt-3 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <Avatar url={c.profiles?.avatar_url ?? null} name={c.profiles?.display_name ?? "?"} size={28} />
        <p className="text-xs text-muted-foreground">
          @{c.profiles?.username} · {timeAgo(c.created_at)}
        </p>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{c.content}</p>
      <button className="mt-2 text-xs text-primary" onClick={() => setReplyTo(c.id)}>
        Reply
      </button>
      {replies(c.id).map((r) => item(r, depth + 1))}
    </div>
  );

  return (
    <AppShell title="Post">
      {post && <PostCard post={post} />}
      <div className="mt-4">
        {replyTo && (
          <p className="mb-2 text-xs text-muted-foreground">
            Replying to a comment ·{" "}
            <button className="text-primary" onClick={() => setReplyTo(null)}>
              cancel
            </button>
          </p>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment"
          maxLength={500}
        />
        <Button
          className="mt-2"
          disabled={!text.trim() || add.isPending}
          onClick={() => add.mutate()}
        >
          Comment
        </Button>
      </div>
      <div className="mt-4">{roots.map((c) => item(c, 0))}</div>
    </AppShell>
  );
}
