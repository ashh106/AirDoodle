import { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { db } from "./db";
import { Shape } from "../../shared/shape";

let io: SocketIOServer | null = null;

export function attachSocketServer(httpServer: any): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    let currentProjectId: string | null = null;
    let currentUser: { id: string; name: string } | null = null;

    socket.on("project:join", ({ projectId, user }: { projectId: string; user?: { id: string; name: string } }) => {
      if (!projectId) return;

      if (currentProjectId) {
        socket.leave(`project:${currentProjectId}`);
      }

      currentProjectId = projectId;
      currentUser = user || { id: socket.id, name: "Anonymous" };

      socket.join(`project:${projectId}`);
      socket.to(`project:${projectId}`).emit("user:joined", {
        user: currentUser,
        socketId: socket.id,
      });

      // Send initial confirmation
      socket.emit("project:joined", { projectId });
    });

    socket.on("project:leave", ({ projectId }: { projectId: string }) => {
      if (projectId) {
        socket.leave(`project:${projectId}`);
        socket.to(`project:${projectId}`).emit("user:left", {
          user: currentUser,
          socketId: socket.id,
        });
      }
      currentProjectId = null;
    });

    socket.on("shape:create", ({ projectId, shape }: { projectId: string; shape: Shape }) => {
      if (!projectId || !shape) return;

      // Update in-memory and disk persistence
      const project = db.getProject(projectId);
      if (project) {
        const existingIdx = project.shapes.findIndex(s => s.id === shape.id);
        if (existingIdx >= 0) {
          project.shapes[existingIdx] = shape;
        } else {
          project.shapes.push(shape);
        }
        db.updateProject(projectId, { shapes: project.shapes });
      }

      // Broadcast to all other peers in the project room
      socket.to(`project:${projectId}`).emit("shape:created", shape);
    });

    socket.on("shape:update", ({ projectId, shape }: { projectId: string; shape: Shape }) => {
      if (!projectId || !shape) return;

      const project = db.getProject(projectId);
      if (project) {
        const idx = project.shapes.findIndex(s => s.id === shape.id);
        if (idx >= 0) {
          project.shapes[idx] = shape;
          db.updateProject(projectId, { shapes: project.shapes });
        }
      }

      socket.to(`project:${projectId}`).emit("shape:updated", shape);
    });

    socket.on("shape:delete", ({ projectId, id }: { projectId: string; id: string }) => {
      if (!projectId || !id) return;

      const project = db.getProject(projectId);
      if (project) {
        project.shapes = project.shapes.filter(s => s.id !== id);
        db.updateProject(projectId, { shapes: project.shapes });
      }

      socket.to(`project:${projectId}`).emit("shape:deleted", id);
    });

    socket.on("cursor:move", ({ projectId, x, y }: { projectId: string; x: number; y: number }) => {
      if (!projectId) return;
      // Transient broadcast, no persistence
      socket.to(`project:${projectId}`).emit("cursor:moved", {
        user: currentUser,
        socketId: socket.id,
        x,
        y,
      });
    });

    socket.on("disconnect", () => {
      if (currentProjectId && currentUser) {
        socket.to(`project:${currentProjectId}`).emit("user:left", {
          user: currentUser,
          socketId: socket.id,
        });
      }
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
