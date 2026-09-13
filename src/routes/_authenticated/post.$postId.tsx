import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, currentUserId, timeAgo, type PostRow, type Profile } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState(false);
  const [editPostContent, setEditPostContent] = useState("");
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");

  useEffect(() => {
    applyTheme(getTheme());
    currentUserId()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const remove = useMutation({
    mutationFn: async () => {
      const uid = await currentUserId();
      const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      void qc.invalidateQueries({ queryKey: ["feed"] });
      void navigate({ to: "/feed" });
    },
  });

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

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment deleted");
      void qc.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });

  const editPost = useMutation({
    mutationFn: async (content: string) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("posts").update({ content }).eq("id", postId).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post updated");
      setEditingPost(false);
      void qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });

  const editComment = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("comments").update({ content }).eq("id", commentId).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment updated");
      setEditingComment(null);
      setEditCommentContent("");
      void qc.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });

  const { data: hasLiked } = useQuery({
    queryKey: ["has-liked", postId, me],
    queryFn: async () => {
      if (!me) return false;
      const { data, error } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", me)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!me,
  });

  const { data: likeCount } = useQuery({
    queryKey: ["like-count", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId);
      if (error) throw error;
      return data?.count ?? 0;
    },
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["has-liked", postId, me] });
      void qc.invalidateQueries({ queryKey: ["like-count", postId] });
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
        {c.user_id === me && (
          <div className="ml-auto flex gap-2">
            {editingComment === c.id ? (
              <>
                <button
                  onClick={() => {
                    setEditingComment(null);
                    setEditCommentContent("");
                  }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
                <button
                  onClick={() => editComment.mutate({ commentId: c.id, content: editCommentContent.trim() })}
                  disabled={!editCommentContent.trim() || editComment.isPending}
                  className="text-xs text-primary hover:underline"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditingComment(c.id);
                    setEditCommentContent(c.content);
                  }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this comment?")) deleteComment.mutate(c.id);
                  }}
                  className="text-xs text-destructive hover:underline"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {editingComment === c.id ? (
        <Textarea
          value={editCommentContent}
          onChange={(e) => setEditCommentContent(e.target.value)}
          className="mt-2"
          placeholder="Edit comment"
          maxLength={500}
        />
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{c.content}</p>
      )}
      <button className="mt-2 text-xs text-primary" onClick={() => setReplyTo(c.id)}>
        Reply
      </button>
      {replies(c.id).map((r) => item(r, depth + 1))}
    </div>
  );

  return (
    <AppShell title="Post">
      {post && (
        <>
          {editingPost ? (
            <div className="rounded-2xl border bg-card p-4 shadow-soft">
              <Textarea
                value={editPostContent}
                onChange={(e) => setEditPostContent(e.target.value)}
                placeholder="Edit post"
                maxLength={500}
                className="mb-2"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => editPost.mutate(editPostContent.trim())}
                  disabled={!editPostContent.trim() || editPost.isPending}
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingPost(false);
                    setEditPostContent("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <PostCard
              post={post}
              onDelete={
                post.user_id === me
                  ? () => {
                      if (confirm("Delete this post?")) remove.mutate();
                    }
                  : undefined
              }
              hasLiked={hasLiked}
              likeCount={likeCount}
              onToggleLike={() => toggleLike.mutate()}
              onEdit={
                post.user_id === me
                  ? () => {
                      setEditingPost(true);
                      setEditPostContent(post.content);
                    }
                  : undefined
              }
            />
          )}
        </>
      )}
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
