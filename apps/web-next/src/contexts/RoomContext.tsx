"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { Participant } from "@/types";
import { WS_PROTOCOL_VERSION, ClientInfo, C2S, S2C, PlaybackState } from "@streamsync/shared";

interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    timestamp: string;
    isSystem: boolean;
}

export interface IncomingReaction {
    id: string;
    userId: string;
    displayName: string;
    reaction: string;
    source: "gesture" | "ui";
    tsMs: number;
}

interface RoomContextType {
    participants: Participant[];
    localUser: Participant | null;
    activeStreamUrl: string;
    isScreenSharing: boolean;
    screenStream: MediaStream | null;
    localStream: MediaStream | null;
    playbackState: "playing" | "paused";
    currentTime: number;
    messages: ChatMessage[];
    joinRoom: (name: string, roomId: string) => void;
    leaveRoom: () => void;
    setStreamUrl: (url: string) => void;
    toggleScreenShare: () => Promise<void>;
    toggleMute: () => void;
    toggleVideo: () => void;
    switchCamera: () => Promise<void>;
    setPlayback: (state: "playing" | "paused", time: number) => void;
    sendMessage: (text: string) => void;
    sendReaction: (reaction: string) => void;
    incomingReactions: IncomingReaction[];
    mediaError: string | null;
    roomError: string | null;
}

const RoomContext = createContext<RoomContextType | null>(null);

export function useRoom() {
    const context = useContext(RoomContext);
    if (!context) {
        throw new Error("useRoom must be used within a RoomProvider");
    }
    return context;
}

interface RoomProviderProps {
    children: React.ReactNode;
}

/**
 * Returns a baseline set of ICE servers that is always available.
 * Dynamic / env-configured TURN credentials are merged in createPeerConnection().
 */
const getBaseIceServers = (): RTCIceServer[] => {
    const servers: RTCIceServer[] = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ];

    // --- Built-in free TURN fallback (Open Relay Project – staticauth) ---
    // Covers UDP, TCP, and TLS on ports 80 & 443 to bypass corporate firewalls.
    servers.push({
        urls: [
            "turn:a.relay.metered.ca:80",
            "turn:a.relay.metered.ca:80?transport=tcp",
            "turn:a.relay.metered.ca:443",
            "turn:a.relay.metered.ca:443?transport=tcp",
            "turns:a.relay.metered.ca:443",
        ],
        username: "e8dd65b92a0cfa69a58e82ff",
        credential: "RHJnClurMC/FqFnl",
    });

    // --- Optional: env-configured TURN (takes priority when configured) ---
    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
    if (turnUrl && (turnUrl.startsWith("turn:") || turnUrl.startsWith("turns:"))) {
        const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
        const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
        if (username && credential) {
            servers.push({ urls: turnUrl, username, credential });
            console.log(`[WebRTC] Env TURN configured: ${turnUrl}`);
        }
    }

    return servers;
};

