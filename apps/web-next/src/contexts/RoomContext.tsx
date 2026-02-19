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

const getIceServers = () => {
    const servers: RTCIceServer[] = [
        { urls: "stun:stun.l.google.com:19302" },
    ];

    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
    if (turnUrl) {
        if (!turnUrl.startsWith("turn:") && !turnUrl.startsWith("turns:")) {
            console.error(`[WebRTC] Invalid TURN URL: ${turnUrl}. Must start with "turn:" or "turns:". Check your environment variables.`);
        } else {
            console.log(`[WebRTC] Using TURN server: ${turnUrl}`);
            servers.push({
                urls: turnUrl,
                username: process.env.NEXT_PUBLIC_TURN_USERNAME,
                credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
            });
        }
    } else {
        // We will try fetching from API if env vars are missing or if we want dynamic.
        // But for now, let's keep this simple fallback or just rely on the async fetch we'll add.
    }

    return { iceServers: servers };
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

    const createPeerConnection = async (targetUserId: string) => {
        console.log(`[WebRTC] Creating PC for ${targetUserId}`);

        // Fetch ICE servers dynamically
        const { iceServers } = getIceServers();

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
            console.error("Failed to fetch TURN credentials", e);
        }

        const pc = new RTCPeerConnection({ iceServers });

        pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE Connection State (${targetUserId}): ${pc.iceConnectionState}`);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && currentRoomId.current) {
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

        // Add local tracks if available
        if (localStreamRef.current) {
            console.log(`[WebRTC] Adding local tracks to ${targetUserId}`);
            localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
                pc.addTrack(track, localStreamRef.current!);
            });
        } else {
            console.warn(`[WebRTC] No local stream found when creating PC for ${targetUserId}`);
        }

        pcsRef.current.set(targetUserId, pc);

        // Process pending candidates
        const pending = pendingCandidates.current.get(targetUserId);
        if (pending && pending.length > 0) {
            console.log(`[WebRTC] Processing ${pending.length} pending ICE candidates for ${targetUserId}`);
            for (const candidate of pending) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error("Error adding pending ICE candidate", e);
                }
            }
            pendingCandidates.current.delete(targetUserId);
        }

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
        }
    };

    const handleWebrtcIce = async (payload: { roomId: string; fromUserId: string; candidate: RTCIceCandidateInit }) => {
        const pc = pcsRef.current.get(payload.fromUserId);
        if (pc) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
                console.error("Error adding ICE candidate", e);
            }
        } else {
            console.warn(`[WebRTC] Received ICE for missing PC (${payload.fromUserId}), buffering.`);
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

        // Send Join Request
        // We need to wait for localUser to be set by server response? 
        // No, we send ClientInfo in join request.
        // We generate a temp ID or let server assign? Server events.ts says client provides ClientInfo.
        // So we generate ID here.
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
        mediaError,
        roomError,
    };

    return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
