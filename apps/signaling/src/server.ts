import { WebSocketServer } from "ws";
import { createServer, IncomingMessage, ServerResponse } from "http";
import {
  WS_PROTOCOL_VERSION,
  type C2S,
  type ClientInfo,
  type RoomId,
  type S2C,
  type UserId,
  isClientEvent
} from "@streamsync/shared";

type Conn = {
  ws: import("ws").WebSocket;
  user?: ClientInfo;
  roomId?: RoomId;
};

type Room = {
  connsByUserId: Map<UserId, Conn>;
};

const rooms = new Map<RoomId, Room>();

// Helper to enable CORS
function setCorsHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const port = Number(process.env.PORT ?? "8080");
const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /create-room
  if (req.method === "POST" && req.url === "/create-room") {
    const roomId = Math.random().toString(36).substring(2, 8);
    // Create the room immediately
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { connsByUserId: new Map() });
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ roomId }));
    return;
  }

  // GET /room/:roomId -> Check if exists
  // Simple regex to match /room/xyz
  const match = req.url?.match(/^\/room\/([a-zA-Z0-9-]+)$/);
  if (req.method === "GET" && match) {
    const roomId = match[1];
    if (rooms.has(roomId)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ exists: true }));
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Room not found" }));
    }
    return;
  }

  // 404 for anything else
  if (req.url !== "/") { // Allow root for health check if needed, or just 404
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  res.writeHead(200);
  res.end("Signaling Server Running");
});

const wss = new WebSocketServer({ server });

console.log(`[signaling] listening on http://localhost:${port}`);

function send(ws: import("ws").WebSocket, msg: S2C) {
  ws.send(JSON.stringify(msg));
}

function broadcast(roomId: RoomId, msg: S2C, exceptUserId?: UserId) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const [uid, conn] of room.connsByUserId) {
    if (exceptUserId && uid === exceptUserId) continue;
    send(conn.ws, msg);
  }
}

type ErrorCode = Extract<S2C, { type: "error" }>["payload"]["code"];

function errorMsg(requestId: string | undefined, code: ErrorCode, message: string): S2C {
  return {
    v: WS_PROTOCOL_VERSION,
    type: "error",
    payload: { requestId, code, message }
  } as S2C;
}

function ackMsg(requestId: string): S2C {
  return {
    v: WS_PROTOCOL_VERSION,
    type: "ack",
    payload: { requestId }
  };
}