export function RoomProvider({ children }: RoomProviderProps) {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [localUser, setLocalUser] = useState<Participant | null>(null);
    const [activeStreamUrl, setActiveStreamUrl] = useState("");
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [playbackState, setPlaybackState] = useState<"playing" | "paused">("paused");
    const [currentTime, setCurrentTime] = useState(0);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [mediaError, setMediaError] = useState<string | null>(null);
    const [roomError, setRoomError] = useState<string | null>(null);

    // WebSocket and WebRTC Refs
    const wsRef = useRef<WebSocket | null>(null);
    const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const currentRoomId = useRef<string | null>(null);
    const localUserRef = useRef<Participant | null>(null); // To access current state in event handlers
    const localStreamRef = useRef<MediaStream | null>(null);

    // Keep localUserRef in sync
    useEffect(() => {
        localUserRef.current = localUser;
    }, [localUser]);

    // Keep localStreamRef in sync
    useEffect(() => {
        localStreamRef.current = localStream;
    }, [localStream]);

    // WebSocket Message Handling
    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";
        console.log(`[Signaling] Connecting to ${wsUrl}`);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("Connected to signaling server");
        };

        ws.onmessage = async (event) => {
            const msg = JSON.parse(event.data) as S2C;

            switch (msg.type) {
                case "server/hello":
                    console.log("Server hello, nowMs:", msg.payload.nowMs);
                    break;
                case "error":
                    console.error("Server error:", msg.payload);
                    if (msg.payload.code === "room_not_found") {
                        setRoomError("Room does not exist");
                    }
                    break;
                case "room/joined":
                    handleRoomJoined(msg.payload);
                    break;
                case "room/peer_joined":
                    handlePeerJoined(msg.payload);
                    break;
                case "room/peer_left":
                    handlePeerLeft(msg.payload);
                    break;
                case "webrtc/offer":
                    handleWebrtcOffer(msg.payload);
                    break;
                case "webrtc/answer":
                    handleWebrtcAnswer(msg.payload);
                    break;
                case "webrtc/ice":
                    handleWebrtcIce(msg.payload);
                    break;
                case "user/updated":
                    handleUserUpdated(msg.payload);
                    break;
                case "chat/message":
                    handleChatMessage(msg.payload);
                    break;
                case "watch/content":
                    setActiveStreamUrl(msg.payload.contentId);
                    break;
                case "watch/playback_state":
                    setPlaybackState(msg.payload.state.playing ? "playing" : "paused");
                    setCurrentTime(msg.payload.state.positionSec);
                    break;
                case "reaction/received": {
                    const r = msg.payload as any;
                    const incoming: IncomingReaction = {
                        id: `${r.userId}-${r.tsMs}-${Math.random()}`,
                        userId: r.userId,
                        displayName: r.displayName,
                        reaction: r.reaction,
                        source: r.source,
                        tsMs: r.tsMs,
                    };
                    setIncomingReactions(prev => [...prev, incoming]);
                    // Auto-remove after 4 seconds
                    setTimeout(() => {
                        setIncomingReactions(prev => prev.filter(x => x.id !== incoming.id));
                    }, 4000);
                    break;
                }
            }
        };

        return () => {
            ws.close();
            // Cleanup PCs
            pcsRef.current.forEach((pc: RTCPeerConnection) => pc.close());
            pcsRef.current.clear();
        };
    }, []);

    const sendWs = useCallback((msg: C2S) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, []);

    /**
     * Flush any ICE candidates that arrived before remoteDescription was set.
     * MUST be called after every successful setRemoteDescription().
     */
    const flushPendingCandidates = async (targetUserId: string, pc: RTCPeerConnection) => {
        const pending = pendingCandidates.current.get(targetUserId);
        if (!pending || pending.length === 0) return;
        console.log(`[WebRTC] Flushing ${pending.length} pending ICE candidates for ${targetUserId}`);
        for (const candidate of pending) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error("[WebRTC] Error adding buffered ICE candidate", e);
            }
        }
        pendingCandidates.current.delete(targetUserId);
    };

    const createPeerConnection = async (targetUserId: string) => {
        console.log(`[WebRTC] Creating PC for ${targetUserId}`);

        // Start with baseline servers (STUN + Open Relay TURN fallback)
        const iceServers = [...getBaseIceServers()];

        // Try fetching dynamic / env-configured TURN from our API
        try {
            const res = await fetch('/api/turn-credentials');
            if (res.ok) {
                const data = await res.json();
                if (data.username && data.credential && data.urls) {
                    iceServers.push({
                        urls: data.urls,
                        username: data.username,
                        credential: data.credential,
                    });
                }
            }
        } catch (e) {
            console.warn("[WebRTC] Failed to fetch dynamic TURN credentials, using fallback", e);
        }

        const turnCount = iceServers.filter(s =>
            (Array.isArray(s.urls) ? s.urls : [s.urls]).some(u => u.startsWith("turn:") || u.startsWith("turns:"))
        ).length;
        console.log(`[WebRTC] ICE servers configured: ${iceServers.length} entries (${turnCount} TURN)`);

        const pc = new RTCPeerConnection({ iceServers });

        // --- Diagnostic logging ---
        pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE state (${targetUserId}): ${pc.iceConnectionState}`);
            if (pc.iceConnectionState === "failed") {
                console.error(`[WebRTC] ICE FAILED for ${targetUserId}. Restarting ICE...`);
                pc.restartIce();
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state (${targetUserId}): ${pc.connectionState}`);
        };

        pc.onicegatheringstatechange = () => {
            console.log(`[WebRTC] ICE gathering state (${targetUserId}): ${pc.iceGatheringState}`);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // Log candidate type for debugging (host/srflx/relay)
                console.log(`[WebRTC] Local ICE candidate (${targetUserId}): ${event.candidate.type ?? "unknown"} ${event.candidate.protocol ?? ""} ${event.candidate.address ?? ""}:${event.candidate.port ?? ""}`);
                if (currentRoomId.current) {
                    sendWs({
                        v: WS_PROTOCOL_VERSION,
                        type: "webrtc/ice",
                        payload: {
                            roomId: currentRoomId.current,
                            toUserId: targetUserId,
                            candidate: event.candidate.toJSON(),
                        },
                    });
                }
            } else {
                console.log(`[WebRTC] ICE gathering complete for ${targetUserId}`);
            }
        };

        pc.ontrack = (event) => {
            console.log(`[WebRTC] Received remote track from ${targetUserId} (${event.track.kind})`);
            const stream = event.streams[0];
            setParticipants((prev: Participant[]) => prev.map((p: Participant) => {
                if (p.id === targetUserId) {
                    return { ...p, stream };
                }
                return p;
            }));
        };

        // Add local tracks BEFORE creating offer/answer
        if (localStreamRef.current) {
            console.log(`[WebRTC] Adding ${localStreamRef.current.getTracks().length} local tracks to PC for ${targetUserId}`);
            localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
                pc.addTrack(track, localStreamRef.current!);
            });
        } else {
            console.warn(`[WebRTC] No local stream when creating PC for ${targetUserId}`);
        }

        pcsRef.current.set(targetUserId, pc);

        // NOTE: Do NOT flush pending candidates here.
        // They must wait until after setRemoteDescription() is called.

        return pc;
    };

    const handleRoomJoined = (payload: { roomId: string; you: ClientInfo; peers: ClientInfo[] }) => {
        const you: Participant = {
            id: payload.you.userId,
            name: payload.you.displayName,
            isLocal: true,
            hasAudio: true,
            hasVideo: true,
            isSpeaking: false,
            isScreenSharing: false,
        };
        setLocalUser(you);

        const others: Participant[] = payload.peers.map(p => ({
            id: p.userId,
            name: p.displayName,
            isLocal: false,
            hasAudio: true,
            hasVideo: true,
            isSpeaking: false,
            isScreenSharing: false,
        }));

        setParticipants([you, ...others]);
        // NOTE: We do NOT send offers here — existing peers will send us offers
        // via handlePeerJoined. We just need to be ready to receive them
        // (ICE buffering ensures candidates aren't dropped during async PC creation).
    };

    const handlePeerJoined = async (payload: { roomId: string; peer: ClientInfo }) => {
        const peer: Participant = {
            id: payload.peer.userId,
            name: payload.peer.displayName,
            isLocal: false,
            hasAudio: true,
            hasVideo: true,
            isSpeaking: false,
            isScreenSharing: false,
        };

        setParticipants((prev: Participant[]) => [...prev, peer]);

        // We initiate the connection to the new peer
        // We initiate the connection to the new peer
        const pc = await createPeerConnection(peer.id);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendWs({
            v: WS_PROTOCOL_VERSION,
            type: "webrtc/offer",
            payload: {
                roomId: payload.roomId,
                toUserId: peer.id,
                sdp: offer,
            },
        });
    };

    const handlePeerLeft = (payload: { roomId: string; userId: string }) => {
        setParticipants((prev: Participant[]) => prev.filter((p: Participant) => p.id !== payload.userId));
        const pc = pcsRef.current.get(payload.userId);
        if (pc) {
            pc.close();
            pcsRef.current.delete(payload.userId);
        }
        pendingCandidates.current.delete(payload.userId);
    };

    const handleWebrtcOffer = async (payload: { roomId: string; fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
        let pc = pcsRef.current.get(payload.fromUserId);
        if (!pc) {
            pc = await createPeerConnection(payload.fromUserId);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        // Flush any ICE candidates that arrived before we had remoteDescription
        await flushPendingCandidates(payload.fromUserId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendWs({
            v: WS_PROTOCOL_VERSION,
            type: "webrtc/answer",
            payload: {
                roomId: payload.roomId,
                toUserId: payload.fromUserId,
                sdp: answer,
            },
        });
    };

    const handleWebrtcAnswer = async (payload: { roomId: string; fromUserId: string; sdp: RTCSessionDescriptionInit }) => {
        const pc = pcsRef.current.get(payload.fromUserId);
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            // Flush any ICE candidates that arrived before we had remoteDescription
            await flushPendingCandidates(payload.fromUserId, pc);
        }
    };

    const handleWebrtcIce = async (payload: { roomId: string; fromUserId: string; candidate: RTCIceCandidateInit }) => {
        const pc = pcsRef.current.get(payload.fromUserId);
        if (pc && pc.remoteDescription) {
            // PC exists and remoteDescription is set — safe to add immediately
            try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
                console.error("[WebRTC] Error adding ICE candidate", e);
            }
        } else {
            // Buffer: either no PC yet, OR PC exists but remoteDescription not set yet
            if (pc && !pc.remoteDescription) {
                console.warn(`[WebRTC] Buffering ICE for ${payload.fromUserId} (remoteDescription not set yet)`);
            } else {
                console.warn(`[WebRTC] Buffering ICE for ${payload.fromUserId} (no PC yet)`);
            }
            const pending = pendingCandidates.current.get(payload.fromUserId) || [];
            pending.push(payload.candidate);
            pendingCandidates.current.set(payload.fromUserId, pending);
        }
    };

    const handleUserUpdated = (payload: { roomId: string; userId: string; state: Partial<Participant> }) => {
        setParticipants(prev => prev.map(p => {
            if (p.id === payload.userId) {
                return { ...p, ...payload.state };
            }
            return p;
        }));
    };

    const handleChatMessage = (payload: { from: ClientInfo; text: string; tsMs: number }) => {
        setMessages((prev: ChatMessage[]) => [...prev, {
            id: `msg_${payload.tsMs}`,
            sender: payload.from.displayName,
            text: payload.text,
            timestamp: new Date(payload.tsMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isSystem: false,
        }]);
    };

    const joinRoom = useCallback(async (name: string, roomId: string) => {
        currentRoomId.current = roomId;

        // Get Local Stream
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            setLocalStream(stream);
            localStreamRef.current = stream; // Immediate update for race condition check
        } catch (error) {
            console.error("Error accessing media devices:", error);
            if (error instanceof Error && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")) {
                setMediaError("Permission denied");
            } else {
                setMediaError("Error accessing camera/mic");
            }
        }

        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Wait for WebSocket to be ready before sending join
        const waitForWs = async (): Promise<boolean> => {
            for (let i = 0; i < 15; i++) {
                if (wsRef.current?.readyState === WebSocket.OPEN) return true;
                await new Promise(r => setTimeout(r, 200));
            }
            return false;
        };

        const wsReady = await waitForWs();
        if (!wsReady) {
            setRoomError("Could not connect to server. Please try again.");
            return;
        }

        sendWs({
            v: WS_PROTOCOL_VERSION,
            type: "room/join",
            payload: {
                roomId,
                client: {
                    userId,
                    displayName: name,
                },
            },
        });
    }, [sendWs]);

    const leaveRoom = useCallback(() => {
        if (currentRoomId.current) {
            sendWs({
                v: WS_PROTOCOL_VERSION,
                type: "room/leave",
                payload: { roomId: currentRoomId.current },
            });
        }

        // Cleanup
        if (localStream) {
            localStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            setLocalStream(null);
        }
        if (screenStream) {
            screenStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            setScreenStream(null);
        }

        setParticipants([]);
        setLocalUser(null);
        currentRoomId.current = null;
        setActiveStreamUrl("");

        pcsRef.current.forEach(pc => pc.close());
        pcsRef.current.clear();
    }, [localStream, screenStream, sendWs]);

    const setStreamUrl = useCallback((url: string) => {
        if (!currentRoomId.current) return;
        setActiveStreamUrl(url);
        sendWs({
            v: WS_PROTOCOL_VERSION,
            type: "watch/set_content",
            payload: {
                roomId: currentRoomId.current,
                contentId: url,
            },
        });
    }, [sendWs]);

    const toggleScreenShare = useCallback(async () => {
        if (!localUserRef.current || !currentRoomId.current) return;

        if (isScreenSharing) {
            // Stop Screen Share
            if (screenStream) {
                screenStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            }
            setScreenStream(null);
            setIsScreenSharing(false);

            // Revert video track to camera
            if (localStreamRef.current) {
                const cameraVideoTrack = localStreamRef.current.getVideoTracks()[0];
                const cameraAudioTrack = localStreamRef.current.getAudioTracks()[0];

                pcsRef.current.forEach(pc => {
                    // Revert video sender to camera
                    const videoSender = pc.getSenders().find(s => s.track?.kind === "video");
                    if (videoSender && cameraVideoTrack) {
                        videoSender.replaceTrack(cameraVideoTrack);
                    }

                    // Revert audio sender to mic
                    const audioSender = pc.getSenders().find(s => s.track?.kind === "audio");
                    if (audioSender && cameraAudioTrack) {
                        audioSender.replaceTrack(cameraAudioTrack);
                        console.log("[ScreenShare] Reverted audio sender to mic");
                    }
                });
            }

            setLocalUser((prev: Participant | null) => prev ? { ...prev, isScreenSharing: false } : null);

            // Broadcast stop share
            sendWs({
                v: WS_PROTOCOL_VERSION,
                type: "user/update",
                payload: {
                    roomId: currentRoomId.current,
                    state: { isScreenSharing: false }
                }
            });

        } else {
            // Start Screen Share
            try {
                // Explicit audio constraints for high quality system audio
                const displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 30
                    },
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        sampleRate: 44100,
                        autoGainControl: false,
                    }
                });

                displayStream.getVideoTracks()[0].onended = () => {
                    toggleScreenShare(); // Handle stop via browser UI
                };

                setScreenStream(displayStream);
                setIsScreenSharing(true);

                const screenVideoTrack = displayStream.getVideoTracks()[0];
                const screenAudioTracks = displayStream.getAudioTracks();
                const screenAudioTrack = screenAudioTracks.length > 0 ? screenAudioTracks[0] : null;

                console.log(`[ScreenShare] Got display stream. Audio tracks: ${screenAudioTracks.length}`);

                // Update PeerConnections
                pcsRef.current.forEach(pc => {
                    // Replace video with screen video
                    const videoSender = pc.getSenders().find(s => s.track?.kind === "video");
                    if (videoSender) {
                        videoSender.replaceTrack(screenVideoTrack);
                    }

                    // Replace audio with screen audio (if available) -> This effectively mutes mic and sends system audio
                    if (screenAudioTrack) {
                        const audioSender = pc.getSenders().find(s => s.track?.kind === "audio");
                        if (audioSender) {
                            audioSender.replaceTrack(screenAudioTrack)
                                .then(() => console.log("[ScreenShare] Successfully replaced mic with system audio"))
                                .catch(err => console.error("[ScreenShare] Failed to replace audio track:", err));
                        } else {
                            console.warn("[ScreenShare] No audio sender found to replace");
                        }
                    } else {
                        console.log("[ScreenShare] No system audio track available to send");
                    }
                });

                setLocalUser((prev: Participant | null) => prev ? { ...prev, isScreenSharing: true } : null);

                // Broadcast start share
                sendWs({
                    v: WS_PROTOCOL_VERSION,
                    type: "user/update",
                    payload: {
                        roomId: currentRoomId.current,
                        state: { isScreenSharing: true }
                    }
                });
            } catch (e) {
                console.error("Error starting screen share", e);
            }
        }
    }, [isScreenSharing, localStream, screenStream, sendWs]);

    const toggleMute = useCallback(() => {
        if (!localStream) return;
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setLocalUser((prev: Participant | null) => prev ? { ...prev, hasAudio: audioTrack.enabled } : null);

            if (currentRoomId.current) {
                sendWs({
                    v: WS_PROTOCOL_VERSION,
                    type: "user/update",
                    payload: {
                        roomId: currentRoomId.current,
                        state: { hasAudio: audioTrack.enabled }
                    }
                });
            }
        }
    }, [localStream]);

    const toggleVideo = useCallback(() => {
        if (!localStream) return;
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setLocalUser((prev: Participant | null) => prev ? { ...prev, hasVideo: videoTrack.enabled } : null);

            if (currentRoomId.current) {
                sendWs({
                    v: WS_PROTOCOL_VERSION,
                    type: "user/update",
                    payload: {
                        roomId: currentRoomId.current,
                        state: { hasVideo: videoTrack.enabled }
                    }
                });
            }
        }
    }, [localStream]);

    const switchCamera = useCallback(async () => {
        if (!localStream) return;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');

            if (videoDevices.length <= 1) {
                console.warn("No other camera available to switch to.");
                return;
            }

            const currentTrack = localStream.getVideoTracks()[0];
            const currentDeviceId = currentTrack?.getSettings().deviceId;

            const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
            const nextIndex = (currentIndex + 1) % videoDevices.length;
            const nextDevice = videoDevices[nextIndex];

            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: nextDevice.deviceId } },
                audio: false
            });
            const newVideoTrack = newStream.getVideoTracks()[0];

            if (currentTrack) {
                localStream.removeTrack(currentTrack);
                currentTrack.stop();
            }
            localStream.addTrack(newVideoTrack);

            // Replace track in peer connections
            pcsRef.current.forEach((pc: RTCPeerConnection) => {
                const sender = pc.getSenders().find((s: RTCRtpSender) => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(newVideoTrack);
                }
            });

            // Force update local stream ref
            setLocalStream(new MediaStream([newVideoTrack, ...localStream.getAudioTracks()]));
            localStreamRef.current = new MediaStream([newVideoTrack, ...localStream.getAudioTracks()]);

        } catch (e) {
            console.error("Error switching camera:", e);
        }
    }, [localStream]);

    const setPlayback = useCallback((state: "playing" | "paused", time: number) => {
        if (!currentRoomId.current) return;
        setPlaybackState(state);
        setCurrentTime(time);

        sendWs({
            v: WS_PROTOCOL_VERSION,
            type: "watch/playback_state",
            payload: {
                roomId: currentRoomId.current,
                state: {
                    playing: state === "playing",
                    positionSec: time,
                    hostTsMs: Date.now(),
                },
            },
        });
    }, [sendWs]);

    const sendMessage = useCallback((text: string) => {
        if (!currentRoomId.current) return;
        sendWs({
            v: WS_PROTOCOL_VERSION,
            type: "chat/send",
            payload: {
                roomId: currentRoomId.current,
                text,
            },
        });
    }, [sendWs]);

    const [incomingReactions, setIncomingReactions] = useState<IncomingReaction[]>([]);

    const sendReaction = useCallback((reaction: string) => {
        if (!currentRoomId.current) return;
        sendWs({
            v: WS_PROTOCOL_VERSION,
            type: "reaction/send",
            payload: {
                roomId: currentRoomId.current,
                reaction,
                source: "ui",
            },
        });
    }, [sendWs]);

    const value: RoomContextType = {
        participants,
        localUser,
        activeStreamUrl,
        isScreenSharing,
        screenStream,
        localStream,
        playbackState,
        currentTime,
        messages,
        joinRoom,
        leaveRoom,
        setStreamUrl,
        toggleScreenShare,
        toggleMute,
        toggleVideo,
        switchCamera,
        setPlayback,
        sendMessage,
        sendReaction,
        incomingReactions,
        mediaError,
        roomError,
    };

    return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
