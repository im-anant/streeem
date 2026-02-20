import { Participant } from "@/types";
import { VideoCard } from "@/components/VideoCard";
import { clsx } from "clsx";
import { TileReactionCanvasHandle } from "./TileReactionCanvas";

interface VideoGridProps {
  participants: Participant[];
  canvasRefs?: Map<string, React.RefObject<TileReactionCanvasHandle | null>>;
}

export function VideoGrid({ participants, canvasRefs }: VideoGridProps) {
  return (
    <div className="h-full w-full p-2 md:p-4 flex items-center justify-center overflow-y-auto">
      <div
        className="grid w-full h-full gap-2 md:gap-4 auto-rows-fr"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
        }}
      >
        {participants.map((p) => (
          <VideoCard
            key={p.id}
            participant={p}
            className="w-full h-full min-h-[140px] md:min-h-[200px]"
            canvasRef={canvasRefs?.get(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
