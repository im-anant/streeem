import type { Metadata } from "next";
import { RoomProvider } from "@/contexts/RoomContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Streeem",
  description: "Real-time rooms (WebRTC + SFU-ready) with watch-party sync."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RoomProvider>
          {children}
        </RoomProvider>
      </body>
    </html>
  );
}
