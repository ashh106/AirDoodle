import { InputEvent, CameraLifecycleState } from "@/types/input";

export interface VisionAgentStatus {
  connected: boolean;
  handDetected?: boolean;
  cameraState: CameraLifecycleState;
  statusText: string;
}

export class VisionAgentClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onEventCallback: ((event: InputEvent) => void) | null = null;
  private onStatusCallback: ((status: VisionAgentStatus) => void) | null = null;
  private reconnectTimer: any = null;
  private shouldConnect = false;
  private currentCameraState: CameraLifecycleState = "off";
  private isHandDetected = false;

  constructor(url?: string) {
    this.url = url || (import.meta.env.VITE_VISION_WS_URL as string) || "ws://localhost:8765";
  }

  public get cameraState(): CameraLifecycleState {
    return this.currentCameraState;
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

  private notifyStatus(statusText?: string) {
    let defaultText = "Camera Off";
    if (!this.isConnected) {
      defaultText = "Vision Agent Disconnected";
    } else if (this.currentCameraState === "starting") {
      defaultText = "Starting Camera...";
    } else if (this.currentCameraState === "stopping") {
      defaultText = "Stopping Camera...";
    } else if (this.currentCameraState === "error") {
      defaultText = "Camera Error";
    } else if (this.currentCameraState === "active") {
      defaultText = this.isHandDetected ? "Hand Tracked" : "Searching for Hands...";
    }

    this.onStatusCallback?.({
      connected: this.isConnected,
      handDetected: this.isHandDetected,
      cameraState: this.currentCameraState,
      statusText: statusText || defaultText,
    });
  }

  private initSocket() {
    if (typeof WebSocket === "undefined" || !this.shouldConnect) return;

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
        this.notifyStatus("Vision Agent Linked (Camera Off)");
      };

      this.ws.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data);

          if (data.type === "agentStatus") {
            if (data.cameraState) {
              this.currentCameraState = data.cameraState as CameraLifecycleState;
            }
            this.notifyStatus();
            this.onEventCallback?.(data as InputEvent);
          } else if (data.type === "cameraStatus") {
            this.currentCameraState = data.state as CameraLifecycleState;
            this.notifyStatus();
            this.onEventCallback?.(data as InputEvent);
          } else if (data.type === "cameraError") {
            this.currentCameraState = "error";
            this.isHandDetected = false;
            this.notifyStatus(data.message || "Camera Error");
            this.onEventCallback?.(data as InputEvent);
          } else if (data.type === "handStatus") {
            this.isHandDetected = !!data.handDetected;
            this.notifyStatus(data.action ? `Action: ${data.action}` : undefined);
            this.onEventCallback?.(data as InputEvent);
          } else if (
            data.type === "cursorMoved" ||
            data.type === "penDown" ||
            data.type === "penUp" ||
            data.type === "eraseAt" ||
            data.type === "strokeFinished" ||
            data.type === "cameraPreview"
          ) {
            if (data.type !== "cameraPreview") {
              this.isHandDetected = true;
            }
            this.onEventCallback?.(data as InputEvent);
          }
        } catch (err) {
          console.warn("[VisionAgentClient] Error parsing message:", err);
        }
      };

      this.ws.onerror = () => {
        this.currentCameraState = "off";
        this.isHandDetected = false;
        this.notifyStatus("Vision Agent Offline (Mouse fallback active)");
      };

      this.ws.onclose = () => {
        this.currentCameraState = "off";
        this.isHandDetected = false;
        this.notifyStatus("Vision Agent Disconnected");
        // Reconnect socket transport only; never silently start camera
        if (this.shouldConnect) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.initSocket(), 4000);
        }
      };
    } catch {
      this.currentCameraState = "off";
      this.isHandDetected = false;
      this.notifyStatus("Vision Agent Unavailable");
    }
  }

  public startCapture() {
    this.currentCameraState = "starting";
    this.notifyStatus("Starting Camera...");
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "startCapture" }));
    } else {
      // Connect first, then send
      this.connect(
        this.onEventCallback || (() => {}),
        this.onStatusCallback || undefined
      );
      const checkAndSend = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          clearInterval(checkAndSend);
          this.ws.send(JSON.stringify({ action: "startCapture" }));
        }
      }, 100);
      setTimeout(() => clearInterval(checkAndSend), 5000);
    }
  }

  public stopCapture() {
    this.currentCameraState = "stopping";
    this.notifyStatus("Stopping Camera...");
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ action: "stopCapture" }));
      } catch {}
    }
    this.currentCameraState = "off";
    this.isHandDetected = false;
    this.notifyStatus("Camera Off");
  }

  public lockHand(hand: "auto" | "Right" | "Left") {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ action: "lockHand", hand }));
      } catch {}
    }
  }

  public setMode(mode: "draw" | "music" | "recognize") {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ action: "setMode", mode }));
      } catch {}
    }
  }

  public disconnect() {
    this.stopCapture();
    this.shouldConnect = false;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.currentCameraState = "off";
    this.isHandDetected = false;
    this.notifyStatus("Vision Agent Stopped");
  }

  public get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const visionAgent = new VisionAgentClient();
