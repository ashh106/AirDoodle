import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VisionAgentClient } from "./vision.service";

describe("VisionAgentClient Lifecycle & Privacy", () => {
  let client: VisionAgentClient;
  let mockSocket: any;
  let sentMessages: string[] = [];

  beforeEach(() => {
    sentMessages = [];
    mockSocket = {
      readyState: 1, // WebSocket.OPEN
      send: vi.fn((data: string) => sentMessages.push(data)),
      close: vi.fn(),
    };

    const MockWebSocket: any = vi.fn().mockImplementation(() => mockSocket);
    MockWebSocket.OPEN = 1;
    (global as any).WebSocket = MockWebSocket;
    client = new VisionAgentClient("ws://localhost:8765");
  });

  afterEach(() => {
    client.disconnect();
    vi.restoreAllMocks();
  });

  it("initializes with cameraState 'off' by default", () => {
    expect(client.cameraState).toBe("off");
  });

  it("sends startCapture message only upon explicit startCapture invocation", () => {
    client.connect(() => {});
    // Simulate socket onopen
    mockSocket.onopen?.();

    expect(sentMessages).toEqual([]); // Did NOT start capture automatically
    expect(client.cameraState).toBe("off");

    // Explicit user permission action
    client.startCapture();
    expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify({ action: "startCapture" }));
    expect(client.cameraState).toBe("starting");
  });

  it("sends stopCapture message and transitions state to off on stopCapture", () => {
    client.connect(() => {});
    mockSocket.onopen?.();
    client.startCapture();

    client.stopCapture();
    expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify({ action: "stopCapture" }));
    expect(client.cameraState).toBe("off");
  });

  it("disconnect closes socket and stops capture cleanly", () => {
    client.connect(() => {});
    mockSocket.onopen?.();
    client.startCapture();

    client.disconnect();
    expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify({ action: "stopCapture" }));
    expect(mockSocket.close).toHaveBeenCalled();
    expect(client.cameraState).toBe("off");
  });

  it("updates cameraState when cameraStatus message is received", () => {
    let latestStatus: any = null;
    client.connect(() => {}, (status) => {
      latestStatus = status;
    });
    mockSocket.onopen?.();

    // Simulate backend cameraStatus event
    mockSocket.onmessage?.({
      data: JSON.stringify({
        type: "cameraStatus",
        state: "active",
        opened: true,
      }),
    });

    expect(client.cameraState).toBe("active");
    expect(latestStatus?.cameraState).toBe("active");
  });
});
