"""
AirDoodle Local Vision Agent — WebSocket Server
Connects webcam feed to browser canvas input pipeline via ws://localhost:8765.
Normalizes coordinates to the logical 1000x700 canvas space.
Applies EMA smoothing and temporal grace periods for stable hand tracking.

Camera Privacy & Explicit Permission:
- Camera is strictly OFF by default on server launch.
- Camera only opens when an authorized client sends {"action": "startCapture"}.
- Camera stops and hardware is released when client sends {"action": "stopCapture"}
  or when all authorized client sessions disconnect.
- Drawing requires a continuous 1.0-second pinch hold before stroke starts.
- Either physical hand can draw, detail-erase, or object-erase (one active hand).
- Brush width is taken from the idle open-finger span (or UI), never from the closed pinch.
"""

import sys
import os
import json
import asyncio
import argparse
import time
import math
import base64
from typing import Set, Dict, Optional, Tuple, Any

# Ensure AirDoodle root is in Python path for vision module imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import cv2
from vision.tracking.hand_tracker import HandTracker
from vision.gestures.pose_classifier import (
    classify_pose,
    idle_brush_width,
)

try:
    import websockets
except ImportError:
    print("[VisionAgent] Error: 'websockets' module required. Run: pip install websockets")
    sys.exit(1)

CANVAS_WIDTH = 1000.0
CANVAS_HEIGHT = 700.0
DEFAULT_PORT = 8765

connected_clients: Set = set()
authorized_capture_clients: Set = set()

# Global capture & tracking state
camera_state = "off"  # "off" | "starting" | "active" | "error" | "stopping"
cap: Optional[cv2.VideoCapture] = None
is_drawing = False
current_stroke = []
is_erasing = False
erase_kind = "detail"  # "detail" | "object"
frozen_stroke_width = 4
idle_stroke_width = 4
frozen_eraser_radius = 24

# Unified single-hand gesture state machine
# Either hand can perform every gesture.
# Modes: idle | waiting_draw | drawing | waiting_detail | detail | waiting_object | object
gesture_state = "idle"
hold_start_time: Optional[float] = None
HOLD_DURATION_REQUIRED = 1.0  # 1.0 second continuous hold

# Active hand tracking & locking
active_hand_id: Optional[str] = None  # "Right" | "Left"
locked_hand_preference: str = "auto"  # "auto" | "Right" | "Left"
current_operating_mode: str = "draw"   # "draw" | "music" | "recognize"

# Grace period for momentary tracking drops
HAND_LOST_GRACE = 5
no_hand_count = 0
last_known_point: Optional[Dict[str, float]] = None


# ── Coordinate Smoother (Adaptive EMA) ──
class CoordinateSmoother:
    """Smooths (x, y) coordinates with Adaptive EMA. Responsive to fast moves, smooth for fine stops."""
    def __init__(self, alpha_slow: float = 0.35, alpha_fast: float = 0.70):
        self.alpha_slow = alpha_slow
        self.alpha_fast = alpha_fast
        self.prev: Optional[Tuple[float, float]] = None

    def smooth(self, x: float, y: float) -> Tuple[float, float]:
        if self.prev is None:
            self.prev = (x, y)
            return (x, y)
        dx = x - self.prev[0]
        dy = y - self.prev[1]
        dist = math.hypot(dx, dy)
        # Adapt alpha: fast motion gets less lag; slow motion gets heavy smoothing
        alpha = self.alpha_fast if dist > 25.0 else self.alpha_slow
        sx = alpha * x + (1 - alpha) * self.prev[0]
        sy = alpha * y + (1 - alpha) * self.prev[1]
        self.prev = (sx, sy)
        return (sx, sy)

    def reset(self):
        self.prev = None


smoothers: Dict[str, CoordinateSmoother] = {
    "Right": CoordinateSmoother(alpha_slow=0.35, alpha_fast=0.70),
    "Left":  CoordinateSmoother(alpha_slow=0.35, alpha_fast=0.70),
}


