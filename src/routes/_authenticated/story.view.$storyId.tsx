import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, type Story, deleteStory, signedUrl, isStoryExpired } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/story/view/$storyId")({
  component: StoryViewer,
});

function StoryViewer() {
  const { storyId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  const { data: story, isLoading } = useQuery({
    queryKey: ["story", storyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stories")
        .select("*,profiles(*)")
        .eq("id", storyId)
        .single();
      return data as Story;
    },
  });

  const { data: isOwnStory } = useQuery({
    queryKey: ["is-own-story", storyId],
    queryFn: async () => {
      const me = await currentUserId();
      return story?.user_id === me;
    },
    enabled: !!story,
  });

  useEffect(() => {
    if (story?.media_url) {
      signedUrl(story.media_url).then(setMediaUrl);
    }
  }, [story?.media_url]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteStory(storyId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stories"] });
      navigate({ to: "/feed" });
    },
  });

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!story || isStoryExpired(story)) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <p className="text-white">Story not found or expired</p>
        <Button onClick={() => navigate({ to: "/feed" })} className="absolute top-4 right-4">
          <X className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Avatar
            url={story.profiles?.avatar_url}
            name={story.profiles?.display_name || story.profiles?.username}
            size={40}
          />
          <div>
            <p className="text-white font-semibold">{story.profiles?.display_name || story.profiles?.username}</p>
            <p className="text-white/60 text-xs">{new Date(story.created_at).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwnStory && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm("Delete this story?")) deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-5 w-5 text-white" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/feed" })}>
            <X className="h-6 w-6 text-white" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        {story.media_type === "text" && (
          <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl p-8 max-w-md w-full">
            <p className="text-white text-2xl text-center">{story.content}</p>
          </div>
        )}
        {story.media_type === "image" && mediaUrl && (
          <img src={mediaUrl} alt="Story" className="max-w-full max-h-full object-contain" />
        )}
        {story.media_type === "video" && mediaUrl && (
          <video src={mediaUrl} controls autoPlay className="max-w-full max-h-full" />
        )}
      </div>

      {/* Caption */}
      {story.content && story.media_type !== "text" && (
        <div className="p-4">
          <p className="text-white">{story.content}</p>
        </div>
      )}
    </div>
  );
}
