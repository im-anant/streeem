# WebSocket Event Schema (v1)

This document defines the **canonical WebSocket signaling protocol** for StreamSync.

All messages are JSON with a versioned envelope:

```json
{
  "v": 1,
  "type": "room/join",
  "requestId": "optional-client-uuid",
  "payload": {}
}
```

## Conventions

- **Rooms**: All room-scoped events include `roomId`.
- **requestId**: If present, server should respond with `ack` or `error` referencing the same `requestId`.
- **Clocking for sync**:
  - Host sends `hostTsMs` + `positionSec`.
  - Clients estimate current position as:
    \[
      positionNow \approx positionSec + \frac{(nowMs - hostTsMs)}{1000}
    \]
  - Clients apply a correction policy (example):
    - if drift > 250ms: seek to target
    - else: slightly adjust playbackRate (e.g. 0.98–1.02) to converge

## Server -> Client

### `server/hello`
Sent immediately after socket connect.

Payload:
- `v`: protocol version (1)
- `nowMs`: server wall-clock ms since epoch

### `room/joined`
Sent after successful join.

Payload:
- `roomId`
- `you`: `{ userId, displayName }`
- `peers`: array of current peers `{ userId, displayName }`

### `room/peer_joined`
Broadcast to room when a peer joins.

Payload:
- `roomId`
- `peer`: `{ userId, displayName }`

### `room/peer_left`
Broadcast to room when a peer leaves/disconnects.

Payload:
- `roomId`
- `userId`

### `chat/message`
Broadcast chat message.

Payload:
- `roomId`
- `from`: `{ userId, displayName }`
- `text`
- `tsMs`

### `watch/content`
Broadcast current content (URL/id).

Payload:
- `roomId`
- `contentId`
- `meta` (optional)

### `watch/playback_state`
Broadcast playback state (authoritative host state).

Payload:
- `roomId`
- `state`: `{ playing, positionSec, hostTsMs, contentId? }`
- `serverTsMs`
- `fromUserId`

### WebRTC relay events
These events are used for P2P in MVP and can later be replaced by SFU negotiation.

- `webrtc/offer`: `{ roomId, fromUserId, sdp }`
- `webrtc/answer`: `{ roomId, fromUserId, sdp }`
- `webrtc/ice`: `{ roomId, fromUserId, candidate }`

### `ack`
Payload:
- `requestId`

### `error`
Payload:
- `requestId?`
- `code`: `bad_request | unauthorized | not_in_room | room_not_found | peer_not_found | internal`
- `message`

## Client -> Server

### `room/join`
Payload:
- `roomId`
- `client`: `{ userId, displayName }`

### `room/leave`
Payload:
- `roomId`

### `chat/send`
Payload:
- `roomId`
- `text`

### `watch/set_content`
Payload:
- `roomId`
- `contentId`
- `meta?`

### `watch/playback_state`
Payload:
- `roomId`
- `state`: `{ playing, positionSec, hostTsMs, contentId? }`
- `authoritative?` (server can enforce host-only)

### WebRTC relay events
- `webrtc/offer`: `{ roomId, toUserId, sdp }`
- `webrtc/answer`: `{ roomId, toUserId, sdp }`
- `webrtc/ice`: `{ roomId, toUserId, candidate }`

