import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  chat_bubble_text: string | null;
  chat_bubble_enabled: boolean;
  last_seen: string | null;
  is_online: boolean;
  profile_view_history_enabled: boolean;
};

export type Story = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  created_at: string;
  expires_at: string;
  profiles: Profile | null;
};

export type GroupChat = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  profiles: Profile | null;
};

export type PostRow = {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  is_pinned: boolean;
  profiles: Profile | null;
};

export const POST_SELECT =
  "id,user_id,content,media_url,created_at,is_pinned,profiles(id,username,display_name,bio,avatar_url,banner_url,chat_bubble_text,chat_bubble_enabled,last_seen,is_online,profile_view_history_enabled)";

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

// Story utilities
export async function createStory(content: string, mediaUrl: string | null, mediaType: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase.from("stories").insert({
    user_id: uid,
    content: mediaType === "text" ? content : null,
    media_url: mediaUrl,
    media_type: mediaType,
  });
  if (error) throw error;
}

export async function deleteStory(storyId: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase.from("stories").delete().eq("id", storyId).eq("user_id", uid);
  if (error) throw error;
}

export function isStoryExpired(story: Story): boolean {
  return new Date(story.expires_at) < new Date();
}

// Group chat utilities
export async function createGroupChat(name: string): Promise<string> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from("group_chats")
    .insert({ name, created_by: uid })
    .select("id")
    .single();
  if (error) throw error;
  // Add creator as first member
  await supabase.from("group_members").insert({ group_id: data.id, user_id: uid });
  return data.id;
}

export async function addGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId });
  if (error) throw error;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("*,profiles(*)")
    .eq("group_id", groupId);
  if (error) throw error;
  return data as GroupMember[];
}

export async function getGroupChat(groupId: string): Promise<GroupChat | null> {
  const { data, error } = await supabase
    .from("group_chats")
    .select("*")
    .eq("id", groupId)
    .single();
  if (error) throw error;
  return data as GroupChat;
}

export async function renameGroupChat(groupId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("group_chats")
    .update({ name })
    .eq("id", groupId);
  if (error) throw error;
}

export async function deleteGroupChat(groupId: string): Promise<void> {
  const { error } = await supabase
    .from("group_chats")
    .delete()
    .eq("id", groupId);
  if (error) throw error;
}

export async function editMessage(messageId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ content })
    .eq("id", messageId);
  if (error) throw error;
}

// Profile view utilities
export async function recordProfileView(viewedUserId: string): Promise<void> {
  const viewerId = await currentUserId();
  
  // Check if viewer has profile view history enabled
  const { data: viewer } = await supabase
    .from("profiles")
    .select("profile_view_history_enabled")
    .eq("id", viewerId)
    .single();
  
  if (!viewer?.profile_view_history_enabled) return;
  
  // Check if viewed user has profile view history enabled
  const { data: viewedUser } = await supabase
    .from("profiles")
    .select("profile_view_history_enabled")
    .eq("id", viewedUserId)
    .single();
  
  if (!viewedUser?.profile_view_history_enabled) return;
  
  // Don't record if viewing own profile
  if (viewerId === viewedUserId) return;
  
  // Upsert profile view (update timestamp if exists, insert if not)
  const { error } = await supabase
    .from("profile_views")
    .upsert({ 
      viewer_id: viewerId, 
      viewed_user_id: viewedUserId,
      viewed_at: new Date().toISOString()
    }, { 
      onConflict: "viewer_id,viewed_user_id" 
    });
  
  if (error) throw error;
}

export async function getProfileViews(userId: string): Promise<{ viewer: Profile; viewed_at: string }[]> {
  const { data, error } = await supabase
    .from("profile_views")
    .select("viewer_id,viewed_at,profiles(*)")
    .eq("viewed_user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(50);
  
  if (error) throw error;
  
  return (data ?? []).map((v: any) => ({
    viewer: v.profiles as Profile,
    viewed_at: v.viewed_at
  }));
}

export async function cleanupOldProfileViews(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("profile_views")
    .delete()
    .lt("viewed_at", thirtyDaysAgo);
  if (error) throw error;
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
