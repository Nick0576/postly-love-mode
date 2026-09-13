import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  theme?: string;
  chat_bubble_text?: string;
  chat_bubble_enabled?: boolean;
  last_seen?: string;
  is_online?: boolean;
};

export type PostRow = {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  profiles: Profile | null;
};

export const POST_SELECT =
  "id,user_id,content,media_url,created_at,profiles(id,username,display_name,bio,avatar_url,chat_bubble_text,chat_bubble_enabled,last_seen,is_online)";

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("media").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function uploadMedia(file: File): Promise<string> {
  const uid = await currentUserId();
  const path = `${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "")}`;
  const { error } = await supabase.storage.from("media").upload(path, file);
  if (error) throw error;
  return path;
}

export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// Chat bubble localStorage fallback
const CHAT_BUBBLE_KEY = "postly-chat-bubble";

export function getChatBubbleFromStorage(): { text: string; enabled: boolean } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const data = localStorage.getItem(CHAT_BUBBLE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveChatBubbleToStorage(text: string, enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CHAT_BUBBLE_KEY, JSON.stringify({ text, enabled }));
}

// Online status utilities
export async function setOnlineStatus(online: boolean): Promise<void> {
  const uid = await currentUserId();
  await supabase
    .from("profiles")
    .update({ 
      is_online: online,
      last_seen: online ? null : new Date().toISOString()
    })
    .eq("id", uid);
}

export function isUserOnline(profile: Profile): boolean {
  if (!profile.is_online) return false;
  if (!profile.last_seen) return true;
  // Consider user online if they were seen in the last 5 minutes
  const lastSeen = new Date(profile.last_seen).getTime();
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return lastSeen > fiveMinutesAgo;
}

export const LOVE_QUESTIONS = [
  "Do you believe in true love?",
  "Do you believe love can last forever?",
  "Do you believe in love at first sight?",
  "Can love grow over time?",
  "Can two best friends fall in love?",
  "Is trust important in love?",
  "Is communication important in a relationship?",
  "Can long-distance love work?",
  "Can love survive without trust?",
  "Can someone fall in love more than once?",
  "Can love change a person?",
  "Is forgiveness important in love?",
  "Should couples always be honest with each other?",
  "Can opposites fall in love?",
  "Can love make people happier?",
  "Can love survive difficult times?",
  "Is loyalty important in a relationship?",
  "Can friendship become love?",
  "Can love exist without a relationship?",
  "Is love worth taking a risk for? ❤️",
] as const;
