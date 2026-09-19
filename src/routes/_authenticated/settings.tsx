import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MusicPicker, type MusicPick } from "@/components/MusicPicker";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, uploadMedia, type Profile, getChatBubbleFromStorage, saveChatBubbleToStorage, unblockUser, getBlockedUsers } from "@/lib/postly";
import { applyTheme, getTheme, setTheme, type Theme } from "@/lib/theme";

const PRESET_GAMES = [
  "Minecraft",
  "Roblox",
  "Genshin Impact",
  "Mobile Legends",
  "Fortnite",
  "PUBG",
  "Call of Duty",
  "Free Fire",
  "Among Us",
  "Pokémon",
  "Silver Palace",
  "Until Then",
  "Leaflet Love Story",
  "I Fell in Love With the Girl Next to Me",
  "Sekaira",
];

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
  const qc = useQueryClient();
  const [theme, setThemeState] = useState<Theme>("light");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [chatBubbleText, setChatBubbleText] = useState("");
  const [chatBubbleEnabled, setChatBubbleEnabled] = useState(false);
  const [chatBubbleMusicVideoId, setChatBubbleMusicVideoId] = useState<string | "">("");
  const [chatBubbleMusicTitle, setChatBubbleMusicTitle] = useState<string | "">("");
  const [chatBubbleMusicClipStart, setChatBubbleMusicClipStart] = useState<number | null>(null);
  const [chatBubbleMusicClipEnd, setChatBubbleMusicClipEnd] = useState<number | null>(null);
  const [profileViewHistoryEnabled, setProfileViewHistoryEnabled] = useState(true);
  const [favoriteGames, setFavoriteGames] = useState<string[]>([]);
  const [newGameInput, setNewGameInput] = useState<string | "">("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taps = useRef(0);
  const hasClipColumnsRef = useRef(true);
  const hasFavoriteGamesRef = useRef(true);

  useEffect(() => {
    const theme = getTheme();
    setThemeState(theme);
    applyTheme(theme);
  }, []);

  const { data: me, error: queryError, isError } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const uid = await currentUserId();
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();
        if (error) throw error;
        const p = data as Profile | null;
        // The music-clip columns are added by migration
        // 20260917_add_music_clip_to_profiles.sql; skip them in the update
        // payload until the migration has been applied to the database.
        hasClipColumnsRef.current = p ? "chat_bubble_music_clip_start" in p : false;
        hasFavoriteGamesRef.current = p ? "favorite_games" in p : false;
        setName(p?.display_name ?? "");
        setBio(p?.bio ?? "");
        
        // Try to load from database, fall back to localStorage
        const dbBubbleText = p?.chat_bubble_text;
        const dbBubbleEnabled = p?.chat_bubble_enabled;
        const localBubble = getChatBubbleFromStorage();
        
        setChatBubbleText(dbBubbleText ?? localBubble?.text ?? "");
        setChatBubbleEnabled(dbBubbleEnabled ?? localBubble?.enabled ?? false);
        setChatBubbleMusicVideoId(p?.chat_bubble_music_video_id ?? "");
        setChatBubbleMusicTitle(p?.chat_bubble_music_title ?? "");
        setChatBubbleMusicClipStart(p?.chat_bubble_music_clip_start ?? null);
        setChatBubbleMusicClipEnd(p?.chat_bubble_music_clip_end ?? null);
        setProfileViewHistoryEnabled(p?.profile_view_history_enabled ?? true);
        setFavoriteGames(p?.favorite_games ?? []);
        return p;
      } catch (e) {
        setError(e instanceof Error ? e.message : ((e as { message?: string })?.message ?? String(e)));
        throw e;
      }
    },
  });

  const { data: blockedUsers } = useQuery({
    queryKey: ["blocked-users"],
    queryFn: async () => {
      const blockedIds = await getBlockedUsers();
      if (blockedIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", blockedIds);
      return data ?? [];
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async (blockedUserId: string) => {
      await unblockUser(blockedUserId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked-users"] });
    },
  });

  async function save(avatar_url?: string, isBanner?: boolean) {
    if (!me) return;
    try {
      console.log("Saving favorite games:", favoriteGames);
      console.log("Has favorite games column:", hasFavoriteGamesRef.current);
      
      // Save to localStorage as fallback
      saveChatBubbleToStorage(chatBubbleText, chatBubbleEnabled);
      
      // Try to save to database
      const { error } = await supabase
        .from("profiles")
        .update({ 
          display_name: name, 
          bio, 
          chat_bubble_text: chatBubbleText,
          chat_bubble_enabled: chatBubbleEnabled,
          chat_bubble_music_video_id: chatBubbleMusicVideoId,
          chat_bubble_music_title: chatBubbleMusicTitle,
          profile_view_history_enabled: profileViewHistoryEnabled,
          ...(avatar_url && !isBanner ? { avatar_url } : {}),
          ...(avatar_url && isBanner ? { banner_url: avatar_url } : {}),
          // Music-clip columns are added by migration
          // 20260917_add_music_clip_to_profiles.sql; only send them once the
          // migration has been applied (detected at profile load).
          ...(hasClipColumnsRef.current
            ? {
                chat_bubble_music_clip_start: chatBubbleMusicClipStart,
                chat_bubble_music_clip_end: chatBubbleMusicClipEnd,
              }
            : {}),
          ...(hasFavoriteGamesRef.current ? { favorite_games: favoriteGames } : {}),
        })
        .eq("id", me.id);
      
      console.log("Save error:", error);
      
      // If database update fails, still show success since localStorage saved
      if (error) {
        console.warn("Failed to save chat bubble to database, saved to localStorage instead:", error);
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
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

  const errorText = (e: unknown) => e instanceof Error ? e.message : ((e as { message?: string })?.message ?? String(e));

  return (
    <AppShell title="Settings">
      {(error || queryError) && (
        <div className="mb-4 rounded-lg border border-red-500 bg-red-50 p-4 dark:bg-red-950/20">
          <h3 className="font-semibold text-red-900 dark:text-red-100">Error loading settings</h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{errorText(error || queryError)}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              navigator.clipboard.writeText(errorText(error || queryError));
              alert("Error copied to clipboard");
            }}
          >
            Copy Error
          </Button>
        </div>
      )}
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
          <div className="space-y-1">
            <Label htmlFor="banner">Banner image</Label>
            <Input
              id="banner"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await save(await uploadMedia(f), true);
              }}
            />
          </div>
          <Button onClick={() => void save()}>{saved ? "Saved" : "Save"}</Button>
          {me && (
            <Button asChild variant="outline" className="w-full">
              <Link to="/u/$username" params={{ username: me.username }}>
                View Profile
              </Link>
            </Button>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border p-4">
          <h2 className="font-semibold">Chat Bubble</h2>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="chatBubbleEnabled"
              checked={chatBubbleEnabled}
              onChange={(e) => setChatBubbleEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="chatBubbleEnabled">Enable chat bubble on profile</Label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="chatBubbleText">Bubble text</Label>
            <Input
              id="chatBubbleText"
              value={chatBubbleText}
              onChange={(e) => setChatBubbleText(e.target.value)}
              placeholder="Short text for your bubble..."
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">Max 50 characters</p>
          </div>
          <div className="space-y-1">
            <Label>Bubble Music</Label>
            {chatBubbleMusicVideoId ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{chatBubbleMusicTitle}</p>
                <Button variant="outline" size="sm" onClick={() => {
                  setChatBubbleMusicVideoId("");
                  setChatBubbleMusicTitle("");
                  setChatBubbleMusicClipStart(null);
                  setChatBubbleMusicClipEnd(null);
                  void save();
                }}>
                  Remove Music
                </Button>
              </div>
            ) : (
              <MusicPicker onPick={(m: MusicPick) => {
                setChatBubbleMusicVideoId(m.videoId);
                setChatBubbleMusicTitle(m.title);
                void save();
              }} />
            )}
          </div>
                    <Button onClick={() => void save()}>{saved ? "Saved" : "Save"}</Button>
        </section>

        <section className="space-y-3 rounded-2xl border p-4">
          <h2 className="font-semibold">Favorite Games</h2>
          <p className="text-xs text-muted-foreground">Select or unselect games to show on your profile. You can also add custom games.</p>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Add Custom Game</label>
            <div className="flex gap-2">
              <Input
                value={newGameInput}
                onChange={(e) => setNewGameInput(e.target.value)}
                placeholder="Type game name here..."
                maxLength={50}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const trimmed = newGameInput.trim();
                  if (trimmed && !favoriteGames.includes(trimmed)) {
                    setFavoriteGames([...favoriteGames, trimmed]);
                    setNewGameInput("");
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Preset Games</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_GAMES.map((game) => (
                <Button
                  key={game}
                  variant={favoriteGames.includes(game) ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    const updated = favoriteGames.includes(game)
                      ? favoriteGames.filter((g) => g !== game)
                      : [...favoriteGames, game];
                    setFavoriteGames(updated);
                  }}
                >
                  {game}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={() => void save()}>{saved ? "Saved" : "Save"}</Button>
        </section>

        <section className="space-y-3 rounded-2xl border p-4">
          <h2 className="font-semibold">Privacy</h2>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="profileViewHistoryEnabled"
              checked={profileViewHistoryEnabled}
              onChange={(e) => setProfileViewHistoryEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="profileViewHistoryEnabled">Profile View History</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            When ON, your profile visits are recorded and you can see who viewed your profile. When OFF, your visits are not recorded and you cannot see who viewed your profile.
          </p>
          <Button onClick={() => void save()}>{saved ? "Saved" : "Save"}</Button>
        </section>

        <section className="space-y-3 rounded-2xl border p-4">
          <h2 className="font-semibold">Blocked Accounts</h2>
          {blockedUsers && blockedUsers.length > 0 ? (
            <div className="space-y-3">
              {blockedUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <Avatar url={user.avatar_url} name={user.display_name} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.display_name || user.username}</p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unblockMutation.mutate(user.id)}
                  >
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No blocked accounts</p>
          )}
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
                await supabase.from("stories").delete().eq("user_id", uid);
                await supabase.from("posts").delete().eq("user_id", uid);
                await supabase.from("messages").delete().or(`sender_id.eq.${uid},recipient_id.eq.${uid}`);
                await supabase.from("follows").delete().or(`follower_id.eq.${uid},following_id.eq.${uid}`);
                await supabase.from("love_answers").delete().eq("user_id", uid);
                await supabase.from("profiles").delete().eq("id", uid);
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