async def broadcast(event: dict):
    if not connected_clients:
        return
    message = json.dumps(event)
    await asyncio.gather(
        *[client.send(message) for client in connected_clients],
        return_exceptions=True
    )


def open_camera() -> Tuple[Optional[cv2.VideoCapture], int, str]:
    """Tries opening the camera device index 0 or 1 with DirectShow or default backend."""
    for idx in [0, 1]:
        if sys.platform.startswith("win"):
            test_cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            if test_cap.isOpened():
                return test_cap, idx, "DSHOW"
            test_cap.release()
        test_cap = cv2.VideoCapture(idx)
        if test_cap.isOpened():
            return test_cap, idx, "DEFAULT"
        test_cap.release()
    return None, -1, "NONE"


async def start_capture_backend():
    """Opens webcam capture and transitions camera_state to active."""
    global cap, camera_state
    if camera_state == "active" and cap and cap.isOpened():
        return

    camera_state = "starting"
    print("[VisionAgent] User requested camera start. Initializing hardware...")
    await broadcast({"type": "cameraStatus", "state": "starting"})

    new_cap, opened_index, backend_name = open_camera()
    if not new_cap or not new_cap.isOpened():
        camera_state = "error"
        err_msg = "Could not open webcam device (devices 0 and 1 failed). Camera may be in use by another application or disconnected."
        print(f"[VisionAgent] Error: {err_msg}")
        await broadcast({"type": "cameraError", "message": err_msg})
        await broadcast({"type": "cameraStatus", "state": "error"})
        return

    new_cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    new_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap = new_cap
    camera_state = "active"
    print(f"[VisionAgent] Webcam opened successfully on device {opened_index} (Backend: {backend_name}).")
    await broadcast({
        "type": "cameraStatus",
        "state": "active",
        "opened": True,
        "deviceIndex": opened_index,
        "backend": backend_name,
    })


async def stop_capture_backend():
    """Releases webcam capture, resets drawing states, and sets camera_state to off."""
    global cap, camera_state, is_drawing, current_stroke, is_erasing
    global gesture_state, hold_start_time, active_hand_id
    global last_known_point, no_hand_count, erase_kind, idle_stroke_width

    if camera_state == "off" and cap is None:
        return

    camera_state = "stopping"
    print("[VisionAgent] Stopping camera capture and releasing hardware...")
    await broadcast({"type": "cameraStatus", "state": "stopping"})

    if cap:
        cap.release()
        cap = None

    if is_drawing:
        is_drawing = False
        end_pt = current_stroke[-1] if current_stroke else {"x": 500.0, "y": 350.0}
        await broadcast({"type": "penUp", "x": end_pt["x"], "y": end_pt["y"]})
        if len(current_stroke) >= 2:
            await broadcast({"type": "strokeFinished", "points": current_stroke, "strokeWidth": frozen_stroke_width})
        current_stroke = []

    is_erasing = False
    erase_kind = "detail"
    gesture_state = "idle"
    hold_start_time = None
    active_hand_id = None
    last_known_point = None
    no_hand_count = 0
    for s in smoothers.values():
        s.reset()

    await broadcast({"type": "handStatus", "handDetected": False, "action": "idle"})
    camera_state = "off"
    print("[VisionAgent] Webcam released. Camera is now OFF.")
    await broadcast({"type": "cameraStatus", "state": "off"})


