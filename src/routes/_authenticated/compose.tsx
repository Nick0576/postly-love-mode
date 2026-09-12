import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, uploadMedia } from "@/lib/postly";

export const Route = createFileRoute("/_authenticated/compose")({
  head: () => ({
    meta: [
      { title: "New Post — Postly" },
      { name: "description", content: "Write a post and share a photo with your Postly friends." },
      { property: "og:title", content: "New Post — Postly" },
      { property: "og:description", content: "Write a post on Postly." },
    ],
  }),
  component: Compose,
});

function Compose() {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit() {
    const text = content.trim();
    if (!text && !file) {
      toast.error("Write something first");
      return;
    }
    if (text.length > 1000) {
      toast.error("Post is too long (max 1000)");
      return;
    }
    setBusy(true);
    try {
      const user_id = await currentUserId();
      const media_url = file ? await uploadMedia(file) : null;
      const { error } = await supabase.from("posts").insert({ user_id, content: text, media_url });
      if (error) throw error;
      toast.success("Posted");
      void navigate({ to: "/feed" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="New post">
      <div className="space-y-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          rows={6}
          placeholder="What's happening?"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted-foreground"
        />
        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? "Posting…" : "Post"}
        </Button>
      </div>
    </AppShell>
  );
}
