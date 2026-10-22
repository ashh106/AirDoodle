import { io, Socket } from "socket.io-client";
import { Shape } from "@/types/shape";
import { User } from "@/types/user";

export interface RemoteCursor {
  socketId: string;
  user?: { id: string; name: string };
  x: number;
  y: number;
}

export interface CollaborationCallbacks {
  onShapeCreated?: (shape: Shape) => void;
  onShapeUpdated?: (shape: Shape) => void;
  onShapeDeleted?: (id: string) => void;
  onCursorMoved?: (cursor: RemoteCursor) => void;
  onPeerJoined?: (peer: { user?: { id: string; name: string }; socketId: string }) => void;
  onPeerLeft?: (peer: { user?: { id: string; name: string }; socketId: string }) => void;
  onStatusChange?: (connected: boolean) => void;
}

class CollaborationService {
  private socket: Socket | null = null;
  private currentProjectId: string | null = null;
  private isConnected = false;

  public connect(projectId: string, user?: User | null, callbacks?: CollaborationCallbacks) {
    if (this.socket) {
      this.disconnect();
    }

    this.currentProjectId = projectId;

    // Connect to host
    this.socket = io({
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    this.socket.on("connect", () => {
      this.isConnected = true;
      callbacks?.onStatusChange?.(true);

      this.socket?.emit("project:join", {
        projectId,
        user: user ? { id: user.id, name: user.name } : undefined,
      });
    });

    this.socket.on("disconnect", () => {
      this.isConnected = false;
      callbacks?.onStatusChange?.(false);
    });

    this.socket.on("connect_error", () => {
      this.isConnected = false;
      callbacks?.onStatusChange?.(false);
    });

    if (callbacks?.onShapeCreated) {
      this.socket.on("shape:created", callbacks.onShapeCreated);
    }
    if (callbacks?.onShapeUpdated) {
      this.socket.on("shape:updated", callbacks.onShapeUpdated);
    }
    if (callbacks?.onShapeDeleted) {
      this.socket.on("shape:deleted", callbacks.onShapeDeleted);
    }
    if (callbacks?.onCursorMoved) {
      this.socket.on("cursor:moved", callbacks.onCursorMoved);
    }
    if (callbacks?.onPeerJoined) {
      this.socket.on("user:joined", callbacks.onPeerJoined);
    }
    if (callbacks?.onPeerLeft) {
      this.socket.on("user:left", callbacks.onPeerLeft);
    }
  }

  public sendShapeCreate(shape: Shape) {
    if (this.socket && this.isConnected && this.currentProjectId) {
      this.socket.emit("shape:create", { projectId: this.currentProjectId, shape });
    }
  }

  public sendShapeUpdate(shape: Shape) {
    if (this.socket && this.isConnected && this.currentProjectId) {
      this.socket.emit("shape:update", { projectId: this.currentProjectId, shape });
    }
  }

  public sendShapeDelete(id: string) {
    if (this.socket && this.isConnected && this.currentProjectId) {
      this.socket.emit("shape:delete", { projectId: this.currentProjectId, id });
    }
  }

  public sendCursorMove(x: number, y: number) {
    if (this.socket && this.isConnected && this.currentProjectId) {
      this.socket.emit("cursor:move", { projectId: this.currentProjectId, x, y });
    }
  }

  public disconnect() {
    if (this.socket) {
      if (this.currentProjectId) {
        this.socket.emit("project:leave", { projectId: this.currentProjectId });
      }
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentProjectId = null;
    this.isConnected = false;
  }

  public get connected(): boolean {
    return this.isConnected;
  }
}

export const collaborationService = new CollaborationService();
