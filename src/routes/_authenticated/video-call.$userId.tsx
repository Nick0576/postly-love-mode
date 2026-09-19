import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Maximize, Minimize } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId } from "@/lib/postly";
import { applyTheme, getTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/video-call/$userId")({
  head: () => ({
    meta: [
      { title: "Video Call — Postly" },
      { name: "description", content: "Video call with your friends." },
      { property: "og:title", content: "Video Call — Postly" },
      { property: "og:description", content: "Video call." },
    ],
  }),
  component: VideoCall,
});

function VideoCall() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    applyTheme(getTheme());
    startCall();
    return () => cleanup();
  }, []);

  async function startCall() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      // Add local stream tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          // Send ICE candidate through signaling
          sendSignal({ type: 'ice-candidate', candidate: event.candidate });
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({ type: 'offer', sdp: offer });

    } catch (error) {
      console.error('Error starting call:', error);
      alert('Could not access camera/microphone');
      navigate({ to: '/messages/$userId', params: { userId } });
    }
  }

  function sendSignal(data: any) {
    // Send signaling data through Supabase real-time
    // This is a simplified version - you'd need to implement proper signaling
    console.log('Sending signal:', data);
  }

  function cleanup() {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  }

  function toggleMute() {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }

  function toggleVideo() {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }

  function endCall() {
    cleanup();
    navigate({ to: '/messages/$userId', params: { userId } });
  }

  function toggleFullscreen() {
    if (!isFullscreen) {
      if (remoteVideoRef.current?.requestFullscreen) {
        remoteVideoRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  }

  return (
    <AppShell title="Video Call">
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Video Container */}
        <div className="flex-1 relative bg-black rounded-2xl overflow-hidden">
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Local Video (Picture in Picture) */}
          <div className="absolute bottom-4 right-4 w-32 h-48 bg-gray-900 rounded-lg overflow-hidden shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          {/* Connection Status */}
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white">Connecting...</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 py-4">
          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleMute}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          
          <Button
            variant="destructive"
            size="lg"
            onClick={endCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          
          <Button
            variant={isVideoOff ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleVideo}
          >
            {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
