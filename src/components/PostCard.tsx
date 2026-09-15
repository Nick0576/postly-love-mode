import { Link } from "@tanstack/react-router";
import { MessageCircle, Heart, Pin, Pencil, Trash2, MoreVertical } from "lucide-react";
import { Avatar, Media } from "@/components/Media";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo, type PostRow } from "@/lib/postly";
import { useState, useRef } from "react";
import { toast } from "sonner";

type ButtonData = {
  id: string;
  name: string;
  icon: string;
  appearance: { color: string; style: string };
  button_page_id: string;
};

export function PostCard({ post, onDelete, hasLiked, likeCount, onToggleLike, isPinned, onTogglePin, onEdit, button }: {
  post: PostRow;
  onDelete?: (() => void) | undefined;
  hasLiked?: boolean | undefined;
  likeCount?: number | undefined;
  onToggleLike?: (() => void) | undefined;
  isPinned?: boolean | undefined;
  onTogglePin?: (() => void) | undefined;
  onEdit?: (() => void | Promise<void>) | undefined;
  button?: ButtonData | undefined;
}) {
  const author = post.profiles;
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const handleTouchStart = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      // Long press triggers pin action if available
      if (onTogglePin) {
        const action = isPinned ? "unpinned" : "pinned";
        onTogglePin();
        toast.success(`Your post has been ${action}`);
      } else {
        // If no pin action, show menu
        setMenuOpen(true);
      }
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  return (
    <article 
      className="rounded-2xl border bg-card p-4 shadow-soft relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onToggleLike && (
            <DropdownMenuItem onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleLike();
              setMenuOpen(false);
            }}>
              <Heart className={`h-4 w-4 mr-2 ${hasLiked ? "fill-current text-red-500" : ""}`} />
              {hasLiked ? "Unlike" : "Like"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/post/$postId" params={{ postId: post.id }}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Comments
            </Link>
          </DropdownMenuItem>
          {onTogglePin && (
            <DropdownMenuItem onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePin();
              setMenuOpen(false);
            }}>
              <Pin className={`h-4 w-4 mr-2 ${isPinned ? "fill-current" : ""}`} />
              {isPinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
          )}
          {onEdit && (
            <DropdownMenuItem onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void onEdit();
              setMenuOpen(false);
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
              setMenuOpen(false);
            }} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
        <div className="ml-auto flex items-center gap-2">
          {isPinned && !onTogglePin && (
            <Pin className="h-4 w-4 fill-current text-primary" />
          )}
          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              className={`inline-flex items-center gap-1 text-xs ${isPinned ? "text-primary" : "text-muted-foreground"} hover:text-primary transition-colors`}
              title={isPinned ? "Unpin post" : "Pin post"}
            >
              <Pin className={`h-4 w-4 ${isPinned ? "fill-current" : ""}`} />
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => void onEdit()}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              title="Edit post"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} className="text-xs text-destructive hover:underline">
              Delete
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-[0.95rem]">{post.content}</p>
      <Media path={post.media_url} />
      
      {/* Button Attachment */}
      {button && (
        <div className="mt-3">
          <Link
            to="/view-button-page/$pageId"
            params={{ pageId: button.button_page_id }}
          >
            <Button
              variant={button.appearance.style === "outline" ? "outline" : "default"}
              className={`w-full ${
                button.appearance.color === "blue" ? "bg-blue-500 hover:bg-blue-600" :
                button.appearance.color === "green" ? "bg-green-500 hover:bg-green-600" :
                button.appearance.color === "red" ? "bg-red-500 hover:bg-red-600" :
                button.appearance.color === "purple" ? "bg-purple-500 hover:bg-purple-600" :
                button.appearance.color === "orange" ? "bg-orange-500 hover:bg-orange-600" :
                ""
              }`}
            >
              {button.icon && <span className="mr-2">{button.icon}</span>}
              {button.name}
            </Button>
          </Link>
        </div>
      )}
      
      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleLike}
          className={`inline-flex items-center gap-2 text-sm ${hasLiked ? "text-red-500" : "text-muted-foreground"} hover:text-red-500 transition-colors`}
          disabled={!onToggleLike}
        >
          <Heart className={`h-4 w-4 ${hasLiked ? "fill-current" : ""}`} />
          {likeCount !== undefined ? likeCount : ""}
        </button>
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
