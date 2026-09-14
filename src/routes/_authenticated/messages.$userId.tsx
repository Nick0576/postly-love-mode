import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Video, Send, X, Edit2, ImagePlus, Smile, FileImage } from "lucide-react";
import { GifPicker } from "@/components/GifPicker";

const STICKERS = ["😀","😂","🥰","😍","😎","🤔","😭","😡","👍","👎","🙏","👏","🔥","💯","🎉","✨","❤️","💔","💕","🌹","🐱","🐶","🍕","☕","🌙","⭐","🎵","⚽","🎮","🚀","🌈","💎"];
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, uploadMedia, signedUrl, type Profile, editMessage } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

type Msg = { id: string; sender_id: string; content: string; media_url: string | null; media_type: string | null; created_at: string };

export const Route = createFileRoute("/_authenticated/messages/$userId")({
  head: () => ({
    meta: [
      { title: "Chat — Postly" },
      { name: "description", content: "Send and receive live direct messages on Postly." },
      { property: "og:title", content: "Chat — Postly" },
      { property: "og:description", content: "Send and receive live direct messages on Postly." },
    ],
  }),
  component: Chat,
});

function Chat() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 250) + 'px';
    }
  };

  useEffect(() => {
    autoResizeTextarea();
  }, [text]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showStickers, setShowStickers] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  const { data } = useQuery({
    queryKey: ["chat", userId],
    queryFn: async () => {
      const me = await currentUserId();
      const [msgs, person] = await Promise.all([
        supabase
          .from("messages")
          .select("id,sender_id,content,media_url,media_type,created_at")
          .or(
            `and(sender_id.eq.${me},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${me})`,
          )
          .order("created_at", { ascending: true })
          .limit(100),
        supabase.from("profiles").select("id,username,display_name,bio,avatar_url").eq("id", userId).maybeSingle(),
      ]);
      return { me, msgs: (msgs.data ?? []) as Msg[], person: person.data as Profile | null };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`dm-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void qc.invalidateQueries({ queryKey: ["chat", userId] });
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [userId, qc]);

  async function send() {
    const body = text.trim();
    console.log("Send called with text:", body, "data:", data);
    if (!body) {
      console.log("No body, returning");
      return;
    }
    if (!data) {
      console.log("No data, returning");
      return;
    }
    try {
      setText("");
      console.log("Inserting message with sender_id:", data.me, "recipient_id:", userId, "content:", body);
      const { error } = await supabase.from("messages").insert({ sender_id: data.me, recipient_id: userId, content: body });
      if (error) {
        console.error("Failed to send message:", error);
        setText(body); // Restore text on error
        alert("Failed to send message: " + error.message);
        return;
      }
      console.log("Message sent successfully");
      void qc.invalidateQueries({ queryKey: ["chat", userId] });
    } catch (e) {
      console.error("Error sending message:", e);
      setText(body); // Restore text on error
      alert("Error sending message: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function sendVoice(audioBlob: Blob) {
    if (!data) return;
    const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
    const media_url = await uploadMedia(file);
    await supabase.from("messages").insert({ 
      sender_id: data.me, 
      recipient_id: userId, 
      content: "",
      media_url,
      media_type: "audio"
    });
    void qc.invalidateQueries({ queryKey: ["chat", userId] });
  }

  async function sendFile(file: File) {
    if (!data) return;
    setUploading(true);
    try {
      const media_url = await uploadMedia(file);
      await supabase.from("messages").insert({
        sender_id: data.me,
        recipient_id: userId,
        content: "",
        media_url,
        media_type: file.type.startsWith("video") ? "video" : "image",
      });
      void qc.invalidateQueries({ queryKey: ["chat", userId] });
    } finally {
      setUploading(false);
    }
  }

  async function sendSticker(sticker: string) {
    if (!data) return;
    setShowStickers(false);
    await supabase.from("messages").insert({
      sender_id: data.me,
      recipient_id: userId,
      content: sticker,
      media_type: "sticker",
    });
    void qc.invalidateQueries({ queryKey: ["chat", userId] });
  }

  async function sendGif(url: string) {
    if (!data) return;
    setShowGifs(false);
    await supabase.from("messages").insert({
      sender_id: data.me,
      recipient_id: userId,
      content: "",
      media_url: url,
      media_type: "gif",
    });
    void qc.invalidateQueries({ queryKey: ["chat", userId] });
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

  function startVideoCall() {
    alert("Video call feature coming soon!");
  }

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!data) return;
      const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", data.me);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["chat", userId] }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      await editMessage(messageId, content);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chat", userId] });
      setEditingMessageId(null);
      setEditText("");
    },
  });

  function startEdit(messageId: string, content: string) {
    setEditingMessageId(messageId);
    setEditText(content);
  }

  function saveEdit() {
    if (editingMessageId && editText.trim()) {
      editMutation.mutate({ messageId: editingMessageId, content: editText.trim() });
    }
  }

  const deleteChat = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const { error } = await supabase
        .from("messages")
        .delete()
        .or(`and(sender_id.eq.${data.me},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${data.me})`);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chat", userId] });
      void qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  return (
    <AppShell 
      title={data?.person ? `@${data.person.username}` : "Chat"}
      headerAction={
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={startVideoCall}
          >
            <Video className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Delete all messages in this chat? This cannot be undone.")) {
                deleteChat.mutate();
              }
            }}
            disabled={deleteChat.isPending}
          >
            Delete Chat
          </Button>
        </div>
      }
    >
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
                {m.media_type === "image" && m.media_url && (
                  <ChatMedia mediaUrl={m.media_url} kind="image" />
                )}
                {m.media_type === "video" && m.media_url && (
                  <ChatMedia mediaUrl={m.media_url} kind="video" />
                )}
                {m.media_type === "gif" && m.media_url && (
                  <img src={m.media_url} alt="GIF" className="max-h-64 rounded-lg" />
                )}
                {m.media_type === "sticker" && <span className="text-4xl">{m.content}</span>}
                {m.content && !m.media_type && m.content}
              </>
            )}
            {m.sender_id === data.me && editingMessageId !== m.id && (
              <div className="absolute -top-2 -right-2 flex gap-1">
                <button
                  onClick={() => startEdit(m.id, m.content || "")}
                  className="h-5 w-5 rounded-full bg-blue-500 text-white text-xs transition-opacity"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this message?")) {
                      deleteMessage.mutate(m.id);
                    }
                  }}
                  className="h-5 w-5 rounded-full bg-red-500 text-white text-xs transition-opacity"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
        {data && !data.msgs.length && <p className="text-sm text-muted-foreground">Say hello.</p>}
      </div>
      {showGifs && data && (
        <GifPicker customerId={data.me} onPick={(g) => void sendGif(g.url)} />
      )}
      {showStickers && (
        <div className="fixed inset-x-0 bottom-32 mx-auto grid max-w-xl grid-cols-8 gap-1 rounded-2xl border bg-background p-3 shadow-lg">
          {STICKERS.map((s) => (
            <button key={s} className="text-2xl" onClick={() => void sendSticker(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="fixed inset-x-0 bottom-16 mx-auto flex max-w-xl flex-col gap-2 bg-background px-4 py-3">
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void sendFile(f);
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={isRecording || uploading}>
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => { setShowGifs((v) => !v); setShowStickers(false); }} disabled={isRecording}>
            <FileImage className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => { setShowStickers((v) => !v); setShowGifs(false); }} disabled={isRecording}>
            <Smile className="h-4 w-4" />
          </Button>
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
        </div>
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              autoResizeTextarea();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Message"
            aria-label="Message"
            disabled={isRecording}
            className="min-h-[80px] max-h-[250px] resize-none overflow-hidden flex-1"
            rows={1}
          />
          <Button onClick={() => void send()} disabled={isRecording || !text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
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

function ChatMedia({ mediaUrl, kind }: { mediaUrl: string; kind: "image" | "video" }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    void signedUrl(mediaUrl).then(setUrl);
  }, [mediaUrl]);

  if (!url) return <div className="text-xs">Loading…</div>;
  if (kind === "video") return <video controls className="max-h-64 rounded-lg" src={url} />;
  return <img src={url} alt="Shared media" className="max-h-64 rounded-lg" />;
}
