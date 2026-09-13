import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Video, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, uploadMedia, signedUrl, type Profile } from "@/lib/postly";
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
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
    if (!body || !data) return;
    setText("");
    await supabase.from("messages").insert({ sender_id: data.me, recipient_id: userId, content: body });
    void qc.invalidateQueries({ queryKey: ["chat", userId] });
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
            {m.media_type === "audio" && m.media_url && (
              <VoiceMessage mediaUrl={m.media_url} />
            )}
            {m.content && !m.media_type && m.content}
            {m.sender_id === data.me && (
              <button
                onClick={() => {
                  if (confirm("Delete this message?")) {
                    deleteMessage.mutate(m.id);
                  }
                }}
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {data && !data.msgs.length && <p className="text-sm text-muted-foreground">Say hello.</p>}
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
          placeholder="Message"
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
