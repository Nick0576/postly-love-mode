import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, uploadMedia, type Profile } from "@/lib/postly";
import { applyTheme, getTheme, setTheme, type Theme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Postly" },
      { name: "description", content: "Edit your Postly profile, switch theme and donate a file." },
      { property: "og:title", content: "Settings — Postly" },
      { property: "og:description", content: "Edit your profile, switch theme and donate a file." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [theme, setThemeState] = useState<Theme>("light");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);
  const taps = useRef(0);

  useEffect(() => {
    const theme = getTheme();
    setThemeState(theme);
    applyTheme(theme);
  }, []);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const uid = await currentUserId();
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name,bio,avatar_url")
        .eq("id", uid)
        .maybeSingle();
      const p = data as Profile | null;
      setName(p?.display_name ?? "");
      setBio(p?.bio ?? "");
      return p;
    },
  });

  async function save(avatar_url?: string) {
    if (!me) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name, bio, ...(avatar_url ? { avatar_url } : {}) })
        .eq("id", me.id);
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      console.error("Failed to save profile:", e);
      alert("Failed to save profile. Please try again.");
    }
  }

  function secretTap() {
    taps.current += 1;
    if (taps.current >= 5) {
      taps.current = 0;
      void navigate({ to: "/love" });
    }
  }

  return (
    <AppShell title="Settings">
      <div className="space-y-6">
        <section className="space-y-3 rounded-2xl border p-4">
          <h2 className="font-semibold">Profile</h2>
          <div className="space-y-1">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="avatar">Profile photo</Label>
            <Input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await save(await uploadMedia(f));
              }}
            />
          </div>
          <Button onClick={() => void save()}>{saved ? "Saved" : "Save"}</Button>
        </section>

        <section className="space-y-3 rounded-2xl border p-4">
          <h2 className="font-semibold">Appearance</h2>
          <Button
            variant="outline"
            onClick={() => {
              const next: Theme = theme === "dark" ? "light" : "dark";
              setTheme(next);
              setThemeState(next);
            }}
          >
            {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          </Button>
        </section>

        <section className="space-y-3 rounded-2xl border p-4">
          <h2 className="font-semibold">Support</h2>
          <Button onClick={() => void navigate({ to: "/donate" })}>Donate a File</Button>
        </section>

        <section className="rounded-2xl border p-4">
          <Button variant="outline" onClick={async () => {
            await supabase.auth.signOut();
            void navigate({ to: "/auth" });
          }}>
            Log out
          </Button>
        </section>

        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
          <h2 className="font-semibold text-red-900 dark:text-red-100">Danger Zone</h2>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            Deleting your account is permanent and cannot be undone.
          </p>
          <Button
            variant="destructive"
            className="mt-3"
            onClick={async () => {
              if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
                const uid = await currentUserId();
                await supabase.from("profiles").delete().eq("id", uid);
                await supabase.from("posts").delete().eq("user_id", uid);
                await supabase.from("follows").delete().or(`follower_id.eq.${uid},following_id.eq.${uid}`);
                await supabase.from("love_answers").delete().eq("user_id", uid);
                await supabase.auth.signOut();
                void navigate({ to: "/auth" });
              }
            }}
          >
            Delete Account
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
