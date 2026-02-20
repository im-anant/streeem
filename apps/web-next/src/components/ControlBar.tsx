import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MessageSquare,
  PhoneOff,
  Play,
  Camera,
  Users,
  Smile
} from "lucide-react";
import { clsx } from "clsx";

import { useRoom } from "@/contexts/RoomContext";

export function ControlBar({
  onStartStream,
  onToggleChat,
  onToggleSidebar,
  onToggleReactions,
  sidebarOpen,
  chatOpen,
  reactionsOpen,
}: {
  onStartStream: () => void;
  onToggleChat: () => void;
  onToggleSidebar: () => void;
  onToggleReactions: () => void;
  sidebarOpen: boolean;
  chatOpen: boolean;
  reactionsOpen: boolean;
}) {
  const { localUser, toggleMute, toggleVideo, toggleScreenShare, isScreenSharing, leaveRoom, switchCamera } = useRoom();

  // Guard: if no user, render nothing or disabled
  if (!localUser) return null;

  const isMuted = !localUser.hasAudio;
  const isVideoOff = !localUser.hasVideo;
  return (
    <div className="flex items-center justify-center gap-2 md:gap-3 px-3 md:px-6 py-2 md:py-3 rounded-2xl md:rounded-full bg-neutral-900/80 backdrop-blur-xl border border-white/10 shadow-2xl transition-all hover:scale-[1.01] overflow-x-auto max-w-[calc(100vw-2rem)] scrollbar-hide">
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
      <ControlButton
        onClick={switchCamera}
        icon={Camera}
        title="Switch Camera"
        className="bg-neutral-800 hover:bg-neutral-700"
      />

      <div className="w-px h-8 bg-white/10 mx-1 hidden md:block" />

      <ControlButton
        onClick={toggleScreenShare}
        icon={MonitorUp}
        active={isScreenSharing}
        title="Share Screen"
        className={clsx(
          "bg-neutral-800 hover:bg-neutral-700",
          isScreenSharing && "text-indigo-400"
        )}
      />
      <ControlButton
        onClick={onStartStream}
        icon={Play}
        title="Start Stream URL"
        className="bg-neutral-800 hover:bg-neutral-700 hover:text-pink-400"
      />

      <div className="w-px h-8 bg-white/10 mx-1 hidden md:block" />

      {/* Participants Button (Sidebar) */}
      <ControlButton
        onClick={onToggleSidebar}
        icon={Users} // Change icon to Users
        title="Participants"
        className={clsx(
          "bg-neutral-800 hover:bg-neutral-700",
          sidebarOpen && "bg-indigo-500/20 text-indigo-300"
        )}
      />

      {/* Chat Button (Floating Widget) */}
      <ControlButton
        onClick={onToggleChat}
        icon={MessageSquare}
        title="Chat"
        className={clsx(
          "bg-neutral-800 hover:bg-neutral-700",
          chatOpen && "bg-indigo-500/20 text-indigo-300"
        )}
      />

      {/* Reactions Button */}
      <ControlButton
        onClick={onToggleReactions}
        icon={Smile}
        title="Reactions"
        className={clsx(
          "bg-neutral-800 hover:bg-neutral-700",
          reactionsOpen && "bg-yellow-500/20 text-yellow-300"
        )}
      />

      <button
        onClick={() => {
          leaveRoom();
          window.location.href = "/";
        }}
        className="flex items-center justify-center w-11 h-11 md:w-12 md:h-12 min-w-[44px] min-h-[44px] rounded-full bg-red-500/90 text-white hover:bg-red-600 hover:scale-110 transition-all shadow-lg shadow-red-500/20 ml-1 md:ml-2 shrink-0"
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
        "flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-full text-white/90 transition-all shrink-0",
        "hover:scale-110 active:scale-95",
        className
      )}
      {...props}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