async def handle_client_message(websocket, message_text: str, test_mode: bool = False):
    """Processes incoming control commands from the browser."""
    global authorized_capture_clients, locked_hand_preference, current_operating_mode
    try:
        data = json.loads(message_text)
    except Exception:
        return

    action = data.get("action")
    if action == "startCapture":
        authorized_capture_clients.add(websocket)
        print(f"[VisionAgent] Authorization granted for client (Active: {len(authorized_capture_clients)})")
        if not test_mode:
            await start_capture_backend()
        else:
            await broadcast({"type": "cameraStatus", "state": "active", "opened": True, "backend": "SIMULATION"})
    elif action == "stopCapture":
        authorized_capture_clients.discard(websocket)
        print(f"[VisionAgent] Client revoked capture (Remaining: {len(authorized_capture_clients)})")
        if len(authorized_capture_clients) == 0 and not test_mode:
            await stop_capture_backend()
    elif action == "lockHand":
        pref = data.get("hand", "auto")
        if pref in ["auto", "Right", "Left"]:
            locked_hand_preference = pref
            print(f"[VisionAgent] Hand preference set to: {locked_hand_preference}")
    elif action == "setMode":
        mode = data.get("mode", "draw")
        if mode in ["draw", "music", "recognize"]:
            current_operating_mode = mode
            print(f"[VisionAgent] Operating mode switched to: {current_operating_mode}")
    elif action == "status":
        await websocket.send(json.dumps({
            "type": "cameraStatus",
            "state": camera_state,
            "active": camera_state == "active",
            "lockedHand": locked_hand_preference,
            "mode": current_operating_mode,
        }))


async def register(websocket):
    global authorized_capture_clients
    connected_clients.add(websocket)
    print(f"[VisionAgent] Client connected: {websocket.remote_address} (Total: {len(connected_clients)})")
    try:
        # Handshake confirmation
        await websocket.send(json.dumps({
            "type": "agentStatus",
            "status": "ready",
            "cameraState": camera_state,
            "canvas": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT},
            "lockedHand": locked_hand_preference,
            "mode": current_operating_mode,
        }))

        async for message in websocket:
            await handle_client_message(websocket, message)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        authorized_capture_clients.discard(websocket)
        print(f"[VisionAgent] Client disconnected (Remaining: {len(connected_clients)})")
        # If no authorized client remains, release camera immediately
        if len(authorized_capture_clients) == 0 and camera_state == "active":
            await stop_capture_backend()


