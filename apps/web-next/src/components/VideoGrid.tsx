import { Participant } from "@/types";
import { VideoCard } from "@/components/VideoCard";
import { clsx } from "clsx";

interface VideoGridProps {
  participants: Participant[];
}

export function VideoGrid({ participants }: VideoGridProps) {
  const count = participants.length;

  return (
    <div className="h-full w-full p-4 flex items-center justify-center">
      <div
        className={clsx(
          "grid w-full gap-4 transition-all duration-300 ease-in-out",
          // Layout logic based on participant count
          count === 1 && "h-full grid-cols-1",
          count === 2 && "h-full grid-cols-1 md:grid-cols-2",
          // For 3-4 users, we want a 2x2 grid that takes up most space
          (count === 3 || count === 4) && "h-full grid-cols-2 grid-rows-2",
          // For 5-6 users, 3x2
          (count >= 5 && count <= 6) && "h-full grid-cols-3 grid-rows-2",
          // For 7-9 users, 3x3
          (count >= 7 && count <= 9) && "h-full grid-cols-3 grid-rows-3",
          // More than 9, just auto-fill
          count > 9 && "h-full grid-cols-4 grid-rows-3 sm:grid-cols-5"
        )}
      >
        {participants.map((p) => (
          <VideoCard
            key={p.id}
            participant={p}
            className="w-full h-full"
          />
        ))}
      </div>
    </div>
  );
}
