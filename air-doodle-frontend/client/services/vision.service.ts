import { InputEvent } from "@/types/input";

export interface VisionAgentStatus {
  connected: boolean;
  handDetected?: boolean;
  statusText: string;
}

export class VisionAgentClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onEventCallback: ((event: InputEvent) => void) | null = null;
  private onStatusCallback: ((status: VisionAgentStatus) => void) | null = null;
  private reconnectTimer: any = null;
  private shouldConnect = false;

  constructor(url?: string) {
    this.url = url || (import.meta.env.VITE_VISION_WS_URL as string) || "ws://localhost:8765";
  }

  public connect(
    onEvent: (event: InputEvent) => void,
    onStatus?: (status: VisionAgentStatus) => void
  ) {
    this.onEventCallback = onEvent;
    this.onStatusCallback = onStatus || null;
    this.shouldConnect = true;
    this.initSocket();
  }

  private initSocket() {
    if (typeof window === "undefined" || !this.shouldConnect) return;

    // Clean up any stale socket
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.onStatusCallback?.({
          connected: true,
          handDetected: false,
          statusText: "Vision Agent Active (Tracking gestures)",
        });
      };

      this.ws.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data);
          if (
            data.type === "cursorMoved" ||
            data.type === "penDown" ||
            data.type === "penUp" ||
            data.type === "eraseAt" ||
            data.type === "strokeFinished" ||
            data.type === "handStatus"
          ) {
            this.onEventCallback?.(data as InputEvent);
            this.onStatusCallback?.({
              connected: true,
              handDetected: data.type === "handStatus" ? data.handDetected : true,
              statusText: data.action ? `Action: ${data.action}` : "Hand Tracked",
            });
          }
        } catch (err) {
          console.warn("[VisionAgentClient] Error parsing message:", err);
        }
      };

      this.ws.onerror = () => {
        this.onStatusCallback?.({
          connected: false,
          handDetected: false,
          statusText: "Vision Agent Offline (Mouse fallback active)",
        });
      };

      this.ws.onclose = () => {
        this.onStatusCallback?.({
          connected: false,
          handDetected: false,
          statusText: "Vision Agent Disconnected",
        });
        if (this.shouldConnect) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.initSocket(), 4000);
        }
      };
    } catch {
      this.onStatusCallback?.({
        connected: false,
        handDetected: false,
        statusText: "Vision Agent Unavailable",
      });
    }
  }

  public disconnect() {
    this.shouldConnect = false;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.onStatusCallback?.({
      connected: false,
      handDetected: false,
      statusText: "Vision Agent Stopped",
    });
  }

  public get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const visionAgent = new VisionAgentClient();
