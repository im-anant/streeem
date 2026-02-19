import { WebSocketServer } from "ws";
import { createServer } from "http";
import { WS_PROTOCOL_VERSION, isClientEvent } from "@streamsync/shared";
const rooms = new Map();
// Helper to enable CORS
function setCorsHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
const port = Number(process.env.PORT ?? "8080");
const server = createServer((req, res) => {
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
        }
        else {
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
function send(ws, msg) {
    ws.send(JSON.stringify(msg));
}
function broadcast(roomId, msg, exceptUserId) {
    const room = rooms.get(roomId);
    if (!room)
        return;
    for (const [uid, conn] of room.connsByUserId) {
        if (exceptUserId && uid === exceptUserId)
            continue;
        send(conn.ws, msg);
    }
}
function errorMsg(requestId, code, message) {
    return {
        v: WS_PROTOCOL_VERSION,
        type: "error",
        payload: { requestId, code, message }
    };
}
function ackMsg(requestId) {
    return {
        v: WS_PROTOCOL_VERSION,
        type: "ack",
        payload: { requestId }
    };
}
wss.on("connection", (ws) => {
    const conn = { ws };
    send(ws, {
        v: WS_PROTOCOL_VERSION,
        type: "server/hello",
        payload: { v: WS_PROTOCOL_VERSION, nowMs: Date.now() }
    });
    ws.on("message", (raw) => {
        let parsed;
        try {
            parsed = JSON.parse(raw.toString());
        }
        catch {
            send(ws, errorMsg(undefined, "bad_request", "Invalid JSON"));
            return;
        }
        if (!isClientEvent(parsed)) {
            send(ws, errorMsg(undefined, "bad_request", "Invalid envelope"));
            return;
        }
        const msg = parsed;
        const { requestId } = msg;
        // Optional ack pattern
        if (requestId)
            send(ws, ackMsg(requestId));
        switch (msg.type) {
            case "room/join": {
                const { roomId, client } = msg.payload;
                // CRITICAL CHANGE: Only join if room exists
                const room = rooms.get(roomId);
                if (!room) {
                    send(ws, errorMsg(requestId, "room_not_found", "Room does not exist"));
                    return;
                }
                // If reconnecting / duplicate, close previous
                const existing = room.connsByUserId.get(client.userId);
                if (existing && existing.ws !== ws) {
                    try {
                        existing.ws.close(4000, "Replaced by new connection");
                    }
                    catch {
                        // ignore
                    }
                }
                conn.user = client;
                conn.roomId = roomId;
                room.connsByUserId.set(client.userId, conn);
                const peers = [];
                for (const [uid, c] of room.connsByUserId) {
                    if (uid === client.userId)
                        continue;
                    if (c.user)
                        peers.push(c.user);
                }
                send(ws, {
                    v: WS_PROTOCOL_VERSION,
                    type: "room/joined",
                    payload: { roomId, you: client, peers }
                });
                broadcast(roomId, {
                    v: WS_PROTOCOL_VERSION,
                    type: "room/peer_joined",
                    payload: { roomId, peer: client }
                }, client.userId);
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
                }
                else if (msg.type === "webrtc/answer") {
                    send(to.ws, {
                        v: WS_PROTOCOL_VERSION,
                        type: "webrtc/answer",
                        payload: { roomId, fromUserId: conn.user.userId, sdp: msg.payload.sdp }
                    });
                }
                else {
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
                // Update local state if we were tracking it on server (we aren't currently, but could)
                // For now just broadcast
                broadcast(roomId, {
                    v: WS_PROTOCOL_VERSION,
                    type: "user/updated",
                    payload: {
                        roomId,
                        userId: conn.user.userId,
                        state
                    }
                }, conn.user.userId // don't send back to sender? or maybe we should to confirm? usually no need.
                );
                break;
            }
            default: {
                send(ws, errorMsg(requestId, "bad_request", `Unknown type: ${msg.type}`));
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
function leaveRoom(conn, roomId) {
    const room = rooms.get(roomId);
    if (!room || !conn.user)
        return;
    room.connsByUserId.delete(conn.user.userId);
    broadcast(roomId, {
        v: WS_PROTOCOL_VERSION,
        type: "room/peer_left",
        payload: { roomId, userId: conn.user.userId }
    });
    // Clean up empty rooms
    if (room.connsByUserId.size === 0)
        rooms.delete(roomId);
    conn.roomId = undefined;
}
server.listen(port);
