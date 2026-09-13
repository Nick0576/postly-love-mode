import { Link } from "@tanstack/react-router";
import { MessageCircle, Heart } from "lucide-react";
import { Avatar, Media } from "@/components/Media";
import { timeAgo, type PostRow } from "@/lib/postly";

export function PostCard({ post, onDelete, hasLiked, likeCount, onToggleLike }: { 
  post: PostRow; 
  onDelete?: (() => void) | undefined;
  hasLiked?: boolean;
  likeCount?: number;
  onToggleLike?: () => void;
}) {
  const author = post.profiles;
  return (
    <article className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <Avatar url={author?.avatar_url ?? null} name={author?.display_name ?? "?"} size={40} />
        <div className="min-w-0">
          <Link
            to="/u/$username"
            params={{ username: author?.username ?? "" }}
            className="block truncate font-semibold hover:underline"
          >
            {author?.display_name || author?.username}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            @{author?.username} · {timeAgo(post.created_at)}
          </p>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="ml-auto text-xs text-destructive hover:underline">
            Delete
          </button>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-[0.95rem]">{post.content}</p>
      <Media path={post.media_url} />
      <div className="mt-3 flex items-center gap-4">
        {onToggleLike && (
          <button
            onClick={onToggleLike}
            className={`inline-flex items-center gap-2 text-sm ${hasLiked ? "text-red-500" : "text-muted-foreground"} hover:text-red-500 transition-colors`}
          >
            <Heart className={`h-4 w-4 ${hasLiked ? "fill-current" : ""}`} />
            {likeCount ?? 0}
          </button>
        )}
        <Link
          to="/post/$postId"
          params={{ postId: post.id }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <MessageCircle className="h-4 w-4" /> Comments
        </Link>
      </div>
    </article>
  );
}