wss.on("connection", (ws) => {
  const conn: Conn = { ws };

  send(ws, {
    v: WS_PROTOCOL_VERSION,
    type: "server/hello",
    payload: { v: WS_PROTOCOL_VERSION, nowMs: Date.now() }
  });

  ws.on("message", (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      send(ws, errorMsg(undefined, "bad_request", "Invalid JSON"));
      return;
    }

    if (!isClientEvent(parsed)) {
      send(ws, errorMsg(undefined, "bad_request", "Invalid envelope"));
      return;
    }

    const msg = parsed as C2S;
    const { requestId } = msg;

    // Optional ack pattern
    if (requestId) send(ws, ackMsg(requestId));

    switch (msg.type) {
      case "room/join": {
        const { roomId, client } = msg.payload;

        // Auto-create room if it doesn't exist (handles race where room was
        // cleaned up between link share and second user joining)
        let room = rooms.get(roomId);
        if (!room) {
          room = { connsByUserId: new Map() };
          rooms.set(roomId, room);
          console.log(`[signaling] Auto-created room ${roomId} on join`);
        }
        // Cancel any pending cleanup timer
        if ((room as any)._cleanupTimer) {
          clearTimeout((room as any)._cleanupTimer);
          delete (room as any)._cleanupTimer;
        }

        // If reconnecting / duplicate, close previous
        const existing = room.connsByUserId.get(client.userId);
        if (existing && existing.ws !== ws) {
          try {
            existing.ws.close(4000, "Replaced by new connection");
          } catch {
            // ignore
          }
        }

        conn.user = client;
        conn.roomId = roomId;
        room.connsByUserId.set(client.userId, conn);

        const peers: ClientInfo[] = [];
        for (const [uid, c] of room.connsByUserId) {
          if (uid === client.userId) continue;
          if (c.user) peers.push(c.user);
        }

        send(ws, {
          v: WS_PROTOCOL_VERSION,
          type: "room/joined",
          payload: { roomId, you: client, peers }
        });

        broadcast(
          roomId,
          {
            v: WS_PROTOCOL_VERSION,
            type: "room/peer_joined",
            payload: { roomId, peer: client }
          },
          client.userId
        );
        break;
      }

      case "room/leave": {
        const { roomId } = msg.payload;
        if (!conn.user) {
          send(ws, errorMsg(requestId, "unauthorized", "Not joined"));
          return;
        }
        leaveRoom(conn, roomId);
        break;
      }

      case "chat/send": {
        if (!conn.user || !conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Join a room first"));
          return;
        }
        const { roomId, text } = msg.payload;
        if (roomId !== conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Not in that room"));
          return;
        }
        broadcast(roomId, {
          v: WS_PROTOCOL_VERSION,
          type: "chat/message",
          payload: { roomId, from: conn.user, text, tsMs: Date.now() }
        });
        break;
      }

      case "watch/set_content": {
        if (!conn.user || !conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Join a room first"));
          return;
        }
        const { roomId, contentId, meta } = msg.payload;
        if (roomId !== conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Not in that room"));
          return;
        }
        broadcast(roomId, {
          v: WS_PROTOCOL_VERSION,
          type: "watch/content",
          payload: { roomId, contentId, meta }
        });
        break;
      }

      case "watch/playback_state": {
        if (!conn.user || !conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Join a room first"));
          return;
        }
        const { roomId, state } = msg.payload;
        if (roomId !== conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Not in that room"));
          return;
        }
        broadcast(roomId, {
          v: WS_PROTOCOL_VERSION,
          type: "watch/playback_state",
          payload: {
            roomId,
            state,
            serverTsMs: Date.now(),
            fromUserId: conn.user.userId
          }
        });
        break;
      }

      case "webrtc/offer":
      case "webrtc/answer":
      case "webrtc/ice": {
        if (!conn.user || !conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Join a room first"));
          return;
        }
        const { roomId, toUserId } = msg.payload;
        if (roomId !== conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Not in that room"));
          return;
        }
        const room = rooms.get(roomId);
        const to = room?.connsByUserId.get(toUserId);
        if (!to) {
          send(ws, errorMsg(requestId, "peer_not_found", `Peer not found: ${toUserId}`));
          return;
        }

        // Forward with fromUserId
        if (msg.type === "webrtc/offer") {
          send(to.ws, {
            v: WS_PROTOCOL_VERSION,
            type: "webrtc/offer",
            payload: { roomId, fromUserId: conn.user.userId, sdp: msg.payload.sdp }
          });
        } else if (msg.type === "webrtc/answer") {
          send(to.ws, {
            v: WS_PROTOCOL_VERSION,
            type: "webrtc/answer",
            payload: { roomId, fromUserId: conn.user.userId, sdp: msg.payload.sdp }
          });
        } else {
          send(to.ws, {
            v: WS_PROTOCOL_VERSION,
            type: "webrtc/ice",
            payload: { roomId, fromUserId: conn.user.userId, candidate: msg.payload.candidate }
          });
        }
        break;
      }

      case "user/update": {
        if (!conn.user || !conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Join a room first"));
          return;
        }
        const { roomId, state } = msg.payload;
        if (roomId !== conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Not in that room"));
          return;
        }

        broadcast(
          roomId,
          {
            v: WS_PROTOCOL_VERSION,
            type: "user/updated",
            payload: {
              roomId,
              userId: conn.user.userId,
              state
            }
          },
          conn.user.userId
        );
        break;
      }

      case "reaction/send": {
        if (!conn.user || !conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Join a room first"));
          return;
        }
        const { roomId, reaction, source } = msg.payload;
        if (roomId !== conn.roomId) {
          send(ws, errorMsg(requestId, "not_in_room", "Not in that room"));
          return;
        }
        // Broadcast to ALL participants (including sender so they see their own animation)
        broadcast(roomId, {
          v: WS_PROTOCOL_VERSION,
          type: "reaction/received",
          payload: {
            roomId,
            userId: conn.user.userId,
            displayName: conn.user.displayName,
            reaction,
            source,
            tsMs: Date.now()
          }
        });
        break;
      }

      default: {
        send(ws, errorMsg(requestId, "bad_request", `Unknown type: ${(msg as any).type}`));
        return;
      }
    }
  });

  ws.on("close", () => {
    if (conn.user && conn.roomId) {
      leaveRoom(conn, conn.roomId);
    }
  });
});

function leaveRoom(conn: Conn, roomId: RoomId) {
  const room = rooms.get(roomId);
  if (!room || !conn.user) return;

  room.connsByUserId.delete(conn.user.userId);
  broadcast(roomId, {
    v: WS_PROTOCOL_VERSION,
    type: "room/peer_left",
    payload: { roomId, userId: conn.user.userId }
  });

  // Delay-clean empty rooms — 5 minute grace period so second user can still join
  if (room.connsByUserId.size === 0) {
    const ROOM_TTL_MS = 5 * 60 * 1000; // 5 minutes
    (room as any)._cleanupTimer = setTimeout(() => {
      // Only delete if still empty
      const r = rooms.get(roomId);
      if (r && r.connsByUserId.size === 0) {
        rooms.delete(roomId);
        console.log(`[signaling] Cleaned up empty room ${roomId} after TTL`);
      }
    }, ROOM_TTL_MS);
  }

  conn.roomId = undefined;
}

server.listen(port);


