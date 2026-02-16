import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MessageSquare,
  PhoneOff,
  Play
} from "lucide-react";
import { clsx } from "clsx";

import { useRoom } from "@/contexts/RoomContext";

export function ControlBar({
  onStartStream,
  onToggleChat,
  onToggleSidebar,
  sidebarOpen,
}: {
  onStartStream: () => void;
  onToggleChat: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}) {
  const { localUser, toggleMute, toggleVideo, toggleScreenShare, isScreenSharing, leaveRoom } = useRoom();

  // Guard: if no user, render nothing or disabled (though RoomPage handles this)
  if (!localUser) return null;

  const isMuted = !localUser.hasAudio;
  const isVideoOff = !localUser.hasVideo;
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-neutral-900/80 backdrop-blur-xl border border-white/10 shadow-2xl transition-all hover:scale-[1.01]">
      <ControlButton
        onClick={toggleMute}
        active={!isMuted}
        icon={isMuted ? MicOff : Mic}
        className={isMuted ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-neutral-800 hover:bg-neutral-700"}
      />
      <ControlButton
        onClick={toggleVideo}
        active={!isVideoOff}
        icon={isVideoOff ? VideoOff : Video}
        className={isVideoOff ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-neutral-800 hover:bg-neutral-700"}
      />

      <div className="w-px h-8 bg-white/10 mx-1" />

      <ControlButton
        onClick={toggleScreenShare}
        icon={MonitorUp}
        active={isScreenSharing}
        title="Share Screen"
        className="bg-neutral-800 hover:bg-neutral-700 hover:text-indigo-400"
      />
      <ControlButton
        onClick={onStartStream}
        icon={Play}
        title="Start Stream URL"
        className="bg-neutral-800 hover:bg-neutral-700 hover:text-pink-400"
      />

      <div className="w-px h-8 bg-white/10 mx-1" />

      <ControlButton
        onClick={onToggleChat}
        icon={MessageSquare}
        title="Chat"
        className={clsx(
          "bg-neutral-800 hover:bg-neutral-700",
          sidebarOpen && "bg-indigo-500/20 text-indigo-300"
        )}
      />

      <button
        onClick={() => {
          leaveRoom();
          window.location.href = "/";
        }}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/90 text-white hover:bg-red-600 hover:scale-110 transition-all shadow-lg shadow-red-500/20 ml-2"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
}

interface ControlButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon: React.ElementType;
}

function ControlButton({ active = true, icon: Icon, className, ...props }: ControlButtonProps) {
  return (
    <button
      className={clsx(
        "flex items-center justify-center w-11 h-11 rounded-full text-white/90 transition-all",
        "hover:scale-110 active:scale-95",
        className
      )}
      {...props}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
