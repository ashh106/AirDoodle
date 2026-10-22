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

    tracker = HandTracker(max_hands=1, detection_confidence=0.6, tracking_confidence=0.6)
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
                await broadcast({"type": "penDown", "x": pt["x"], "y": pt["y"]})
            elif is_drawing:
                current_stroke.append(pt)
                await broadcast({
                    "type": "cursorMoved",
                    "x": pt["x"],
                    "y": pt["y"],
                    "hand": "Right",
                    "action": "drawing"
                })
                if step % 100 == 90:
                    is_drawing = False
                    await broadcast({"type": "penUp", "x": pt["x"], "y": pt["y"]})
                    if len(current_stroke) >= 2:
                        await broadcast({"type": "strokeFinished", "points": current_stroke})
                    current_stroke = []
            else:
                await broadcast({
                    "type": "cursorMoved",
                    "x": pt["x"],
                    "y": pt["y"],
                    "hand": "Right",
                    "action": "idle"
                })


    # Live Webcam mode
    print("[VisionAgent] Opening local webcam device...")
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[VisionAgent] Warning: Could not open webcam device 0. Falling back to idle standby.")
        while True:
            await asyncio.sleep(1.0)

    # Hand gesture state tracking
    # Right hand: pinch held for ~0.8s (deliberate trigger) then draw until released
    # Left hand: pinch held for ~0.8s then erase
    right_pinch_frames = 0
    left_pinch_frames = 0
    PINCH_TRIGGER_FRAMES = 12  # approx 0.4-0.6s at 25-30fps
    is_erasing = False

    try:
        while True:
            await asyncio.sleep(0.01)

            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.05)
                continue

            h, w, _ = frame.shape
            hands = tracker.process(frame, draw=False)

            if not hands:
                if is_drawing:
                    is_drawing = False
                    await broadcast({"type": "penUp", "x": current_stroke[-1]["x"] if current_stroke else 500, "y": current_stroke[-1]["y"] if current_stroke else 350})
                    if len(current_stroke) >= 2:
                        await broadcast({"type": "strokeFinished", "points": current_stroke})
                    current_stroke = []
                if is_erasing:
                    is_erasing = False
                right_pinch_frames = 0
                left_pinch_frames = 0
                await broadcast({"type": "handStatus", "handDetected": False, "action": "idle"})
                continue

            # Prioritize first tracked hand or process primary
            hand = hands[0]
            handedness = hand.get("handedness", "Right")  # "Left" or "Right"
            landmarks = {idx: (x, y) for idx, x, y in hand["landmarks"]}

            if 8 not in landmarks or 4 not in landmarks:
                continue

            ix, iy = landmarks[8]

            # In mirrored view (selfie/webcam feed), MediaPipe classifies user's real right hand as "Left" or "Right"
            # We mirror x for natural screen canvas mapping (moving finger right moves cursor right)
            norm_x = (1.0 - (ix / float(w))) * CANVAS_WIDTH
            norm_y = (iy / float(h)) * CANVAS_HEIGHT
            norm_x = max(0.0, min(CANVAS_WIDTH, norm_x))
            norm_y = max(0.0, min(CANVAS_HEIGHT, norm_y))
            point = {"x": round(norm_x, 1), "y": round(norm_y, 1)}

            # Distance between thumb tip (4) and index tip (8)
            pinch_dist = recognizer.distance(landmarks[4], landmarks[8])
            is_pinched = pinch_dist < 42.0

            action = "idle"

            # Determine whether hand is Right (drawing) or Left (erasing)
            # Note: in webcam mirror, classification may be opposite, user can use either hand
            if handedness == "Left":
                # Left Hand: Erase mode with deliberate hold
                if is_pinched:
                    left_pinch_frames += 1
                    if left_pinch_frames >= PINCH_TRIGGER_FRAMES:
                        action = "erasing"
                        is_erasing = True
                        await broadcast({"type": "eraseAt", "x": point["x"], "y": point["y"], "radius": 24})
                    else:
                        action = "waiting"
                else:
                    left_pinch_frames = max(0, left_pinch_frames - 2)
                    is_erasing = False

                await broadcast({
                    "type": "cursorMoved",
                    "x": point["x"],
                    "y": point["y"],
                    "hand": "Left",
                    "action": action
                })
            else:
                # Right Hand: Draw mode with deliberate hold
                if is_pinched:
                    right_pinch_frames += 1
                    if right_pinch_frames >= PINCH_TRIGGER_FRAMES:
                        action = "drawing"
                        if not is_drawing:
                            is_drawing = True
                            current_stroke = [point]
                            await broadcast({"type": "penDown", "x": point["x"], "y": point["y"]})
                        else:
                            current_stroke.append(point)
                    else:
                        action = "waiting"
                else:
                    right_pinch_frames = max(0, right_pinch_frames - 2)
                    if is_drawing:
                        is_drawing = False
                        await broadcast({"type": "penUp", "x": point["x"], "y": point["y"]})
                        if len(current_stroke) >= 2:
                            await broadcast({"type": "strokeFinished", "points": current_stroke})
                        current_stroke = []

                await broadcast({
                    "type": "cursorMoved",
                    "x": point["x"],
                    "y": point["y"],
                    "hand": "Right",
                    "action": action
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
