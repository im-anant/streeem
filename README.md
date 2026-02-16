# StreamSync (Starter)

This repo is a minimal starting point for a **WebRTC + WebSocket signaling** architecture that can later plug into an **SFU** (LiveKit/mediasoup).

## What’s included (today)

- **Versioned WebSocket event schema** for:
  - room join/leave/presence
  - chat
  - media sync (play/pause/seek + drift correction)
  - basic WebRTC signaling (offer/answer/ice)
- A minimal **signaling server** using `ws`
- A minimal **React client** page that:
  - connects to the signaling server over WebSocket
  - captures camera/mic using WebRTC APIs
  - creates a PeerConnection and exchanges SDP/ICE via signaling

## Layout

- `docs/websocket-events.md` — canonical event schema
- `packages/shared/src/events.ts` — TypeScript types for events (client/server)
- `apps/signaling/src/server.ts` — WS signaling server (rooms + broadcast)
- `apps/web/src/webrtc-demo.tsx` — WebRTC camera demo (React)

## Run (after installing deps)

This repo includes:
- `apps/signaling` (WebSocket signaling server)
- `apps/web` (Vite demo: real WebRTC P2P calling)
- `apps/web-next` (Next.js + Tailwind premium UI scaffold)

```bash
cd /Users/srivastava/Streeem
npm install
npm run dev:signaling
```

### Start the Next.js UI

```bash
npm --workspace apps/web-next run dev
```

Open `http://localhost:3000` → `http://localhost:3000/room/demo`

### Start the Vite demo UI

```bash
npm --workspace apps/web run dev
```

Open `http://localhost:5173`


