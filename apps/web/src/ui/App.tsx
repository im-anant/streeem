import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ClientInfo, RoomId, S2C, UserId } from "@streamsync/shared";
import { WS_PROTOCOL_VERSION } from "@streamsync/shared";
import { randomId } from "../lib/ids";
import { WsClient } from "../lib/wsClient";
import { WebRtcPeer } from "../lib/webrtcPeer";

export function App() {
  const [roomId, setRoomId] = useState("demo");
  const [displayName, setDisplayName] = useState("Guest");
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [you, setYou] = useState<ClientInfo | null>(null);
  const [peers, setPeers] = useState<ClientInfo[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<UserId | "">("");
  const [pcState, setPcState] = useState<string>("");
  const [localOn, setLocalOn] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WsClient | null>(null);
  const peerConnRef = useRef<WebRtcPeer | null>(null);
  const userIdRef = useRef<string>(randomId("u"));

  const wsUrl = useMemo(() => {
    const env = (import.meta as any).env as { VITE_SIGNALING_URL?: string };
    return env?.VITE_SIGNALING_URL ?? "ws://localhost:8080";
  }, []);

  useEffect(() => {
    const ws = new WsClient(wsUrl);
    wsRef.current = ws;
    ws.connect(
      async (msg: S2C) => {
        switch (msg.type) {
          case "server/hello":
            return;
          case "room/joined": {
            setJoined(true);
            setYou(msg.payload.you);
            setPeers(msg.payload.peers);
            if (msg.payload.peers.length === 1) setSelectedPeerId(msg.payload.peers[0]!.userId);
            return;
          }
          case "room/peer_joined": {
            setPeers((prev) => upsertPeer(prev, msg.payload.peer));
            return;
          }
          case "room/peer_left": {
            setPeers((prev) => removePeer(prev, msg.payload.userId));
            setSelectedPeerId((cur) => (cur === msg.payload.userId ? "" : cur));
            return;
          }
          case "webrtc/offer": {
            // Incoming call: create peer connection back to caller
            closePeer();
            const peer = new WebRtcPeer(ws, msg.payload.roomId, msg.payload.fromUserId, {
              onRemoteTrack: (stream) => {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
              },
              onConnectionState: (state) => setPcState(state)
            });
            peerConnRef.current = peer;
            if (!localStreamRef.current) await startLocal();
            if (localStreamRef.current) peer.addLocalStream(localStreamRef.current);
            await peer.handleOfferAndSendAnswer(msg.payload.sdp);
            return;
          }
          case "webrtc/answer": {
            await peerConnRef.current?.handleAnswer(msg.payload.sdp);
            return;
          }
          case "webrtc/ice": {
            await peerConnRef.current?.addIceCandidate(msg.payload.candidate);
            return;
          }
          default:
            return;
        }
      },
      {
        onOpen: () => setConnected(true),
        onClose: () => {
          setConnected(false);
          setJoined(false);
          setPeers([]);
          setYou(null);
          closePeer();
        }
      }
    );

    return () => {
      ws.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  function sendJoin(rid: RoomId) {
    const ws = wsRef.current;
    if (!ws) return;
    const client: ClientInfo = { userId: userIdRef.current, displayName: displayName || "Guest" };
    ws.send({
      v: WS_PROTOCOL_VERSION,
      type: "room/join",
      payload: { roomId: rid, client }
    });
  }

  async function startLocal() {
    if (localStreamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    setLocalOn(true);
  }

  function stopLocal() {
    const s = localStreamRef.current;
    if (!s) return;
    for (const t of s.getTracks()) t.stop();
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setLocalOn(false);
  }

  function closePeer() {
    peerConnRef.current?.close();
    peerConnRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setPcState("");
  }

  async function callSelectedPeer() {
    if (!joined || !you) return;
    if (!selectedPeerId) return;
    const ws = wsRef.current;
    if (!ws) return;

    closePeer();

    const p = new WebRtcPeer(ws, roomId, selectedPeerId, {
      onRemoteTrack: (stream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
      },
      onConnectionState: (state) => setPcState(state)
    });
    peerConnRef.current = p;

    if (!localStreamRef.current) await startLocal();
    if (localStreamRef.current) p.addLocalStream(localStreamRef.current);

    await p.createAndSendOffer();
  }

  return (
    <div className="page">
      <header className="header">
        <div className="brand">StreamSync</div>
        <div className="muted">WebRTC + WS signaling starter</div>
      </header>

      <main className="card">
        <div className="grid">
          <label className="field">
            <div className="label">Room ID</div>
            <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="demo" />
          </label>
          <label className="field">
            <div className="label">Display name</div>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Guest" />
          </label>
        </div>

        <div className="row">
          <div className="pill">Signaling: {wsUrl}</div>
          <div className="pill">Room: {roomId}</div>
          <div className="pill">Name: {displayName}</div>
          <div className="pill">WS: {connected ? "connected" : "disconnected"}</div>
          <div className="pill">RTC: {pcState || "-"}</div>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => sendJoin(roomId)} disabled={!connected}>
            Join room
          </button>
          <button className="btn" onClick={startLocal} disabled={!connected || localOn}>
            Start camera
          </button>
          <button className="btn" onClick={stopLocal} disabled={!localOn}>
            Stop camera
          </button>
          <button className="btn" onClick={callSelectedPeer} disabled={!joined || !selectedPeerId}>
            Call selected peer
          </button>
          <button className="btn" onClick={closePeer}>
            Hang up
          </button>
        </div>

        <div className="grid" style={{ marginTop: 14 }}>
          <div className="cardInner">
            <div className="label">You</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {you ? `${you.displayName} (${you.userId})` : "—"}
            </div>

            <div className="label" style={{ marginTop: 14 }}>
              Peers
            </div>
            <select
              className="select"
              value={selectedPeerId}
              onChange={(e) => setSelectedPeerId(e.target.value as UserId)}
              disabled={!joined || peers.length === 0}
            >
              <option value="">Select a peer…</option>
              {peers.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.displayName} ({p.userId})
                </option>
              ))}
            </select>
            <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
              Tip: open this page in two tabs, join the same room, pick the other tab’s user, then call.
            </div>
          </div>

          <div className="cardInner">
            <div className="label">Local</div>
            <video ref={localVideoRef} className="video" autoPlay playsInline muted />
            <div className="label" style={{ marginTop: 12 }}>
              Remote
            </div>
            <video ref={remoteVideoRef} className="video" autoPlay playsInline />
          </div>
        </div>
      </main>
    </div>
  );
}

function upsertPeer(list: ClientInfo[], peer: ClientInfo) {
  const i = list.findIndex((p) => p.userId === peer.userId);
  if (i === -1) return [...list, peer];
  const copy = list.slice();
  copy[i] = peer;
  return copy;
}

function removePeer(list: ClientInfo[], userId: string) {
  return list.filter((p) => p.userId !== userId);
}


