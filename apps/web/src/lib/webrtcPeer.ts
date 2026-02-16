import type { RoomId, UserId } from "@streamsync/shared";
import type { WsClient } from "./wsClient";

export type PeerEvents = {
  onRemoteTrack?: (stream: MediaStream) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
};

export class WebRtcPeer {
  pc: RTCPeerConnection;
  remoteStream = new MediaStream();

  constructor(
    private ws: WsClient,
    private roomId: RoomId,
    private toUserId: UserId,
    private events: PeerEvents = {}
  ) {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
    });

    this.pc.ontrack = (ev) => {
      for (const track of ev.streams[0]?.getTracks?.() ?? [ev.track]) {
        if (track) this.remoteStream.addTrack(track);
      }
      this.events.onRemoteTrack?.(this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      this.events.onConnectionState?.(this.pc.connectionState);
    };

    this.pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      this.ws.send({
        v: 1,
        type: "webrtc/ice",
        payload: { roomId: this.roomId, toUserId: this.toUserId, candidate: ev.candidate.toJSON() }
      });
    };
  }

  addLocalStream(stream: MediaStream) {
    for (const track of stream.getTracks()) {
      this.pc.addTrack(track, stream);
    }
  }

  async createAndSendOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.ws.send({
      v: 1,
      type: "webrtc/offer",
      payload: { roomId: this.roomId, toUserId: this.toUserId, sdp: offer }
    });
  }

  async handleOfferAndSendAnswer(offer: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.ws.send({
      v: 1,
      type: "webrtc/answer",
      payload: { roomId: this.roomId, toUserId: this.toUserId, sdp: answer }
    });
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(answer);
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    await this.pc.addIceCandidate(candidate);
  }

  close() {
    try {
      this.pc.close();
    } catch {
      // ignore
    }
  }
}

