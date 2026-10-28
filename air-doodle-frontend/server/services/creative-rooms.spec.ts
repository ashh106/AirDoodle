import { describe, expect, it, beforeEach } from "vitest";
import {
  appendChat,
  createAndJoin,
  enqueueMatch,
  isMember,
  joinRoom,
  leaveQueue,
  leaveRoom,
  resetRoomsForTests,
  validateChat,
} from "./creative-rooms";

describe("Creative Rooms matchmaking and isolation", () => {
  beforeEach(() => resetRoomsForTests());

  it("keeps a single waiting user in the queue without fabricating a partner", () => {
    const first = enqueueMatch("u1", "s1", "Ada");
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.state).toBe("searching");
    expect("roomId" in first && first.roomId).toBeFalsy();
  });

  it("matches two distinct users into one isolated room", () => {
    enqueueMatch("u1", "s1", "Ada");
    const second = enqueueMatch("u2", "s2", "Lin");
    expect(second.ok).toBe(true);
    if (!second.ok || !("roomId" in second)) throw new Error("expected match");
    expect(second.state).toBe("matched");
    expect(second.members).toHaveLength(2);
    expect(isMember("s1", second.roomId!)).toBe(true);
    expect(isMember("s2", second.roomId!)).toBe(true);
  });

  it("rejects duplicate queue occupancy after a match and cleans up on leave", () => {
    enqueueMatch("u1", "s1", "Ada");
    const matched = enqueueMatch("u2", "s2", "Lin");
    if (!matched.ok || !("roomId" in matched) || !matched.roomId) throw new Error("expected match");
    const again = enqueueMatch("u1", "s1", "Ada");
    expect(again.ok).toBe(false);
    const left = leaveRoom("s1");
    expect(left.roomId).toBe(matched.roomId);
    expect(left.remaining).toHaveLength(1);
    leaveRoom("s2");
    expect(isMember("s2", matched.roomId)).toBe(false);
  });

  it("validates chat and does not interpret HTML", () => {
    expect(validateChat("", "u1").ok).toBe(false);
    const ok = validateChat("  hello <script>  ", "u1");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.text).toBe("hello <script>");
    const room = createAndJoin({ socketId: "s1", userId: "u1", name: "Ada" }, true);
    const msg = appendChat(room, { userId: "u1", name: "Ada", text: ok.ok ? ok.text : "" });
    expect(msg.text).toContain("<script>");
  });

  it("isolates rooms so joiners cannot enter a missing room", () => {
    leaveQueue("nobody");
    const missing = joinRoom("room_missing", { socketId: "s9", userId: "u9", name: "X" });
    expect(missing.ok).toBe(false);
  });
});
