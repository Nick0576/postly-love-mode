import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, uploadMedia, createStory } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/story")({
  head: () => ({
    meta: [
      { title: "New Story — Postly" },
      { name: "description", content: "Create a story on Postly." },
      { property: "og:title", content: "New Story — Postly" },
      { property: "og:description", content: "Create a story on Postly." },
    ],
  }),
  component: StoryCreate,
});

function StoryCreate() {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [mediaType, setMediaType] = useState<"text" | "image" | "video">("text");
  const navigate = useNavigate();

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  async function submit() {
    const text = content.trim();
    if (mediaType === "text" && !text) {
      toast.error("Write something first");
      return;
    }
    if (mediaType !== "text" && !file) {
      toast.error("Select a file first");
      return;
    }
    if (text.length > 500) {
      toast.error("Story is too long (max 500)");
      return;
    }
    setBusy(true);
    try {
      const media_url = file ? await uploadMedia(file) : null;
      await createStory(text, media_url, mediaType);
      toast.success("Story created");
      navigate({ to: "/feed" });
    } catch (e) {
      console.error(e);
      toast.error("Failed to create story");
    }
    setBusy(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (selected.type.startsWith("image/")) {
        setMediaType("image");
      } else if (selected.type.startsWith("video/")) {
        setMediaType("video");
      }
    }
  }

  return (
    <AppShell title="New Story">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={mediaType === "text" ? "default" : "outline"}
            size="sm"
            onClick={() => setMediaType("text")}
          >
            Text
          </Button>
          <Button
            variant={mediaType === "image" ? "default" : "outline"}
            size="sm"
            onClick={() => setMediaType("image")}
          >
            Photo
          </Button>
          <Button
            variant={mediaType === "video" ? "default" : "outline"}
            size="sm"
            onClick={() => setMediaType("video")}
          >
            Video
          </Button>
        </div>

        {mediaType === "text" && (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={500}
            rows={4}
          />
        )}

        {mediaType !== "text" && (
          <div>
            <input
              type="file"
              accept={mediaType === "image" ? "image/*" : "video/*"}
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {file && <p className="text-sm text-muted-foreground mt-2">{file.name}</p>}
          </div>
        )}

        {mediaType === "text" && (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a caption (optional)"
            maxLength={500}
            rows={2}
          />
        )}

        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? "Creating..." : "Create Story"}
        </Button>
      </div>
    </AppShell>
  );
}
