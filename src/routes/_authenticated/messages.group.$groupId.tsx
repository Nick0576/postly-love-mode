import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Video, Send, X, Users, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, uploadMedia, signedUrl, type Profile, type GroupChat, getGroupMembers, addGroupMember, renameGroupChat, deleteGroupChat, editMessage } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

type Msg = { id: string; sender_id: string; content: string; media_url: string | null; media_type: string | null; created_at: string; profiles: Profile | null };

export const Route = createFileRoute("/_authenticated/messages/group/$groupId")({
  head: () => ({
    meta: [
      { title: "Group Chat — Postly" },
      { name: "description", content: "Group chat on Postly." },
      { property: "og:title", content: "Group Chat — Postly" },
      { property: "og:description", content: "Group chat on Postly." },
    ],
  }),
  component: GroupChat,
});

function GroupChat() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showMembers, setShowMembers] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data } = useQuery({
    queryKey: ["group-chat", groupId],
    queryFn: async () => {
      const me = await currentUserId();
      const [msgs, group, members] = await Promise.all([
        supabase
          .from("messages")
          .select("id,sender_id,content,media_url,media_type,created_at,profiles(*)")
          .eq("group_id", groupId)
          .order("created_at", { ascending: true })
          .limit(100),
        supabase.from("group_chats").select("*").eq("id", groupId).maybeSingle(),
        getGroupMembers(groupId),
      ]);
      return { me, msgs: (msgs.data ?? []) as unknown as Msg[], group: (group.data ?? null) as GroupChat | null, members };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`group-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void qc.invalidateQueries({ queryKey: ["group-chat", groupId] });
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [groupId, qc]);

  async function send() {
    const body = text.trim();
    if (!body || !data) return;
    setText("");
    await supabase.from("messages").insert({ 
      sender_id: data.me, 
      recipient_id: null, 
      group_id: groupId, 
      content: body 
    });
    void qc.invalidateQueries({ queryKey: ["group-chat", groupId] });
  }

  async function sendVoice(audioBlob: Blob) {
    if (!data) return;
    const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
    const media_url = await uploadMedia(file);
    await supabase.from("messages").insert({ 
      sender_id: data.me, 
      recipient_id: null,
      group_id: groupId,
      content: "",
      media_url,
      media_type: "audio"
    });
    void qc.invalidateQueries({ queryKey: ["group-chat", groupId] });
  }

  function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
          void sendVoice(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        setIsRecording(true);
        setRecordingTime(0);
        
        recordingIntervalRef.current = window.setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      })
      .catch(err => {
        console.error("Error accessing microphone:", err);
        alert("Could not access microphone. Please allow microphone access.");
      });
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }

  async function addMember() {
    const username = newMemberUsername.trim();
    if (!username || !data) return;
    
    // Check if already a member
    if (data.members.some(m => m.profiles?.username === username)) {
      alert("User is already a member");
      return;
    }
    
    // Check if it's the current user
    if (data.members.some(m => m.user_id === data.me && m.profiles?.username === username)) {
      alert("You are already a member");
      return;
    }
    
    // Find user
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    
    if (!profile) {
      alert("User not found");
      return;
    }
    
    if (data.members.length >= 10) {
      alert("Maximum 10 members allowed");
      return;
    }
    
    try {
      await addGroupMember(groupId, profile.id);
      setNewMemberUsername("");
      void qc.invalidateQueries({ queryKey: ["group-chat", groupId] });
    } catch (e) {
      alert("Failed to add member");
    }
  }

  function handleRename() {
    if (newGroupName.trim()) {
      renameMutation.mutate(newGroupName.trim());
    }
  }

  function handleDeleteGroup() {
    if (confirm("Are you sure you want to delete this group? This cannot be undone.")) {
      deleteGroupMutation.mutate();
    }
  }

  function startEdit(messageId: string, content: string) {
    setEditingMessageId(messageId);
    setEditText(content);
  }

  function saveEdit() {
    if (editingMessageId && editText.trim()) {
      editMutation.mutate({ messageId: editingMessageId, content: editText.trim() });
    }
  }

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!data) return;
      const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", data.me);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["group-chat", groupId] }),
  });

  const renameMutation = useMutation({
    mutationFn: async (name: string) => {
      await renameGroupChat(groupId, name);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["group-chat", groupId] });
      setIsRenaming(false);
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      await deleteGroupChat(groupId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chats"] });
      navigate({ to: "/messages" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      await editMessage(messageId, content);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["group-chat", groupId] });
      setEditingMessageId(null);
      setEditText("");
    },
  });

  return (
    <AppShell 
      title={data?.group?.name || "Group Chat"}
      headerAction={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowMembers(!showMembers)}>
            <Users className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowMenu(!showMenu)}>
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      }
    >
      {showMenu && data?.group && (
        <div className="mb-4 p-3 rounded-lg border space-y-2">
          {isRenaming ? (
            <div className="flex gap-2">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="New group name"
                className="flex-1"
              />
              <Button onClick={handleRename} size="sm">Save</Button>
              <Button onClick={() => setIsRenaming(false)} variant="outline" size="sm">Cancel</Button>
            </div>
          ) : (
            <Button onClick={() => { setIsRenaming(true); setNewGroupName(data.group.name); }} variant="outline" size="sm" className="w-full">
              <Edit2 className="h-4 w-4 mr-2" /> Rename Group
            </Button>
          )}
          <Button onClick={handleDeleteGroup} variant="destructive" size="sm" className="w-full">
            <Trash2 className="h-4 w-4 mr-2" /> Delete Group
          </Button>
        </div>
      )}
      {showMembers && data?.members && (
        <div className="mb-4 p-3 rounded-lg border space-y-2">
          <h4 className="font-semibold text-sm">Members ({data.members.length}/10)</h4>
          <div className="flex gap-2">
            <Input
              value={newMemberUsername}
              onChange={(e) => setNewMemberUsername(e.target.value)}
              placeholder="Add by username"
              onKeyDown={(e) => e.key === "Enter" && void addMember()}
              className="flex-1"
            />
            <Button onClick={addMember} size="sm">Add</Button>
          </div>
          <div className="space-y-1">
            {data.members.map((member) => (
              <div key={member.id} className="text-sm flex items-center justify-between">
                <span>{member.profiles?.display_name || member.profiles?.username}</span>
                {member.user_id === data.me && <span className="text-xs text-muted-foreground">(You)</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        {data?.msgs.map((m) => (
          <div
            key={m.id}
            className={`group relative max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              m.sender_id === data.me
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {m.sender_id !== data.me && (
              <p className="text-xs font-semibold mb-1">{m.profiles?.display_name || m.profiles?.username}</p>
            )}
            {editingMessageId === m.id ? (
              <div className="flex gap-2">
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                />
                <Button onClick={saveEdit} size="sm">Save</Button>
                <Button onClick={() => { setEditingMessageId(null); setEditText(""); }} variant="outline" size="sm">Cancel</Button>
              </div>
            ) : (
              <>
                {m.media_type === "audio" && m.media_url && (
                  <VoiceMessage mediaUrl={m.media_url} />
                )}
                {m.content && !m.media_type && m.content}
              </>
            )}
            {m.sender_id === data.me && editingMessageId !== m.id && (
              <div className="absolute -top-2 -right-2 flex gap-1">
                <button
                  onClick={() => startEdit(m.id, m.content || "")}
                  className="h-5 w-5 rounded-full bg-blue-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this message?")) {
                      deleteMessage.mutate(m.id);
                    }
                  }}
                  className="h-5 w-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
        {data && !data.msgs.length && <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>}
      </div>
      <div className="fixed inset-x-0 bottom-16 mx-auto flex max-w-xl gap-2 bg-background px-4 py-3">
        {isRecording ? (
          <Button variant="destructive" onClick={stopRecording} className="flex items-center gap-2">
            <X className="h-4 w-4" />
            {recordingTime}s
          </Button>
        ) : (
          <Button variant="outline" onClick={startRecording} disabled={!!text}>
            <Mic className="h-4 w-4" />
          </Button>
        )}
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder="Message group"
          aria-label="Message"
          disabled={isRecording}
        />
        <Button onClick={() => void send()} disabled={isRecording}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </AppShell>
  );
}

function VoiceMessage({ mediaUrl }: { mediaUrl: string }) {
  const [url, setUrl] = useState<string | null>(null);
  
  useEffect(() => {
    signedUrl(mediaUrl).then(setUrl);
  }, [mediaUrl]);
  
  if (!url) return <div className="text-xs">Loading audio...</div>;
  
  return (
    <audio controls className="max-w-full" src={url}>
      Your browser does not support audio.
    </audio>
  );
}
