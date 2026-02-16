import { WS_PROTOCOL_VERSION, type C2S, type S2C } from "@streamsync/shared";

type Handler = (msg: S2C) => void;

export class WsClient {
  private ws?: WebSocket;
  private handler?: Handler;
  private onOpen?: () => void;
  private onClose?: () => void;

  constructor(private url: string) {}

  connect(handler: Handler, opts?: { onOpen?: () => void; onClose?: () => void }) {
    this.handler = handler;
    this.onOpen = opts?.onOpen;
    this.onClose = opts?.onClose;
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => this.onOpen?.();
    this.ws.onclose = () => this.onClose?.();
    this.ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as S2C;
        if (parsed?.v !== WS_PROTOCOL_VERSION || typeof parsed?.type !== "string") return;
        this.handler?.(parsed);
      } catch {
        // ignore
      }
    };
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
  }

  send(msg: C2S) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  get readyState() {
    return this.ws?.readyState;
  }
}


