# AirDoodle — Hand Tracking Fix Progress & Verification Record

## 1. Root Causes Identified & Applied Resolutions

### RC-1: Stale Closure in Event Processing (Resolved)
- **Problem**: `Project.tsx` connected to the vision WebSocket inside a `useEffect([isCameraTracking])`. The callback captured the initial component state, causing stale references to `shapes`, active tools, and eraser modes.
- **Fix Applied**: Routed all WebSocket input events through `handleInputEventRef.current?.(event)`. Every event always accesses the latest React state without triggering socket reconnects.

### RC-2: Coordinate Jitter & Missing Smoothing (Resolved)
- **Problem**: MediaPipe landmark detection had natural high-frequency jitter, making hand-drawn vector paths shaky and erratic.
- **Fix Applied**: Implemented `CoordinateSmoother` using Adaptive Exponential Moving Average (EMA). Fine/slow movements use heavy smoothing ($\alpha = 0.35$), while rapid movements adaptively increase responsiveness ($\alpha = 0.70$) to prevent lag. Separate smoother instances for Right and Left hands with automatic state reset on hand loss.

### RC-3: Camera Privacy & Missing Explicit Permission Control (Resolved)
- **Problem**: Launching the Python vision server or opening the website was immediately and silently opening the webcam hardware (`cv2.VideoCapture`).
- **Fix Applied**:
  - The webcam hardware is **strictly OFF by default** upon launching `agent_server.py`.
  - The browser must explicitly send `{"action": "startCapture"}` when the user clicks **"Allow Camera / Start Tracking"**.
  - Clicking **"Stop Camera"** immediately sends `{"action": "stopCapture"}`, calls `cap.release()`, stops frame acquisition, clears on-canvas cursors, and transitions state to `Camera Off`.
  - Closing or unmounting `Project.tsx`, logging out in `auth.service.ts`, or closing browser sessions automatically releases the camera hardware.
  - Reconnecting the WebSocket transport never silently reactivates camera capture.

### RC-4: Strict Hand Responsibilities & Mirroring Verification (Resolved)
- **Problem**: Inverted handedness in mirrored camera frames could cause left-hand actions to trigger drawing or right-hand gestures to trigger erasing.
- **Fix Applied**:
  - Verified MediaPipe's inverted handedness classification on horizontally flipped frames (`cv2.flip(frame, 1)`): in mirrored selfie view, MediaPipe's "Left" label corresponds to the user's physical **Right** hand.
  - Implemented spatial identity sorting based on wrist X-coordinates to maintain stable identities across frames and avoid hand swapping.
  - **Strict role separation**:
    - **Right hand**: Controls index fingertip pointer, brush sizing, and 1.0s pinch to draw. Never initiates erasing.
    - **Left hand**: Controls eraser pointer, eraser radius, and 1.0s pinch to erase. Never initiates drawing strokes.

### RC-5: 1.0-Second Continuous Activation Hold & Intentional Release (Resolved)
- **Problem**: Quick pinches or noisy frames triggered accidental strokes; drawing thickness changed mid-stroke when fingers moved.
- **Fix Applied**:
  - Implemented a debounced state machine requiring a continuous **1,000 milliseconds (1.0s)** pinch hold before `penDown` triggers.
  - Releasing or opening the pinch before 1.0s immediately resets the activation timer without creating a stroke.
  - During the 1.0s hold, broadcasts `action: "waiting"` with `holdProgress: 0.0 - 1.0`. Canvas and panel render an SVG circular countdown ring and live progress bar.
  - When drawing begins, stroke width is **frozen** for the duration of the stroke.
  - Upon pinch release, the stroke finalizes cleanly (`penUp`, `strokeFinished`) at the last valid fingertip coordinate. The next stroke requires another uninterrupted 1.0s hold.

### RC-6: High-Contrast Master Hand Pointer & Zero Gesture Zoom (Resolved)
- **Problem**: Pointer was low contrast; gesture finger-spreading risked conflicting with canvas zooming.
- **Fix Applied**:
  - Rendered a distinctive, high-contrast master hand pointer centered on the index fingertip on `<Canvas>` (dual-ring with pinpoint center, high-visibility badges: `Move Pointer`, `Hold to Draw — 1.0s`, `Drawing`, `Erasing`).
  - Completely removed/prevented any gesture-driven camera or canvas zooming. Spreading fingers strictly adjusts brush width (Right hand: 2–24px) or eraser radius (Left hand: 10–60px) while idle.

---

## 2. Phase Execution Plan

- [x] Phase A: Detection stability & camera hardware abstraction (`vision/agent_server.py`, `hand_tracker.py`)
- [x] Phase B: Explicit camera permission & lifecycle state machine (`vision.service.ts`, `CameraTrackingPanel.tsx`)
- [x] Phase C: Stale closure resolution & real-time live stroke polyline (`Project.tsx`, `Canvas.tsx`)
- [x] Phase D: Strict Left/Right hand responsibility & 1.0s activation hold with progress ring (`agent_server.py`, `Canvas.tsx`)
- [x] Phase E: Native C++ geometric engine recognition bridge (`cpp-engine`, `geometry-engine.ts`, `recognizer.ts`)
- [x] Phase F: Comprehensive test suite verification & documentation update

---

## 3. Full Test Verification Matrix

| Test Suite | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Python Unit Tests** | `python -m unittest discover -s tests -v` | **PASS (6/6)** | Handshake, normalized events, gesture recognition, explicit camera privacy/permission control, hand locking and mode switching |
| **Frontend Typecheck** | `npm run typecheck` | **PASS (Exit 0)** | 0 TypeScript errors across client, server, and shared contracts |
| **Frontend Unit Tests** | `npm test` | **PASS (46/46)** | 9 test suites passing: `vision.service`, `recognizer`, `shapeReducer`, `eraserGeometry`, `export`, `utils`, `geometry-engine`, `viewport`, `creative-rooms` |
| **Frontend Production Build** | `npm run build` | **PASS (Exit 0)** | Vite SPA (`dist/spa`) and SSR server (`dist/server/node-build.mjs`) generated cleanly |
| **C++ Geometry Engine** | `.\cpp-engine\build\test_geometry.exe` | **PASS (Exit 0)** | Native binary passed distance, intersection, transforms, 4-shape recognition (Line, Rect, Circle, Triangle, Unknown) |
| **Git Diff Check** | `git diff --check` | **PASS (Exit 0)** | Clean diff with zero whitespace or line ending warnings |

---

## 4. Physical Webcam Acceptance Protocol

1. **Camera Off Default**: Launch `python vision/agent_server.py` and open the site; verify camera status is `Camera Off` and no webcam light turns on.
2. **Explicit Start**: Click **Allow Camera / Start Tracking** in the floating panel; verify camera status transitions `Starting -> Active` and preview appears.
3. **Right Hand Tracking**: Raise right hand; verify master pointer follows index fingertip on the canvas with label `Right Hand • Move Pointer`.
4. **Pinch Under 1s**: Pinch thumb and index for 0.5s and release; verify activation countdown ring resets with NO stroke drawn.
5. **Continuous 1.0s Hold to Draw**: Pinch and hold for 1.0s; verify countdown reaches 100%, transitions to `Drawing (W: Xpx)`, draws active live polyline, and releases cleanly at the last point when opened.
6. **Left Hand Erasing**: Raise left hand, hold pinch 1.0s; verify red dashed eraser circle appears and erases vector paths.
7. **Explicit Stop**: Click **Stop Camera** icon; verify capture immediately halts, webcam hardware releases, and cursor disappears.
