import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, uploadMedia } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

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
  const [showButtonOptions, setShowButtonOptions] = useState(false);
  const [buttonName, setButtonName] = useState("");
  const [buttonIcon, setButtonIcon] = useState("");
  const [buttonColor, setButtonColor] = useState("default");
  const navigate = useNavigate();

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

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
      
      // Create post
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .insert({ user_id, content: text, media_url })
        .select("id")
        .single();
      
      if (postError) throw postError;
      
      // If button is attached, create button page and button
      if (showButtonOptions && buttonName.trim()) {
        // Create button page
        const { data: pageData, error: pageError } = await supabase
          .from("button_pages")
          .insert({
            user_id,
            title: buttonName,
            description: `Button page for ${buttonName}`
          })
          .select("id")
          .single();
        
        if (pageError) throw pageError;
        
        // Create button
        const { error: buttonError } = await supabase
          .from("buttons")
          .insert({
            post_id: postData.id,
            user_id,
            name: buttonName,
            icon: buttonIcon,
            appearance: { color: buttonColor, style: "filled" },
            button_page_id: pageData.id
          });
        
        if (buttonError) throw buttonError;
      }
      
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
        
        {/* Button Attachment Section */}
        <div className="rounded-2xl border p-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="attachButton"
              checked={showButtonOptions}
              onChange={(e) => setShowButtonOptions(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="attachButton">Attach a Button</Label>
          </div>
          
          {showButtonOptions && (
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="buttonName">Button Name</Label>
                <Input
                  id="buttonName"
                  value={buttonName}
                  onChange={(e) => setButtonName(e.target.value)}
                  placeholder="e.g., My Portfolio"
                  maxLength={30}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="buttonIcon">Button Icon (emoji)</Label>
                <Input
                  id="buttonIcon"
                  value={buttonIcon}
                  onChange={(e) => setButtonIcon(e.target.value)}
                  placeholder="e.g., 🚀"
                  maxLength={2}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="buttonColor">Button Color</Label>
                <select
                  id="buttonColor"
                  value={buttonColor}
                  onChange={(e) => setButtonColor(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="default">Default</option>
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                  <option value="red">Red</option>
                  <option value="purple">Purple</option>
                  <option value="orange">Orange</option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                A custom page will be created for this button. You can edit it after posting.
              </p>
            </div>
          )}
        </div>
        
        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? "Posting…" : "Post"}
        </Button>
      </div>
    </AppShell>
  );
}
