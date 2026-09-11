import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
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
  "id,user_id,content,media_url,created_at,profiles(id,username,display_name,bio,avatar_url)";

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

export const LOVE_QUESTIONS = [
  "Mornings or nights?",
  "Coffee or tea?",
  "Beach or mountains?",
  "Texting or calling?",
  "Cats or dogs?",
  "Stay in or go out?",
  "Sweet or savory?",
  "Planner or spontaneous?",
  "Music or podcasts?",
  "City or countryside?",
  "Movies or series?",
  "Summer or winter?",
  "Books or games?",
  "Cook or takeout?",
  "Big party or small circle?",
  "Early bird or night owl?",
  "Adventure or comfort?",
  "Talk it out or need space?",
  "Surprises or plans?",
  "Slow love or fast spark?",
] as const;
