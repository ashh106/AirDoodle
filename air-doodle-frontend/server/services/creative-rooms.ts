export type RoomMode = "draw" | "music";
export type MatchmakingState = "idle" | "searching" | "matched" | "in_room" | "leaving";

export interface RoomMember {
  socketId: string;
  userId: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  text: string;
  createdAt: number;
}

export interface CreativeRoom {
  id: string;
  members: Map<string, RoomMember>;
  shapes: Map<string, unknown>;
  chat: ChatMessage[];
  blocked: Set<string>;
  createdAt: number;
  solo: boolean;
}

const MAX_CHAT = 280;
const CHAT_RATE_MS = 400;
const DRAW_RATE_MS = 40;
const MATCH_RATE_MS = 800;

const queue: { userId: string; socketId: string; name: string; enqueuedAt: number }[] = [];
const rooms = new Map<string, CreativeRoom>();
const socketIndex = new Map<string, string>();
const lastChatAt = new Map<string, number>();
const lastDrawAt = new Map<string, number>();
const lastMatchAt = new Map<string, number>();

const now = () => Date.now();

const rateOk = (map: Map<string, number>, key: string, minMs: number) => {
  const last = map.get(key) || 0;
  const t = now();
  if (t - last < minMs) return false;
  map.set(key, t);
  return true;
};

export const createRoomId = () => `room_${Math.random().toString(36).slice(2, 10)}`;

export function leaveQueue(userId: string) {
  const idx = queue.findIndex((q) => q.userId === userId);
  if (idx >= 0) queue.splice(idx, 1);
}

export function enqueueMatch(userId: string, socketId: string, name: string) {
  if ([...rooms.values()].some((r) => [...r.members.values()].some((m) => m.userId === userId))) {
    return { ok: false as const, error: "already_in_room" };
  }
  if (!rateOk(lastMatchAt, userId, MATCH_RATE_MS)) {
    return { ok: false as const, error: "rate_limited" };
  }
  leaveQueue(userId);
  const partner = queue.shift();
  if (!partner || partner.userId === userId) {
    if (partner && partner.userId === userId) {
      queue.push({ userId, socketId, name, enqueuedAt: now() });
    } else {
      queue.push({ userId, socketId, name, enqueuedAt: now() });
    }
    return { ok: true as const, state: "searching" as MatchmakingState, waiting: true };
  }
  const room = makeRoom(false);
  addMember(room, { socketId: partner.socketId, userId: partner.userId, name: partner.name });
  addMember(room, { socketId, userId, name });
  return {
    ok: true as const,
    state: "matched" as MatchmakingState,
    roomId: room.id,
    members: [...room.members.values()],
  };
}

export function makeRoom(solo: boolean): CreativeRoom {
  const room: CreativeRoom = {
    id: createRoomId(),
    members: new Map(),
    shapes: new Map(),
    chat: [],
    blocked: new Set(),
    createdAt: now(),
    solo,
  };
  rooms.set(room.id, room);
  return room;
}

function addMember(room: CreativeRoom, member: RoomMember) {
  room.members.set(member.socketId, member);
  socketIndex.set(member.socketId, room.id);
}

export function joinRoom(roomId: string, member: RoomMember) {
  const room = rooms.get(roomId);
  if (!room) return { ok: false as const, error: "not_found" };
  if (room.blocked.has(member.userId)) return { ok: false as const, error: "blocked" };
  if ([...room.members.values()].some((m) => m.userId === member.userId)) {
    for (const [sid, m] of room.members) {
      if (m.userId === member.userId) {
        room.members.delete(sid);
        socketIndex.delete(sid);
      }
    }
  }
  addMember(room, member);
  return { ok: true as const, room, members: [...room.members.values()] };
}

export function createAndJoin(member: RoomMember, solo = false) {
  const room = makeRoom(solo);
  addMember(room, member);
  return room;
}

export function roomForSocket(socketId: string) {
  const id = socketIndex.get(socketId);
  return id ? rooms.get(id) : undefined;
}

export function isMember(socketId: string, roomId: string) {
  const room = rooms.get(roomId);
  return Boolean(room?.members.has(socketId));
}

export function leaveRoom(socketId: string) {
  const room = roomForSocket(socketId);
  if (!room) return { roomId: null as string | null, empty: false, remaining: [] as RoomMember[] };
  room.members.delete(socketId);
  socketIndex.delete(socketId);
  const remaining = [...room.members.values()];
  if (remaining.length === 0) rooms.delete(room.id);
  return { roomId: room.id, empty: remaining.length === 0, remaining };
}

export function validateChat(text: unknown, userId: string) {
  if (typeof text !== "string") return { ok: false as const, error: "invalid" };
  const trimmed = text.trim().slice(0, MAX_CHAT);
  if (!trimmed) return { ok: false as const, error: "empty" };
  if (!rateOk(lastChatAt, userId, CHAT_RATE_MS)) return { ok: false as const, error: "rate_limited" };
  return { ok: true as const, text: trimmed };
}

export function validateDraw(userId: string) {
  return rateOk(lastDrawAt, userId, DRAW_RATE_MS);
}

export function payloadSizeOk(payload: unknown, max = 250_000) {
  try {
    return JSON.stringify(payload).length <= max;
  } catch {
    return false;
  }
}

export function appendChat(room: CreativeRoom, msg: Omit<ChatMessage, "id" | "createdAt" | "roomId">) {
  const full: ChatMessage = {
    id: `msg_${Math.random().toString(36).slice(2, 10)}`,
    roomId: room.id,
    createdAt: now(),
    ...msg,
  };
  room.chat.push(full);
  if (room.chat.length > 100) room.chat.splice(0, room.chat.length - 100);
  return full;
}

export function snapshot(room: CreativeRoom) {
  return {
    id: room.id,
    solo: room.solo,
    members: [...room.members.values()].map((m) => ({ socketId: m.socketId, userId: m.userId, name: m.name })),
    chat: room.chat,
    shapes: [...room.shapes.values()],
  };
}

export function resetRoomsForTests() {
  queue.length = 0;
  rooms.clear();
  socketIndex.clear();
  lastChatAt.clear();
  lastDrawAt.clear();
  lastMatchAt.clear();
}

export const roomStats = () => ({ queue: queue.length, rooms: rooms.size });
