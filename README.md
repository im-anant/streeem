<div align="center">
  <img src="https://github.com/user-attachments/assets/fce86783-f312-4270-8da1-03fb4907da14" alt="Streeem Logo" width="200"/>
  
  # 🎥 Streeem
  
  **Real-time WebRTC streaming with synchronized media playback**
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
  [![WebRTC](https://img.shields.io/badge/WebRTC-Enabled-green)](https://webrtc.org/)
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  
  [Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Documentation](#-documentation) • [Contributing](#-contributing)
  
</div>

---

## 📖 Overview

**Streeem** is a powerful starter template for building real-time collaborative streaming applications. It provides a complete **WebRTC + WebSocket signaling** architecture that enables synchronized media playback, video chat, and real-time communication between multiple participants.

Perfect for building:
- 🎬 Watch party applications
- 📹 Video conferencing platforms
- 🎮 Interactive streaming experiences
- 🎓 Live learning environments
- 🎵 Synchronized music listening parties

## ✨ Features

### Real-Time Communication
- 🔄 **WebRTC Peer-to-Peer** - Direct audio/video streaming between clients
- 📡 **WebSocket Signaling** - Low-latency event-based communication
- 🏠 **Room Management** - Create and join virtual rooms with presence tracking
- 💬 **Live Chat** - Real-time text messaging within rooms

### Media Synchronization
- ▶️ **Synchronized Playback** - Keep all participants in sync with play/pause/seek
- 🎯 **Drift Correction** - Automatic correction for timing differences
- 🕐 **Clock Synchronization** - Server-side timestamping for accurate sync
- 📊 **Playback State Management** - Authoritative host controls with state broadcast

### Developer Experience
- 📦 **Monorepo Structure** - Well-organized workspace with shared packages
- 🎨 **Modern UI Stack** - Next.js 15 + Tailwind CSS + Lucide icons
- 🔒 **Type-Safe Events** - Versioned WebSocket protocol with TypeScript types
- 📝 **Comprehensive Docs** - Detailed event schema and API documentation
- 🔌 **SFU-Ready** - Architecture designed to integrate with LiveKit/mediasoup

## 🏗️ Architecture

```
streeem/
├── apps/
│   ├── signaling/      # WebSocket signaling server (Node.js + ws)
│   ├── web/            # Vite demo app for WebRTC testing
│   └── web-next/       # Next.js production-ready UI with Tailwind
├── packages/
│   └── shared/         # Shared TypeScript types and event definitions
└── docs/
    └── websocket-events.md  # Canonical WebSocket protocol specification
```

### Tech Stack

- **Backend**: Node.js, WebSocket (ws)
- **Frontend**: React 18, Next.js 15, Vite
- **Styling**: Tailwind CSS 3
- **Real-time**: WebRTC, WebSockets
- **Language**: TypeScript 5
- **Media**: react-player

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 8+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/im-anant/streeem.git
   cd streeem
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build shared packages**
   ```bash
   npm run build:shared
   npm run build:signaling
   ```

### Running the Applications

#### Option 1: Next.js UI (Recommended)

Start the signaling server:
```bash
npm run dev:signaling
```

In a new terminal, start the Next.js app:
```bash
npm --workspace apps/web-next run dev
```

Open your browser:
- UI: [http://localhost:3000](http://localhost:3000)
- Join a room: [http://localhost:3000/room/demo](http://localhost:3000/room/demo)

#### Option 2: Vite Demo UI

Start the signaling server:
```bash
npm run dev:signaling
```

In a new terminal, start the Vite app:
```bash
npm --workspace apps/web run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Testing Multi-User Sync

1. Open the room URL in multiple browser windows
2. Start playing media in one window (the "host")
3. Watch as all other windows synchronize automatically
4. Try pausing, seeking, or changing content - all clients stay in sync!

## 🎯 Usage Examples

### Joining a Room

```typescript
import { WsEventV1 } from '@streamsync/shared';

// Connect to signaling server
const ws = new WebSocket('ws://localhost:8080');

// Join a room
const joinEvent: WsEventV1 = {
  v: 1,
  type: 'room/join',
  requestId: crypto.randomUUID(),
  payload: {
    roomId: 'my-room',
    client: {
      userId: 'user-123',
      displayName: 'John Doe'
    }
  }
};

ws.send(JSON.stringify(joinEvent));
```

### Broadcasting Playback State

```typescript
// Update playback state (host only)
const playbackEvent: WsEventV1 = {
  v: 1,
  type: 'watch/playback_state',
  payload: {
    roomId: 'my-room',
    state: {
      playing: true,
      positionSec: 42.5,
      hostTsMs: Date.now(),
      contentId: 'video-123'
    },
    authoritative: true
  }
};

ws.send(JSON.stringify(playbackEvent));
```

## 📚 Documentation

- **[WebSocket Event Schema](docs/websocket-events.md)** - Complete protocol specification
- **[Event Types](packages/shared/src/events.ts)** - TypeScript type definitions
- **[Signaling Server](apps/signaling/src/server.ts)** - Server implementation

### Key Concepts

#### Room Management
Rooms are virtual spaces where users can interact. Each room maintains:
- Connected users and their presence
- Current media content and playback state
- Chat history
- WebRTC connections between peers

#### Sync Algorithm
The synchronization algorithm uses server timestamps to coordinate playback:

```
positionNow ≈ positionSec + (nowMs - hostTsMs) / 1000
```

Clients apply drift correction:
- If drift > 250ms: seek to target position
- Otherwise: adjust playbackRate (0.98-1.02) to gradually converge

#### WebRTC Flow
1. Client creates offer with local media tracks
2. Offer sent via signaling server to target peer
3. Target creates answer and sends back
4. ICE candidates exchanged for NAT traversal
5. P2P connection established

## 🔧 Development

### Project Scripts

```bash
# Type checking
npm run typecheck

# Build shared packages
npm run build:shared

# Build signaling server
npm run build:signaling

# Start signaling server
npm run dev:signaling

# Development mode (Next.js)
npm --workspace apps/web-next run dev

# Build production (Next.js)
npm --workspace apps/web-next run build

# Lint (Next.js)
npm --workspace apps/web-next run lint
```

### Workspace Structure

This monorepo uses npm workspaces:
- `apps/*` - Application packages (signaling, web, web-next)
- `packages/*` - Shared libraries (types, utilities)

## 🛣️ Roadmap

- [x] WebRTC peer-to-peer connections
- [x] WebSocket signaling server
- [x] Room management and presence
- [x] Synchronized media playback
- [x] Real-time chat
- [x] Next.js UI with Tailwind
- [ ] SFU integration (LiveKit/mediasoup)
- [ ] Screen sharing
- [ ] Recording capabilities
- [ ] Mobile app support
- [ ] Authentication and authorization
- [ ] Persistent room state
- [ ] Analytics and monitoring

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [WebRTC](https://webrtc.org/)
- Powered by [Next.js](https://nextjs.org/)
- Icons by [Lucide](https://lucide.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

## 📞 Support

- 🐛 [Report a bug](https://github.com/im-anant/streeem/issues)
- 💡 [Request a feature](https://github.com/im-anant/streeem/issues)
- 📧 [Contact the maintainer](https://github.com/im-anant)

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/im-anant">@im-anant</a>
  <br/>
  <sub>Star ⭐ this repo if you find it useful!</sub>
</div>
