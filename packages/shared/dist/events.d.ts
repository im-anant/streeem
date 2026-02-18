export declare const WS_PROTOCOL_VERSION: 1;
export type RoomId = string;
export type UserId = string;
export type ClientInfo = {
    userId: UserId;
    displayName: string;
};
export type PlaybackState = {
    /**
     * Whether the media should be playing.
     */
    playing: boolean;
    /**
     * Current media position (seconds) according to the host at the time of the event.
     */
    positionSec: number;
    /**
     * Host wall clock timestamp (ms since epoch) when this state was emitted.
     * Used for drift correction: clients can approximate "now" position.
     */
    hostTsMs: number;
    /**
     * Optional content identifier (e.g. URL or asset id) to ensure clients sync the same media.
     */
    contentId?: string;
};
export type WsEnvelope<TType extends string, TPayload> = {
    v: typeof WS_PROTOCOL_VERSION;
    type: TType;
    requestId?: string;
    payload: TPayload;
};
/**
 * Client -> Server events
 */
export type C2S = WsEnvelope<"room/join", {
    roomId: RoomId;
    client: ClientInfo;
}> | WsEnvelope<"room/leave", {
    roomId: RoomId;
}> | WsEnvelope<"chat/send", {
    roomId: RoomId;
    text: string;
}> | WsEnvelope<"watch/set_content", {
    roomId: RoomId;
    contentId: string;
    meta?: Record<string, unknown>;
}> | WsEnvelope<"watch/playback_state", {
    roomId: RoomId;
    state: PlaybackState;
    /**
     * Host indicates this is authoritative state (host controls).
     * In MVP you can enforce host-only on the server.
     */
    authoritative?: boolean;
}> | WsEnvelope<"webrtc/offer", {
    roomId: RoomId;
    toUserId: UserId;
    sdp: RTCSessionDescriptionInit;
}> | WsEnvelope<"webrtc/answer", {
    roomId: RoomId;
    toUserId: UserId;
    sdp: RTCSessionDescriptionInit;
}> | WsEnvelope<"webrtc/ice", {
    roomId: RoomId;
    toUserId: UserId;
    candidate: RTCIceCandidateInit;
}> | WsEnvelope<"user/update", {
    roomId: RoomId;
    state: Partial<{
        hasAudio: boolean;
        hasVideo: boolean;
        isSpeaking: boolean;
        isScreenSharing: boolean;
    }>;
}>;
/**
 * Server -> Client events
 */
export type S2C = WsEnvelope<"server/hello", {
    v: typeof WS_PROTOCOL_VERSION;
    nowMs: number;
}> | WsEnvelope<"room/joined", {
    roomId: RoomId;
    you: ClientInfo;
    peers: ClientInfo[];
}> | WsEnvelope<"room/peer_joined", {
    roomId: RoomId;
    peer: ClientInfo;
}> | WsEnvelope<"room/peer_left", {
    roomId: RoomId;
    userId: UserId;
}> | WsEnvelope<"chat/message", {
    roomId: RoomId;
    from: ClientInfo;
    text: string;
    tsMs: number;
}> | WsEnvelope<"watch/content", {
    roomId: RoomId;
    contentId: string;
    meta?: Record<string, unknown>;
}> | WsEnvelope<"watch/playback_state", {
    roomId: RoomId;
    state: PlaybackState;
    /**
     * Server timestamp when it forwarded this state (ms since epoch).
     * Can be used as fallback if hostTsMs is missing.
     */
    serverTsMs: number;
    fromUserId: UserId;
}> | WsEnvelope<"webrtc/offer", {
    roomId: RoomId;
    fromUserId: UserId;
    sdp: RTCSessionDescriptionInit;
}> | WsEnvelope<"webrtc/answer", {
    roomId: RoomId;
    fromUserId: UserId;
    sdp: RTCSessionDescriptionInit;
}> | WsEnvelope<"webrtc/ice", {
    roomId: RoomId;
    fromUserId: UserId;
    candidate: RTCIceCandidateInit;
}> | WsEnvelope<"user/updated", {
    roomId: RoomId;
    userId: UserId;
    state: Partial<{
        hasAudio: boolean;
        hasVideo: boolean;
        isSpeaking: boolean;
        isScreenSharing: boolean;
    }>;
}> | WsEnvelope<"error", {
    requestId?: string;
    code: "bad_request" | "unauthorized" | "not_in_room" | "room_not_found" | "peer_not_found" | "internal";
    message: string;
}> | WsEnvelope<"ack", {
    requestId: string;
}>;
export declare function isClientEvent(msg: unknown): msg is C2S;
//# sourceMappingURL=events.d.ts.map