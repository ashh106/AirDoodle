"""
AirDoodle Local Vision Agent — WebSocket Server
Connects webcam feed to browser canvas input pipeline via ws://localhost:8765.
Normalizes coordinates to the logical 1000x700 canvas space.
"""

import sys
import os
import json
import asyncio
import argparse
import time
import math
from typing import Set

# Ensure AirDoodle root is in Python path for vision module imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import cv2
from vision.tracking.hand_tracker import HandTracker
from vision.gestures.gesture_recognizer import GestureRecognizer

try:
    import websockets
except ImportError:
    print("[VisionAgent] Error: 'websockets' module required. Run: pip install websockets")
    sys.exit(1)

CANVAS_WIDTH = 1000.0
CANVAS_HEIGHT = 700.0
DEFAULT_PORT = 8765

connected_clients: Set = set()
is_drawing = False
current_stroke = []

async def register(websocket):
    connected_clients.add(websocket)
    print(f"[VisionAgent] Client connected: {websocket.remote_address} (Total: {len(connected_clients)})")
    try:
        # Send handshake confirmation
        await websocket.send(json.dumps({
            "type": "agentStatus",
            "status": "ready",
            "canvas": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT}
        }))
        async for message in websocket:
            pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        print(f"[VisionAgent] Client disconnected (Remaining: {len(connected_clients)})")


async def broadcast(event: dict):
    if not connected_clients:
        return
    message = json.dumps(event)
    await asyncio.gather(
        *[client.send(message) for client in connected_clients],
        return_exceptions=True
    )