async def vision_loop(test_mode: bool = False):
    global is_drawing, current_stroke, is_erasing
    global gesture_state, hold_start_time, active_hand_id
    global frozen_stroke_width, frozen_eraser_radius, idle_stroke_width
    global last_known_point, no_hand_count, camera_state, cap
    global locked_hand_preference, current_operating_mode, erase_kind

    tracker = HandTracker(max_hands=2, detection_confidence=0.5, tracking_confidence=0.45)

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
                    "strokeWidth": 4,
                    "holdProgress": 1.0,
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
                    "strokeWidth": 2,
                    "holdProgress": 0.0,
                })

    # Live loop — Camera remains strictly OFF until explicit startCapture
    print("[VisionAgent] Ready in STANDBY mode. Camera is OFF until requested by client.")

    last_diag_time = time.time()
    last_preview_time = 0.0
    frames_captured = 0

    try:
        while True:
            # If camera is not active, sleep briefly and wait for client activation
            if camera_state != "active" or cap is None or not cap.isOpened():
                await asyncio.sleep(0.1)
                continue

            # Drain any buffered frames to get the latest (reduces latency on Windows)
            ret = False
            frame = None
            for _ in range(2):
                r, f = cap.read()
                if r:
                    ret, frame = r, f

            if not ret or frame is None:
                await asyncio.sleep(0.03)
                continue

            frames_captured += 1
            # Mirror horizontally for natural webcam selfie interaction
            frame = cv2.flip(frame, 1)
            h, w, _ = frame.shape
            now = time.time()

            # Stream downscaled camera preview (~10 fps) to connected browser clients
            if connected_clients and (now - last_preview_time >= 0.09):
                try:
                    small = cv2.resize(frame, (320, 240))
                    _, buf = cv2.imencode('.jpg', small, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
                    b64_str = base64.b64encode(buf).decode('ascii')
                    await broadcast({"type": "cameraPreview", "image": f"data:image/jpeg;base64,{b64_str}"})
                    last_preview_time = now
                except Exception:
                    pass

            hands = tracker.process(frame, draw=False)

            # Throttled diagnostics every 3.0 seconds
            if now - last_diag_time >= 3.0:
                fps = frames_captured / (now - last_diag_time)
                print(f"[VisionAgent Diagnostics] FPS: {fps:.1f} | Frame: {w}x{h} | Hands: {len(hands)} | "
                      f"State: {gesture_state} | Active Hand: {active_hand_id} | Mode: {current_operating_mode}")
                last_diag_time = now
                frames_captured = 0

            # ── No Hands Detected: Grace Period & Safe Reset ──
            if not hands:
                no_hand_count += 1
                if no_hand_count <= HAND_LOST_GRACE:
                    # Grace period: keep last position active without breaking strokes
                    if last_known_point and gesture_state == "drawing":
                        await broadcast({
                            "type": "cursorMoved",
                            "x": last_known_point["x"],
                            "y": last_known_point["y"],
                            "hand": active_hand_id or "Right",
                            "action": "drawing",
                            "strokeWidth": frozen_stroke_width,
                            "holdProgress": 1.0,
                        })
                    await asyncio.sleep(0.01)
                    continue

                # Grace period exceeded: hand genuinely lost
                if is_drawing:
                    is_drawing = False
                    end_pt = current_stroke[-1] if current_stroke else {"x": 500.0, "y": 350.0}
                    await broadcast({"type": "penUp", "x": end_pt["x"], "y": end_pt["y"]})
                    if len(current_stroke) >= 2:
                        await broadcast({"type": "strokeFinished", "points": current_stroke, "strokeWidth": frozen_stroke_width})
                    current_stroke = []

                is_erasing = False
                gesture_state = "idle"
                hold_start_time = None
                active_hand_id = None
                last_known_point = None
                for s in smoothers.values():
                    s.reset()
                await broadcast({"type": "handStatus", "handDetected": False, "action": "idle"})
                await asyncio.sleep(0.01)
                continue

            # Hand detected: reset grace counter
            no_hand_count = 0

            # ── Hand Classification & Handedness Assignment ──
            # MediaPipe on flipped selfie: "Left" label is physical Right, "Right" label is physical Left
            parsed_hands = []
            for h_idx, h_data in enumerate(hands):
                raw_label = h_data.get("handedness", "Right")
                score = h_data.get("score", 0.8)
                physical = "Right" if raw_label == "Left" else "Left"
                parsed_hands.append({
                    "hand_idx": h_idx,
                    "physical": physical,
                    "score": score,
                    "landmarks": h_data["landmarks"],
                })

            # One active hand. Lock identity only while an action is in progress.
            action_locked = gesture_state not in ("idle",)
            chosen_hand = None
            if len(parsed_hands) == 1:
                chosen_hand = parsed_hands[0]
            else:
                if action_locked and active_hand_id:
                    for h_cand in parsed_hands:
                        if h_cand["physical"] == active_hand_id:
                            chosen_hand = h_cand
                            break
                if not chosen_hand and locked_hand_preference != "auto":
                    for h_cand in parsed_hands:
                        if h_cand["physical"] == locked_hand_preference:
                            chosen_hand = h_cand
                            break
                if not chosen_hand:
                    chosen_hand = max(parsed_hands, key=lambda x: x["score"])

            if not chosen_hand or len(chosen_hand["landmarks"]) != 21:
                await asyncio.sleep(0.005)
                continue

            active_hand_id = chosen_hand["physical"]
            landmarks_list = chosen_hand["landmarks"]
            landmarks = {idx: (lx, ly) for idx, lx, ly in landmarks_list}

            # Essential landmarks: 0 (wrist), 4 (thumb), 8 (index), 9 (middle MCP), 12 (middle tip)
            if not all(k in landmarks for k in [0, 4, 8, 9, 12]):
                await asyncio.sleep(0.005)
                continue

            # ── 1. Index Fingertip Cursor Mapping & Adaptive EMA Smoothing ──
            ix, iy = landmarks[8]
            raw_x = (ix / float(w)) * CANVAS_WIDTH
            raw_y = (iy / float(h)) * CANVAS_HEIGHT

            smoother = smoothers.get(active_hand_id, smoothers["Right"])
            smooth_x, smooth_y = smoother.smooth(raw_x, raw_y)
            norm_x = max(0.0, min(CANVAS_WIDTH, smooth_x))
            norm_y = max(0.0, min(CANVAS_HEIGHT, smooth_y))
            point = {"x": round(norm_x, 1), "y": round(norm_y, 1)}
            last_known_point = point

            # ── 2. Palm Scale & Normalized Distances ──
            palm_scale = math.hypot(landmarks[9][0] - landmarks[0][0], landmarks[9][1] - landmarks[0][1])
            if palm_scale < 10.0:
                palm_scale = 100.0

            thumb_tip = landmarks[4]
            index_tip = landmarks[8]
            middle_tip = landmarks[12]

            if gesture_state == "idle":
                idle_stroke_width = idle_brush_width(landmarks, idle_stroke_width)

            pose_active = None
            if gesture_state in ("waiting_draw", "drawing"):
                pose_active = "drawing"
            elif gesture_state in ("waiting_detail", "detail"):
                pose_active = "detail"
            elif gesture_state in ("waiting_object", "object"):
                pose_active = "object"
            pose = classify_pose(landmarks, pose_active)

            # Multi-finger landmark data for Air Music mode
            fingers_payload = None
            if 16 in landmarks and 20 in landmarks:
                fingers_payload = {
                    "thumb": {"x": round((thumb_tip[0] / float(w)) * CANVAS_WIDTH, 1), "y": round((thumb_tip[1] / float(h)) * CANVAS_HEIGHT, 1)},
                    "index": {"x": round((index_tip[0] / float(w)) * CANVAS_WIDTH, 1), "y": round((index_tip[1] / float(h)) * CANVAS_HEIGHT, 1)},
                    "middle": {"x": round((middle_tip[0] / float(w)) * CANVAS_WIDTH, 1), "y": round((middle_tip[1] / float(h)) * CANVAS_HEIGHT, 1)},
                    "ring": {"x": round((landmarks[16][0] / float(w)) * CANVAS_WIDTH, 1), "y": round((landmarks[16][1] / float(h)) * CANVAS_HEIGHT, 1)},
                    "pinky": {"x": round((landmarks[20][0] / float(w)) * CANVAS_WIDTH, 1), "y": round((landmarks[20][1] / float(h)) * CANVAS_HEIGHT, 1)},
                }

            # ── 3. Air Music Mode Handling (Suspends Drawing & Erasing) ──
            if current_operating_mode == "music":
                # In music mode, drawing and erasing are suspended
                if is_drawing:
                    is_drawing = False
                    await broadcast({"type": "penUp", "x": point["x"], "y": point["y"]})
                    current_stroke = []
                is_erasing = False
                gesture_state = "idle"
                hold_start_time = None

                await broadcast({
                    "type": "cursorMoved",
                    "x": point["x"],
                    "y": point["y"],
                    "hand": active_hand_id,
                    "action": "music",
                    "fingers": fingers_payload,
                    "palmScale": round(palm_scale, 1),
                })
                await asyncio.sleep(0.005)
                continue

            # ── 4. Unified Single-Hand Gesture State Machine ──
            # pinch -> draw; index-middle cross -> detail erase; fist -> object erase
            if gesture_state == "idle":
                if pose == "pinch":
                    gesture_state = "waiting_draw"
                    hold_start_time = now
                    frozen_stroke_width = idle_stroke_width
                elif pose == "cross":
                    gesture_state = "waiting_detail"
                    hold_start_time = now
                    erase_kind = "detail"
                elif pose == "fist":
                    gesture_state = "waiting_object"
                    hold_start_time = now
                    erase_kind = "object"

            async def emit_cursor(action: str, **extra):
                payload = {
                    "type": "cursorMoved",
                    "x": point["x"],
                    "y": point["y"],
                    "hand": active_hand_id,
                    "action": action,
                    "strokeWidth": frozen_stroke_width if action == "drawing" else idle_stroke_width,
                    "holdProgress": extra.pop("holdProgress", 0.0),
                    "holdDuration": HOLD_DURATION_REQUIRED,
                    "fingers": fingers_payload,
                    "visibleHands": [h["physical"] for h in parsed_hands],
                }
                payload.update(extra)
                await broadcast(payload)

            if gesture_state == "waiting_draw":
                if pose != "pinch":
                    gesture_state = "idle"
                    hold_start_time = None
                    await emit_cursor("idle")
                else:
                    elapsed = now - (hold_start_time or now)
                    hold_progress = min(1.0, elapsed / HOLD_DURATION_REQUIRED)
                    if elapsed >= HOLD_DURATION_REQUIRED:
                        gesture_state = "drawing"
                        is_drawing = True
                        current_stroke = [point]
                        await broadcast({"type": "penDown", "x": point["x"], "y": point["y"], "strokeWidth": frozen_stroke_width})
                        await emit_cursor("drawing", holdProgress=1.0)
                    else:
                        await emit_cursor("waiting", mode="draw", holdProgress=hold_progress)

            elif gesture_state == "drawing":
                if pose != "pinch":
                    gesture_state = "idle"
                    is_drawing = False
                    hold_start_time = None
                    await broadcast({"type": "penUp", "x": point["x"], "y": point["y"]})
                    if len(current_stroke) >= 2:
                        await broadcast({"type": "strokeFinished", "points": current_stroke, "strokeWidth": frozen_stroke_width})
                    current_stroke = []
                    await emit_cursor("idle")
                else:
                    current_stroke.append(point)
                    await emit_cursor("drawing", holdProgress=1.0)

            elif gesture_state in ("waiting_detail", "waiting_object"):
                needed = "cross" if gesture_state == "waiting_detail" else "fist"
                wait_mode = "detail" if gesture_state == "waiting_detail" else "object"
                wait_action = "waiting"
                if pose != needed:
                    gesture_state = "idle"
                    hold_start_time = None
                    await emit_cursor("idle")
                else:
                    elapsed = now - (hold_start_time or now)
                    hold_progress = min(1.0, elapsed / HOLD_DURATION_REQUIRED)
                    if elapsed >= HOLD_DURATION_REQUIRED:
                        gesture_state = wait_mode
                        is_erasing = True
                        erase_kind = wait_mode
                        await broadcast({
                            "type": "eraseAt",
                            "x": point["x"],
                            "y": point["y"],
                            "mode": wait_mode,
                        })
                        await emit_cursor(
                            "detail_erasing" if wait_mode == "detail" else "object_erasing",
                            mode=wait_mode,
                            holdProgress=1.0,
                        )
                    else:
                        await emit_cursor(wait_action, mode=wait_mode, holdProgress=hold_progress)

            elif gesture_state in ("detail", "object"):
                needed = "cross" if gesture_state == "detail" else "fist"
                action_name = "detail_erasing" if gesture_state == "detail" else "object_erasing"
                if pose != needed:
                    gesture_state = "idle"
                    is_erasing = False
                    hold_start_time = None
                    await emit_cursor("idle")
                else:
                    await broadcast({
                        "type": "eraseAt",
                        "x": point["x"],
                        "y": point["y"],
                        "mode": gesture_state,
                    })
                    await emit_cursor(action_name, mode=gesture_state, holdProgress=1.0)

            elif gesture_state == "idle":
                await emit_cursor("idle")

            await asyncio.sleep(0.005)


    finally:
        if cap:
            cap.release()
            cap = None
        print("[VisionAgent] Vision loop finished. Hardware released.")


async def main():
    parser = argparse.ArgumentParser(description="AirDoodle Local Vision WebSocket Server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to serve WebSocket on (default: 8765)")
    parser.add_argument("--test", "--test-mode", dest="test", action="store_true", help="Run with simulated gesture input")
    args = parser.parse_args()

    print(f"==================================================")
    print(f"  AirDoodle Vision Agent WebSocket Server")
    print(f"  Listening on: ws://localhost:{args.port}")
    print(f"  Canvas Map:   {CANVAS_WIDTH} x {CANVAS_HEIGHT}")
    print(f"  Privacy:      Camera OFF by default (Explicit Start Required)")
    print(f"==================================================")

    async with websockets.serve(register, "localhost", args.port):
        await vision_loop(test_mode=args.test)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[VisionAgent] Server stopped cleanly.")
