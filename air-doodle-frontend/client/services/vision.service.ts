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

  private eventCount = 0;
  private lastDiagTime = Date.now();

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
        console.log(`[VisionService] Connected to vision server at ${this.url}`);
        this.onStatusCallback?.({
          connected: true,
          handDetected: false,
          statusText: "Vision Agent Active (Tracking gestures)",
        });
      };

      this.ws.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data);
          this.eventCount++;
          const now = Date.now();
          if (now - this.lastDiagTime >= 3000) {
            const rate = (this.eventCount / ((now - this.lastDiagTime) / 1000)).toFixed(1);
            console.log(
              `[VisionService Diagnostics] Event rate: ${rate}/s | Last: ${data.type} | Hand: ${data.hand || "N/A"} | Action: ${data.action || "N/A"}`
            );
            this.eventCount = 0;
            this.lastDiagTime = now;
          }

          if (
            data.type === "cursorMoved" ||
            data.type === "penDown" ||
            data.type === "penUp" ||
            data.type === "eraseAt" ||
            data.type === "strokeFinished" ||
            data.type === "handStatus" ||
            data.type === "cameraPreview" ||
            data.type === "cameraError" ||
            data.type === "agentStatus"
          ) {
            this.onEventCallback?.(data as InputEvent);
            if (data.type === "cameraError") {
              this.onStatusCallback?.({
                connected: true,
                handDetected: false,
                statusText: data.message || "Camera Error",
              });
            } else if (data.type !== "cameraPreview") {
              this.onStatusCallback?.({
                connected: true,
                handDetected: data.type === "handStatus" ? data.handDetected : true,
                statusText: data.action ? `Action: ${data.action}` : "Hand Tracked",
              });
            }
          }
        } catch (err) {
          console.warn("[VisionAgentClient] Error parsing message:", err);
        }
      };

      this.ws.onerror = (e) => {
        console.warn("[VisionService Diagnostics] WebSocket error encountered. Ensure vision agent is running at", this.url);
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