async def vision_loop(test_mode: bool = False):
    global is_drawing, current_stroke

    tracker = HandTracker(max_hands=2, detection_confidence=0.6, tracking_confidence=0.6)
    recognizer = GestureRecognizer()

    if test_mode:
        print("[VisionAgent] Running in TEST / SIMULATION mode.")
        step = 0
        while True:
            await asyncio.sleep(0.05)
            if not connected_clients:
                continue

            # Simulate a circular drawing motion
            angle = (step % 100) * (2 * math.pi / 100.0)
            cx = 500.0 + 150.0 * math.cos(angle)
            cy = 350.0 + 150.0 * math.sin(angle)
            step += 1

            pt = {"x": round(cx, 1), "y": round(cy, 1)}

            if step % 100 == 10:
                is_drawing = True
                current_stroke = [pt]
                await broadcast({"type": "penDown", "x": pt["x"], "y": pt["y"], "strokeWidth": 4})
            elif is_drawing:
                current_stroke.append(pt)
                await broadcast({
                    "type": "cursorMoved",
                    "x": pt["x"],
                    "y": pt["y"],
                    "hand": "Right",
                    "action": "drawing",
                    "strokeWidth": 4
                })
                if step % 100 == 90:
                    is_drawing = False
                    await broadcast({"type": "penUp", "x": pt["x"], "y": pt["y"]})
                    if len(current_stroke) >= 2:
                        await broadcast({"type": "strokeFinished", "points": current_stroke, "strokeWidth": 4})
                    current_stroke = []
            else:
                await broadcast({
                    "type": "cursorMoved",
                    "x": pt["x"],
                    "y": pt["y"],
                    "hand": "Right",
                    "action": "idle",
                    "strokeWidth": 2
                })

    # Live Webcam mode
    print("[VisionAgent] Opening local webcam device...")
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[VisionAgent] Warning: Could not open webcam device 0. Falling back to idle standby.")
        while True:
            await asyncio.sleep(1.0)

    # State tracking per hand
    right_hold_frames = 0
    left_hold_frames = 0
    right_exit_frames = 0
    left_exit_frames = 0
    HOLD_TRIGGER_FRAMES = 18  # approx 0.6-0.8s at 25-30fps
    is_erasing = False

    # Diagnostics state
    last_diag_time = time.time()
    frames_captured = 0
    events_sent = 0
    last_hands_count = 0

    try:
        while True:
            await asyncio.sleep(0.01)

            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.05)
                continue

            frames_captured += 1
            # Mirror horizontally for natural webcam selfie interaction
            frame = cv2.flip(frame, 1)
            h, w, _ = frame.shape

            hands = tracker.process(frame, draw=False)
            now = time.time()

            # Throttled diagnostics every 3.0 seconds
            if now - last_diag_time >= 3.0:
                fps = frames_captured / (now - last_diag_time)
                print(f"[VisionAgent Diagnostics] FPS: {fps:.1f} | Frame: {w}x{h} | Hands Detected: {len(hands)} | "
                      f"Drawing: {is_drawing} | Erasing: {is_erasing} | Clients: {len(connected_clients)}")
                last_diag_time = now
                frames_captured = 0

            if not hands:
                if is_drawing:
                    is_drawing = False
                    end_pt = current_stroke[-1] if current_stroke else {"x": 500.0, "y": 350.0}
                    await broadcast({"type": "penUp", "x": end_pt["x"], "y": end_pt["y"]})
                    if len(current_stroke) >= 2:
                        await broadcast({"type": "strokeFinished", "points": current_stroke, "strokeWidth": 2})
                    current_stroke = []
                if is_erasing:
                    is_erasing = False
                right_hold_frames = 0
                left_hold_frames = 0
                right_exit_frames = 0
                left_exit_frames = 0
                await broadcast({"type": "handStatus", "handDetected": False, "action": "idle"})
                continue

            # Process detected hands
            for hand in hands:
                landmarks_list = hand["landmarks"]
                if len(landmarks_list) != 21:
                    continue

                landmarks = {idx: (lx, ly) for idx, lx, ly in landmarks_list}
                if 8 not in landmarks or 4 not in landmarks or 0 not in landmarks:
                    continue

                # In mirrored view, MediaPipe's 'Left' label corresponds to the user's physical Right hand
                raw_label = hand.get("handedness", "Right")
                physical_hand = "Right" if raw_label == "Left" else "Left"

                # Landmark 8: Index fingertip
                ix, iy = landmarks[8]

                # Map directly to 1000x700 canvas space (already flipped horizontally)
                norm_x = (ix / float(w)) * CANVAS_WIDTH
                norm_y = (iy / float(h)) * CANVAS_HEIGHT
                norm_x = max(0.0, min(CANVAS_WIDTH, norm_x))
                norm_y = max(0.0, min(CANVAS_HEIGHT, norm_y))
                point = {"x": round(norm_x, 1), "y": round(norm_y, 1)}

                # Palm scale calibration (wrist [0] to middle finger MCP [9])
                palm_scale = math.hypot(landmarks[9][0] - landmarks[0][0], landmarks[9][1] - landmarks[0][1])
                if palm_scale < 10.0:
                    palm_scale = 100.0

                # Calibrated thumb-to-index distance
                thumb_tip = landmarks[4]
                index_tip = landmarks[8]
                raw_dist = math.hypot(index_tip[0] - thumb_tip[0], index_tip[1] - thumb_tip[1])
                norm_dist = raw_dist / palm_scale

                # Pinch is detected when fingertips are close relative to palm size
                is_pinched = norm_dist < 0.28
                is_wide_open = norm_dist > 0.58

                if physical_hand == "Right":
                    # Right hand = Drawing mode
                    if is_pinched:
                        right_exit_frames = 0
                        right_hold_frames += 1
                        if right_hold_frames >= HOLD_TRIGGER_FRAMES:
                            action = "drawing"
                            # Dynamic stroke width from finger separation (range 2 to 20 px)
                            stroke_width = max(2, min(24, int(2 + (norm_dist - 0.12) * 50)))
                            if not is_drawing:
                                is_drawing = True
                                current_stroke = [point]
                                await broadcast({"type": "penDown", "x": point["x"], "y": point["y"], "strokeWidth": stroke_width})
                            else:
                                current_stroke.append(point)
                        else:
                            action = "waiting"
                            stroke_width = 2
                    else:
                        if is_drawing:
                            if is_wide_open:
                                right_exit_frames += 1
                                if right_exit_frames >= 4:
                                    is_drawing = False
                                    action = "idle"
                                    await broadcast({"type": "penUp", "x": point["x"], "y": point["y"]})
                                    if len(current_stroke) >= 2:
                                        await broadcast({"type": "strokeFinished", "points": current_stroke, "strokeWidth": 2})
                                    current_stroke = []
                                    right_hold_frames = 0
                                else:
                                    # Continue stroke with dynamic width
                                    action = "drawing"
                                    stroke_width = max(2, min(24, int(2 + (norm_dist - 0.12) * 50)))
                                    current_stroke.append(point)
                            else:
                                right_exit_frames = 0
                                action = "drawing"
                                stroke_width = max(2, min(24, int(2 + (norm_dist - 0.12) * 50)))
                                current_stroke.append(point)
                        else:
                            right_hold_frames = max(0, right_hold_frames - 2)
                            action = "idle"
                            stroke_width = max(2, min(24, int(2 + (norm_dist - 0.12) * 50)))

                    await broadcast({
                        "type": "cursorMoved",
                        "x": point["x"],
                        "y": point["y"],
                        "hand": "Right",
                        "action": action,
                        "strokeWidth": stroke_width
                    })

                else:
                    # Left hand = Erasing mode
                    eraser_radius = max(10, min(60, int(14 + (norm_dist - 0.12) * 75)))

                    if is_pinched:
                        left_exit_frames = 0
                        left_hold_frames += 1
                        if left_hold_frames >= HOLD_TRIGGER_FRAMES:
                            action = "erasing"
                            is_erasing = True
                            await broadcast({
                                "type": "eraseAt",
                                "x": point["x"],
                                "y": point["y"],
                                "radius": eraser_radius
                            })
                        else:
                            action = "waiting"
                    else:
                        if is_erasing:
                            if is_wide_open:
                                left_exit_frames += 1
                                if left_exit_frames >= 4:
                                    is_erasing = False
                                    action = "idle"
                                    left_hold_frames = 0
                                else:
                                    action = "erasing"
                                    await broadcast({
                                        "type": "eraseAt",
                                        "x": point["x"],
                                        "y": point["y"],
                                        "radius": eraser_radius
                                    })
                            else:
                                left_exit_frames = 0
                                action = "erasing"
                                await broadcast({
                                    "type": "eraseAt",
                                    "x": point["x"],
                                    "y": point["y"],
                                    "radius": eraser_radius
                                })
                        else:
                            left_hold_frames = max(0, left_hold_frames - 2)
                            action = "idle"

                    await broadcast({
                        "type": "cursorMoved",
                        "x": point["x"],
                        "y": point["y"],
                        "hand": "Left",
                        "action": action,
                        "radius": eraser_radius
                    })

    finally:
        cap.release()

async def main():
    parser = argparse.ArgumentParser(description="AirDoodle Local Vision WebSocket Server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to serve WebSocket on (default: 8765)")
    parser.add_argument("--test", "--test-mode", dest="test", action="store_true", help="Run with simulated gesture input")
    args = parser.parse_args()

    print(f"==================================================")
    print(f"  AirDoodle Vision Agent WebSocket Server")
    print(f"  Listening on: ws://localhost:{args.port}")
    print(f"  Canvas Map:   {CANVAS_WIDTH} x {CANVAS_HEIGHT}")
    print(f"==================================================")

    async with websockets.serve(register, "localhost", args.port):
        await vision_loop(test_mode=args.test)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[VisionAgent] Server stopped cleanly.")
