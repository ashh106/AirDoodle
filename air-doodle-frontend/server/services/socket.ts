import { Server as SocketIOServer, Socket } from "socket.io";
import { db } from "./db";
import { Shape } from "../../shared/shape";
import * as rooms from "./creative-rooms";

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

    const identity = () => ({
      socketId: socket.id,
      userId: currentUser?.id || socket.id,
      name: currentUser?.name || "Guest",
    });

    socket.on("room:create", ({ solo }: { solo?: boolean } = {}) => {
      const member = identity();
      const existing = rooms.roomForSocket(socket.id);
      if (existing) rooms.leaveRoom(socket.id);
      const room = rooms.createAndJoin(member, Boolean(solo));
      socket.join(`creative:${room.id}`);
      socket.emit("room:joined", rooms.snapshot(room));
    });

    socket.on("room:join", ({ roomId }: { roomId: string }) => {
      if (!roomId || typeof roomId !== "string") return;
      const result = rooms.joinRoom(roomId, identity());
      if (!result.ok) {
        socket.emit("room:error", { error: result.error });
        return;
      }
      socket.join(`creative:${roomId}`);
      socket.emit("room:joined", rooms.snapshot(result.room));
      socket.to(`creative:${roomId}`).emit("room:members", result.members);
    });

    socket.on("room:match", () => {
      const member = identity();
      const result = rooms.enqueueMatch(member.userId, member.socketId, member.name);
      if (!result.ok) {
        socket.emit("room:error", { error: result.error });
        return;
      }
      if (result.state === "searching") {
        socket.emit("room:searching", { state: "searching" });
        return;
      }
      if (result.state === "matched" && result.roomId) {
        for (const m of result.members) {
          io?.to(m.socketId).socketsJoin(`creative:${result.roomId}`);
          io?.to(m.socketId).emit("room:matched", {
            roomId: result.roomId,
            members: result.members,
          });
        }
      }
    });

    socket.on("room:cancel", () => {
      rooms.leaveQueue(identity().userId);
      socket.emit("room:idle", { state: "idle" });
    });

    socket.on("room:leave", () => {
      const left = rooms.leaveRoom(socket.id);
      if (left.roomId) {
        socket.leave(`creative:${left.roomId}`);
        socket.to(`creative:${left.roomId}`).emit("room:members", left.remaining);
        socket.emit("room:left", { roomId: left.roomId });
      }
    });

    socket.on("room:chat", ({ text }: { text: string }) => {
      const room = rooms.roomForSocket(socket.id);
      if (!room) return;
      const member = identity();
      const valid = rooms.validateChat(text, member.userId);
      if (!valid.ok) {
        socket.emit("room:error", { error: valid.error });
        return;
      }
      const msg = rooms.appendChat(room, { userId: member.userId, name: member.name, text: valid.text });
      io?.to(`creative:${room.id}`).emit("room:chat", msg);
    });

    socket.on("room:shape", ({ shape, op }: { shape: Shape; op: "create" | "update" | "delete" }) => {
      const room = rooms.roomForSocket(socket.id);
      if (!room || !shape || !rooms.validateDraw(identity().userId) || !rooms.payloadSizeOk(shape)) return;
      if (op === "delete") room.shapes.delete(shape.id);
      else room.shapes.set(shape.id, shape);
      socket.to(`creative:${room.id}`).emit("room:shape", { shape, op });
    });

    socket.on("room:cursor", ({ x, y }: { x: number; y: number }) => {
      const room = rooms.roomForSocket(socket.id);
      if (!room) return;
      socket.to(`creative:${room.id}`).emit("room:cursor", { ...identity(), x, y });
    });

    socket.on("room:note", ({ note, on }: { note: string; on: boolean }) => {
      const room = rooms.roomForSocket(socket.id);
      if (!room || typeof note !== "string" || note.length > 8) return;
      socket.to(`creative:${room.id}`).emit("room:note", { ...identity(), note, on, at: Date.now() });
    });

    socket.on("room:report", ({ reason }: { reason?: string }) => {
      const room = rooms.roomForSocket(socket.id);
      if (!room) return;
      io?.to(`creative:${room.id}`).emit("room:moderation", {
        type: "report",
        from: identity().userId,
        reason: String(reason || "unspecified").slice(0, 200),
      });
    });

    socket.on("disconnect", () => {
      if (currentProjectId && currentUser) {
        socket.to(`project:${currentProjectId}`).emit("user:left", {
          user: currentUser,
          socketId: socket.id,
        });
      }
      const left = rooms.leaveRoom(socket.id);
      rooms.leaveQueue(identity().userId);
      if (left.roomId) {
        socket.to(`creative:${left.roomId}`).emit("room:members", left.remaining);
      }
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
