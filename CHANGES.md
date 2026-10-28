# AirDoodle — Complete Change Log & System Audit Record

This document provides a complete, detailed record of all discovery, audit, cleanup, integration, and verification work performed in the AirDoodle repository (`D:\VsCode\Projects\AirDoodle`).

---

## 1. System Discovery & Baseline Audit (Phase 0)

### Initial Architecture Discovered
- **Frontend:** Builder.io "Fusion Starter" export in [`air-doodle-frontend`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend) (Vite + React 18 SPA + Express server, TypeScript, TailwindCSS 3, Lucide icons, Framer Motion, Radix UI).
- **Backend:** Express server contained only `/api/ping` and `/api/demo`. No real authentication, project database models, or collaboration servers were connected.
- **Vision Pipeline:** `vision/` and legacy root scripts (`phase1` to `phase5`) using OpenCV and MediaPipe.
- **C++ Geometry Engine:** Missing from the repository (`cpp-engine/` did not exist).
- **Database:** PostgreSQL port 5432 active on localhost; Docker installed (daemon inactive).
- **Git State:** Uncommitted refactoring of vision imports preserved.

### Baseline Checks
- `npx pnpm typecheck`: Passed (0 errors).
- `npx pnpm test`: 3 files, 11 tests passed.
- `npx pnpm build`: Passed.
- `python -B -m unittest discover -s tests -v`: 3 tests passed in `test_gesture_recognizer.py`.

---

## 2. Builder.io Cleanup & System Documentation (Phase A)

### Unwanted Branding & Artifacts Removed
- **Environment:** Removed `VITE_PUBLIC_BUILDER_KEY=__BUILDER_PUBLIC_KEY__` and builder documentation link from [`air-doodle-frontend/.env`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/.env).
- **Rules Directory:** Removed unused `.builder/` prompt directory.
- **Document Metadata:** Updated [`air-doodle-frontend/index.html`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/index.html):
  - Replaced `<title>Hello world project</title>` with `<title>AirDoodle — Gesture-Driven 2D Workspace</title>`.
  - Added SEO meta description for AirDoodle.
  - Maintained viewport and charset tags.
- **Package Manifest:** Renamed `"name": "fusion-starter"` to `"name": "air-doodle"` in [`air-doodle-frontend/package.json`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/package.json).
- **Server Branding:** Updated [`air-doodle-frontend/server/node-build.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/server/node-build.ts) to remove "Fusion Starter" log messages.
- **Project Guidance:** Rewrote [`air-doodle-frontend/AGENTS.md`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/AGENTS.md) to document the AirDoodle full-stack structure.

### Documentation Created
- [`docs/architecture.md`](file:///d:/VsCode/Projects/AirDoodle/docs/architecture.md): Runtime process map, page hierarchy, state ownership, and Mermaid data-flow diagram.
- [`docs/contract.md`](file:///d:/VsCode/Projects/AirDoodle/docs/contract.md): Authoritative 1000 × 700 coordinate system, typed discriminated union for shapes, REST API endpoints, WebSocket events, and C++ JSON-lines protocol.

---

## 3. Contracts & Shared Types (Phase B)

- Created [`air-doodle-frontend/shared/shape.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/shared/shape.ts):
  - Shared discriminated union: `line`, `rectangle`, `circle`, `triangle`, `freehand`.
  - Geometry conventions:
    - Line: `x1, y1, x2, y2`
    - Rectangle: `x, y, width, height`
    - Circle: `cx, cy, r`
    - Triangle: `[Coordinate, Coordinate, Coordinate]`
    - Freehand: `Coordinate[]`
  - Fully typed styles: `stroke`, `fill`, `strokeWidth`, `rotation` (degrees), and numeric `revision`.
- Updated [`air-doodle-frontend/client/types/shape.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/types/shape.ts) to re-export shared contracts, maintaining single-source-of-truth across client, server, and engine.

---

## 4. Backend Persistence & Authentication (Phase C)

### Persistence Engine
- Created [`air-doodle-frontend/server/services/db.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/server/services/db.ts):
  - Persistent JSON file database (`server/data/air-doodle-db.json`) with automatic directory creation.
  - Password security: `crypto.scryptSync` with unique 16-byte cryptographic salt and timing-safe comparison (`crypto.timingSafeEqual`).
  - Session security: Signed HMAC-SHA256 bearer tokens with 7-day expiration.
  - Pre-seeded default users (`demo@airdoodle.com` / `password123`) and initial project workspace.

### REST Endpoints
- Created [`air-doodle-frontend/server/routes/auth.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/server/routes/auth.ts):
  - `POST /api/auth/register` — Registers new users with password hashing.
  - `POST /api/auth/login` — Authenticates credentials and returns signed tokens.
  - `GET /api/auth/me` — Validates session token and returns active profile.
- Created [`air-doodle-frontend/server/routes/projects.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/server/routes/projects.ts):
  - `GET /api/projects` — Lists projects for authenticated user.
  - `POST /api/projects` — Creates new project.
  - `GET /api/projects/:id` — Loads project metadata and persisted shapes.
  - `PUT /api/projects/:id` — Updates project title and saves committed shapes.
  - `DELETE /api/projects/:id` — Deletes project from server.
- Created [`air-doodle-frontend/server/routes/recognize.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/server/routes/recognize.ts):
  - `POST /api/recognize` — Accepts raw stroke coordinates and delegates to C++ engine.
- Updated [`air-doodle-frontend/server/index.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/server/index.ts) to register all routes with CORS and JSON body parsers.

### Client Services Connected
- Updated [`air-doodle-frontend/client/services/auth.service.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/services/auth.service.ts): Connected to `/api/auth/*` endpoints with local fallback.
- Updated [`air-doodle-frontend/client/services/project.service.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/services/project.service.ts): Connected to `/api/projects/*` with offline cache synchronization.

---

## 5. C++ Geometry Engine (Phase D)

### Engine Architecture (`cpp-engine/`)
- Created [`cpp-engine/CMakeLists.txt`](file:///d:/VsCode/Projects/AirDoodle/cpp-engine/CMakeLists.txt) targeting C++17.
- Implemented [`cpp-engine/src/geometry.hpp`](file:///d:/VsCode/Projects/AirDoodle/cpp-engine/src/geometry.hpp) and [`geometry.cpp`](file:///d:/VsCode/Projects/AirDoodle/cpp-engine/src/geometry.cpp):
  - Euclidean distance and point-to-segment distance projection.
  - 2D segment intersection with orientation tests.
  - Affine transformations: `translatePoint`, `rotatePoint` (degrees), `scalePoint`.
  - Axis-aligned bounding box calculations (`calculateBounds`).
  - Hit testing: `pointInRect`, `pointInCircle`, `pointInTriangle`.
- Implemented [`cpp-engine/src/recognizer.hpp`](file:///d:/VsCode/Projects/AirDoodle/cpp-engine/src/recognizer.hpp) and [`recognizer.cpp`](file:///d:/VsCode/Projects/AirDoodle/cpp-engine/src/recognizer.cpp):
  - Straight line recognition via direct-distance vs path-length ratio (< 1.18).
  - Triangle recognition via closed path with apex/base point distribution.
  - Circle recognition via aspect ratio close to 1:1 and radius consistency.
  - Rectangle recognition default.
- Implemented [`cpp-engine/src/main.cpp`](file:///d:/VsCode/Projects/AirDoodle/cpp-engine/src/main.cpp):
  - Persistent standard I/O loop reading JSON-lines from stdin.
  - Strict separation: protocol responses to `std::cout`, diagnostic logs to `std::cerr`.
  - Actions supported: `ping`, `recognize`, `bounds`, `distance`, `intersect`.
  - Handled malformed input safely without crashing.
- Implemented [`cpp-engine/tests/test_geometry.cpp`](file:///d:/VsCode/Projects/AirDoodle/cpp-engine/tests/test_geometry.cpp):
  - Unit tests for distance, intersections, affine transforms, and shape recognition.

### Build & Verification
- Compiled and executed `cpp-engine/build/test_geometry.exe` — All assertions passed.
- Compiled `cpp-engine/build/airdoodle-geometry.exe` binary.
- Verified stdin/stdout piping with correlation IDs.
- Subprocess manager implemented in [`air-doodle-frontend/server/services/geometry-engine.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/server/services/geometry-engine.ts) with lazy initialization so unit tests do not leave lingering processes.

---

## 6. Collaboration & Vision Agent (Phase E)

### Real-Time Socket.io Collaboration
- Installed `socket.io` and `socket.io-client` 4.8.4.
- Created [`air-doodle-frontend/server/services/socket.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/server/services/socket.ts):
  - Project room partitioning (`project:${projectId}`).
  - Peer join/leave broadcasts.
  - Real-time shape synchronization (`shape:create`, `shape:update`, `shape:delete`) updating server database in background.
  - Transient cursor movements (`cursor:move`) broadcast without persistence.
- Attached Socket.io to dev server in [`air-doodle-frontend/vite.config.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/vite.config.ts) and production server in [`air-doodle-frontend/server/node-build.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/server/node-build.ts).
- Created [`air-doodle-frontend/client/services/collaboration.service.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/services/collaboration.service.ts).
- Updated [`air-doodle-frontend/client/components/canvas/Canvas.tsx`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/components/canvas/Canvas.tsx) to render live remote cursors with peer names.
- Updated [`air-doodle-frontend/client/pages/Project.tsx`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/pages/Project.tsx) to sync shapes and cursors in real time.
- Updated [`air-doodle-frontend/client/components/layout/Topbar.tsx`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/components/layout/Topbar.tsx) with genuine "Live Sync" badge.

### Local Python Vision Agent
- Created [`vision/agent_server.py`](file:///d:/VsCode/Projects/AirDoodle/vision/agent_server.py):
  - Local WebSocket server running on `ws://localhost:8765`.
  - Captures local webcam frames (frames are strictly processed locally and never uploaded to server).
  - Uses MediaPipe HandTracker and GestureRecognizer.
  - Normalizes coordinates horizontally mirrored to the logical 1000 × 700 canvas space.
  - Detects index finger position for `cursorMoved`, pinch gesture for `penDown`, and pinch release for `penUp` / `strokeFinished`.
  - Built-in simulation mode (`--test`) for automated headless verification.
- Updated [`vision/tracking/hand_tracker.py`](file:///d:/VsCode/Projects/AirDoodle/vision/tracking/hand_tracker.py) with version compatibility checks to prevent crashes across MediaPipe build variations.
- Created [`air-doodle-frontend/client/services/vision.service.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/services/vision.service.ts) to stream gesture events into the unified browser input pipeline.
- Created [`tests/test_vision_agent.py`](file:///d:/VsCode/Projects/AirDoodle/tests/test_vision_agent.py) verifying handshake and event streaming.
- Added `websockets` to [`requirements.txt`](file:///d:/VsCode/Projects/AirDoodle/requirements.txt).

---

## 7. Docker & Full-Stack Deployment (Phase F)

- Created multi-stage [`Dockerfile`](file:///d:/VsCode/Projects/AirDoodle/Dockerfile):
  - **Stage 1 (cpp-builder):** Compiles C++ geometry engine using GCC 12.
  - **Stage 2 (node-builder):** Installs dependencies and builds Vite SPA + Express server.
  - **Stage 3 (runner):** Minimal Node 20 Alpine production container with healthcheck on `/api/ping`.
- Created [`docker-compose.yml`](file:///d:/VsCode/Projects/AirDoodle/docker-compose.yml):
  - Orchestrates PostgreSQL 16 Alpine (`postgres:5432`) with healthcheck and persistent volume `airdoodle_postgres_data`.
  - Orchestrates Web application (`web:3000`) connected to PostgreSQL.
  - Validated cleanly via `docker compose config`.
  - Local Python vision agent remains host-side to access physical webcam hardware directly.

---

## 8. Verification Matrix & Test Outcomes

| Target | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Frontend TypeScript** | `npx pnpm typecheck` | **PASS (Exit 0)** | Zero type errors across client, server, and shared code |
| **Frontend Tests** | `npx pnpm test` | **PASS (Exit 0)** | 11 tests passed across 3 test files in 895ms |
| **Frontend Production Build** | `npx pnpm build` | **PASS (Exit 0)** | Client SPA (`dist/spa`) and server SSR bundle (`dist/server`) built cleanly |
| **C++ Unit Tests** | `.\cpp-engine\build\test_geometry.exe` | **PASS (Exit 0)** | Distance, intersection, transform, and stroke recognition tests passed |
| **C++ Protocol** | `.\cpp-engine\build\airdoodle-geometry.exe` | **PASS (Exit 0)** | Stdin/stdout JSON-lines piping verified |
| **Python Unit Tests** | `python -B -m unittest discover -s tests -v` | **PASS (Exit 0)** | 4 tests passed in 1.85s (legacy gesture tests + WebSocket agent test) |
| **Docker Compose Config** | `docker compose config` | **PASS (Exit 0)** | Validated cleanly with PostgreSQL 16 and web services |

---

## 9. Repository Consolidation, Integration Fixes & Documentation (Phase G)

### Repository Cleaning & Artifact Consolidation
- **Removed Scratch Files:** Deleted `temp/` folder (`firstLesrn.py`, `tempCodeRunnerFile.py`) after confirming zero active references.
- **Removed Obsolete Netlify Configuration:** Deleted `air-doodle-frontend/netlify.toml` and `air-doodle-frontend/netlify/functions/api.ts` from initial Builder.io serverless export; all builds and runtimes now consistently use Express and Node.js.
- **Retained Compatibility Shims & Assets:** Preserved `utils/` compatibility shims, root `phase1_*.py` through `phase5_*.py` scripts, `airdraw_saves/`, and model folders to maintain backward compatibility.

### Integration Bug Fixes
1. **Express 5 Wildcard Routing:**
   - *File:* `air-doodle-frontend/server/node-build.ts`
   - *Issue:* Wildcard route `app.get("*")` crashed on import under Express 5 / `path-to-regexp` v8 with `TypeError: Missing parameter name at 1`.
   - *Fix:* Replaced route pattern with `app.get("/{*splat}")`.
2. **Vision Agent CLI Argument Support:**
   - *File:* `vision/agent_server.py`
   - *Issue:* Executing with `--test-mode` threw `unrecognized arguments: --test-mode`.
   - *Fix:* Added alias support for both `--test` and `--test-mode` flags.
3. **Standalone Python Test Execution:**
   - *File:* `tests/test_gesture_recognizer.py`
   - *Issue:* Executing as `python tests/test_gesture_recognizer.py` failed with `ModuleNotFoundError: No module named 'utils'`.
   - *Fix:* Added `sys.path.insert(0, ...)` root resolution.
4. **C++ Native Engine Subprocess Path Discovery:**
   - *File:* `air-doodle-frontend/server/services/geometry-engine.ts`
   - *Issue:* Binary discovery only checked paths relative to `air-doodle-frontend/`, causing engine detection failures when launched from project root or inside Docker.
   - *Fix:* Added candidate paths covering project root, Docker container root, and Release builds.
5. **Project Authorization Checks:**
   - *File:* `air-doodle-frontend/server/routes/projects.ts`
   - *Issue:* `handleUpdateProject` and `handleDeleteProject` lacked ownership checks.
   - *Fix:* Enforced user ownership verification on project mutations and deletions.
6. **Robust JSON Store Directory Resolution:**
   - *File:* `air-doodle-frontend/server/services/db.ts`
   - *Issue:* `server/data/air-doodle-db.json` resolution assumed current working directory was always `air-doodle-frontend`.
   - *Fix:* Added dynamic cwd detection checking both root and frontend paths.
7. **Explicit Vision Status Badge in UI:**
   - *File:* `air-doodle-frontend/client/components/layout/Topbar.tsx`
   - *Improvement:* Added explicit "Vision Active" vs "Mouse Active" topbar badge so users immediately know their active input source.

### Documentation Updates
- **README.md:** Completely rewritten to provide comprehensive project overview, feature matrix, Mermaid architecture diagram, technology stack, directory tree, exact setup/run commands, API/Socket specifications, and persistence behavior.
- **docs/contract.md:** Synchronized Socket.IO event naming (`project:join`, `project:leave`, `cursor:move`) with actual server/client implementations.
- **docs/architecture.md:** Documented the relationship between the active atomic JSON storage engine and the provisioned Docker PostgreSQL container.
- **docs/integration-validation.md:** Created a formal verification test report documenting all test runs, evidence, and passing statuses.

---

## 10. Legacy Consolidation & GitHub Readiness Pass (Phase H)

### Root Directory Streamlining
- **Moved Historical Phase Prototypes to `legacy/`:**
  - `phase1_hand_tracking.py` → `legacy/phase1_hand_tracking.py`
  - `phase2_gesture_recognition.py` → `legacy/phase2_gesture_recognition.py`
  - `phase3_air_writing.py` → `legacy/phase3_air_writing.py`
  - `phase4_device_control.py` → `legacy/phase4_device_control.py`
  - `phase5_authentication.py` → `legacy/phase5_authentication.py`
  - *Rationale:* Keeps root directory minimal, clear, and focused on the active workspace applications while preserving early standalone prototypes and historical work for developers.
- **Maintained Compatibility Shims:**
  - Preserved `utils/hand_tracker.py` and `utils/gesture_recognizer.py` forwarding imports to `vision/`.

### GitHub Readiness & Security Hardening
- **Enhanced Root `.gitignore`:**
  - Excluded local virtual environments (`venv/`, `.venv/`, `*_env/`, `airtype_env/`).
  - Excluded build output directories (`dist/`, `build/`, `cpp-engine/build/`, `*.exe`, `*.o`).
  - Excluded local `.env` and `.env.local` files while preserving safe `.env.example`.
  - Excluded local runtime database caches (`server/data/air-doodle-db.json`) and temporary drawings (`airtype_drawing.png`, `airdraw_saves/*.png`).
  - Excluded OS and IDE metadata (`.vscode/*`, `.idea/`, `Thumbs.db`, `.DS_Store`).
- **Verified Zero Committed Secrets:**
  - Inspected `air-doodle-frontend/.env` to confirm it only contains local ports and paths without external secret keys.

### Verification of Reorganized State
- **Python Tests:** `python -m unittest discover tests` executed cleanly (4/4 tests passed in 1.85s).
- **C++ Tests:** `.\build\test_geometry.exe` executed cleanly (4/4 test suites passed).
- **Frontend Type Checking:** `npm run typecheck` passed (0 errors).
- **Frontend Tests:** `npm test` passed (11/11 tests passed in 910ms).
- **Full Production Build:** `npm run build` completed cleanly for both client SPA and server bundle.
- **Docker Compose:** `docker compose config` parsed and validated with zero warnings.
- **Git Hygiene:** `git diff --check` passed with 0 errors.

---

## 11. Production Session Secret Security Hardening (Phase I)

### Hardcoded Secret Removal & Runtime Enforcement
- **Backend Session Secret Resolution (`server/services/db.ts`):**
  - Updated `resolveSessionSecret()`: In production environments (`NODE_ENV=production`), `SESSION_SECRET` must be set via environment variable with a minimum length of 32 characters.
  - Startup immediately halts with code 1 and error message `[Security Error] SESSION_SECRET must be configured with at least 32 characters in production environments.` if missing or too short.
  - Development environments (`NODE_ENV !== 'production'`) use a designated development-only fallback with zero manual setup.
- **Docker Compose Configuration (`docker-compose.yml`):**
  - Replaced hardcoded `SESSION_SECRET: airdoodle-prod-secret-key-2026` with environment interpolation `${SESSION_SECRET:?SESSION_SECRET must be set in production}`.
  - Replaced hardcoded Postgres password with `${POSTGRES_PASSWORD:-airdoodle_password}`.
- **Environment Documentation (`.env.example` & `README.md`):**
  - Documented `SESSION_SECRET` in `.env.example` with instructions to generate cryptographically strong values via `openssl rand -base64 32`.
  - Documented production session secret requirements in README.md Section 10.
- **Dynamic Vite Server Import (`vite.config.ts`):**
  - Replaced static top-level server import in `vite.config.ts` with dynamic import inside `configureServer` so `npm run build:client` does not trigger server runtime secret validation.

### Verification of Fix
- Production startup without `SESSION_SECRET` fails as expected: Exit 1, security error emitted.
- Production startup with short secret (< 32 chars) fails as expected: Exit 1.
- Production startup with valid 32+ char secret succeeds: Exit 0.
- `npm run typecheck`: Passed (0 errors).
- `npm test`: Passed (11/11 tests).
- `npm run build`: Passed (Client SPA & Server bundles).
- `git diff --check`: Passed (0 conflicts/errors).

---

## 12. Authentication, Account Isolation & Project Security (Phase II)

### Server-Side Data Store & Project Ownership (`server/services/db.ts`)
- **Strict Account Isolation:**
  - Modified `listProjects(userId)` to strictly filter and return only projects belonging to the authenticated user. New users no longer inherit or view unassociated projects.
  - Removed automatic seeding of mock projects for newly created accounts; only the initial demo user is seeded if the database is uninitialized.
  - Added automatic backward-compatible schema migration preserving all existing users and projects while initializing records for password resets and project shares.
- **Expiring Password Reset Tokens:**
  - Implemented `createResetToken`, `verifyResetToken`, and `consumeResetToken` in `db.ts` utilizing SHA-256 hashed single-use tokens with a 1-hour expiration window.
- **Granular Project Sharing & Access Control:**
  - Added `ShareRecord` and `SharePermission` (`view` | `edit`) models with cryptographic share tokens.
  - Implemented `getUserProjectPermission(projectId, userId, shareToken)` providing server-side verification across owner access, view-only shares, and edit shares.

### Authentication & API Security Routes (`server/routes/auth.ts`)
- **Real Server Errors & Password Reset:**
  - Added forgot-password (`/api/auth/forgot-password`) and reset-password (`/api/auth/reset-password`) handlers.
  - Enforced constant generic response messaging on forgot-password requests to mitigate account enumeration.
  - In development environments, reset URLs are returned in the response payload for easy local testing; production environments suppress raw tokens and log via configured SMTP pipelines.
- **Google OAuth Verification:**
  - Added `/api/auth/google` with ID token verification via Google's tokeninfo endpoint checking token validity, client audience ID, and verified email status.
  - Added `createOrUpdateGoogleUser` for seamless account linking and user creation.

### Client-Side Error Propagation & Session Validation
- **Auth Service & Context (`client/services/auth.service.ts`, `client/context/AuthContext.tsx`):**
  - Removed silent fallback mock user creation in `auth.service.ts`, propagating legitimate server error messages on failed requests.
  - Added `validateSession()` invoking `/api/auth/me` on mount with Bearer token authentication to clear expired/invalid credentials safely.
- **Login Screen User Feedback (`client/pages/Login.tsx`):**
  - Updated error handling state to present readable server validation messages to the user.

### Project Routes & Permissions (`server/routes/projects.ts`)
- **Ownership & Permission Enforcement:**
  - Protected `handleListProjects`, `handleCreateProject`, and `handleDeleteProject` requiring valid authentication.
  - Only the project owner can delete or generate sharing links.
  - Implemented `handleGetProject` and `handleUpdateProject` validating permissions via owner context or share tokens, enforcing read-only blocks for `view` permissions.
  - Added `handleGetProjectPreview` to safely deliver shape data for dashboard thumbnails.

---

## 13. Multi-Format Canvas Exports, Drawing Workspace, Vision Privacy & Sharing (Phase III)

### Server Route Mountings (`server/index.ts`)
- Mounted missing authentication routes (`/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/google`).
- Mounted project sharing endpoints (`/api/projects/:id/shares` - POST, GET, PUT, DELETE) and project previews (`/api/projects/:id/preview`).

### Fast Refresh & Authentication UI
- **Decoupled Context Hook (`client/context/useAuth.ts`):** Separated `useAuth` hook and `AuthContext` definitions, eliminating the Vite React Fast Refresh warning while retaining backwards compatibility.
- **Password Reset Flow (`client/pages/ForgotPassword.tsx`, `client/pages/ResetPassword.tsx`):** Built dedicated reset pages handling token generation, validation, confirm password inputs, and development-only test link exposure.
- **Responsive Account Menu (`client/pages/Dashboard.tsx`):** Integrated mobile & desktop `DropdownMenu` for account sign-out and profile info.

### Account-Isolated Project Storage & Real Dashboard Previews
- **Zero Local Project Leakage (`client/services/project.service.ts`):** Eliminated mock default projects in localStorage that leaked across user accounts. All project operations (list, create, load, save, rename, delete) now strictly enforce ownership server-side.
- **Dynamic Previews & Actions (`client/pages/Dashboard.tsx`):** Rendered real shape thumbnails generated from project shapes, added project renaming and deletion dialogs, and provided an empty state for accounts with zero projects.

### Multi-Format Non-Blank Canvas Exports (`client/services/export.service.ts`)
- **Supported Formats:** SVG vector (`.svg`), PNG raster (`.png`), JPEG raster (`.jpg`), and native AirDoodle JSON (`.airdoodle.json`).
- **Render Fidelity:** Exports render actual document geometry and stroke data against chosen background fills without including surrounding DOM frames.
- **Automated Verification:** Added `client/services/export.spec.ts` with tests confirming non-blank output and proper SVG/JSON structures.

### Drawing Workspace & Geometric Recognition Workflow
- **Freehand Pen Tool:** Added `pen` tool to shared and client shape models for unconstrained drawing alongside gesture recognition.
- **Shape Styling Properties Panel (`client/components/panels/ProjectPropertiesPanel.tsx`):** Integrated stroke color presets/picker, fill color presets, stroke width slider (1–16px), and rotation slider.
- **Recognition Accept/Reject Banner (`client/components/panels/ShapeAcceptancePrompt.tsx`):** When gesture strokes finish in recognition mode, the original stroke is preserved and an interactive banner prompts the user to convert or keep the raw stroke.
- **Auto-Save & Status Indicators (`client/components/layout/Topbar.tsx`):** Added debounced auto-saving with live status (`saving`, `saved`, `unsaved`), inline title renaming, and an export dropdown menu.

### Local Camera Tracking & Privacy Architecture
- **Controlled Lifecycle (`client/services/vision.service.ts`):** Replaced uncontrolled background auto-connect with explicit user consent.
- **Local Floating Camera Preview (`client/components/panels/CameraTrackingPanel.tsx`):** Displays a local-only camera feed that is never broadcast over WebSockets or Socket.IO, with controls to hide preview or stop tracking completely.

### Cryptographic Sharing & Access Control
- **Share Dialog (`client/components/dialogs/ShareDialog.tsx`):** Private-by-default projects with unguessable tokens for `view` and `edit` permissions, one-click copy feedback, and token revocation.
- **Read-Only Enforcement:** Viewers are restricted from modifying shapes, saving, or accessing editing toolbars.

---

## 14. Gesture Tracking Pipeline, Dual Eraser Modes, Gesture-Controlled Brush Sizes & C++ Recognition (Phase IV — October 22, 2026)

### 1. Root Cause & Fix for Hand-Tracking Pipeline
- **Root Cause 1 (Mouse Hijacking Hand Cursor):** In `Canvas.tsx`, standard mouse `handlePointerMove` was firing `onInputEvent({ type: "cursorMoved", x, y })`. This conflated mouse moves with vision tracking and caused `handCursor` to jump to mouse coordinates.
  - *Fix:* Removed `cursorMoved` dispatch from mouse moves in `Canvas.tsx`. Mouse moves now strictly drive mouse state. Hand cursor is driven exclusively by vision events with a 700ms decay timer that cleans up the cursor if tracking disconnects or hands are lost.
- **Root Cause 2 (Single-Hand Limitation & Missing Palm Scale):** `agent_server.py` was initialized with `max_hands=1`, dropping left/right dual hand detection. Coordinate mirroring and depth variations caused erratic distance thresholds.
  - *Fix:* Updated `HandTracker` configuration to `max_num_hands=2`. Added `cv2.flip(frame, 1)` for correct selfie orientation. Extracted all 21 MediaPipe landmarks. Computed calibrated `palm_scale = distance(lm[0], lm[9])` (wrist to MCP base) to normalize finger distances across near/far depths instead of using rigid pixel thresholds.
- **Throttled Diagnostics:** Added 3-second heartbeat logging in `agent_server.py` (FPS, hands detected, clients connected) and `vision.service.ts` (event rate, active hands, socket connectivity) to pinpoint failures across capture, detection, transmission, and receipt.

### 2. Hand-Cursor Visibility & Independent Gesture Mechanics
- **Cursor Visibility Rules:** Hand cursor renders only when camera tracking is active and fresh tracking frames are received within 700ms. Disappears immediately on camera stop or timeout. Mouse movement never triggers or moves the hand cursor.
- **Right Hand (Drawing):** Requires an intentional thumb-index pinch held for ~0.8s (`Hold to Activate` state) before initiating `penDown`. Distance between thumb and index relative to palm scale dynamically controls `strokeWidth` (2px to 24px). Opening the hand triggers an exit gesture cleanly without leaving orphaned strokes.
- **Left Hand (Erasing):** Requires intentional pinch activation hold (~0.8s). Detected position moves the eraser brush. Spreading thumb and index finger scales eraser `radius` (10px to 60px) with circular live preview. Moving left-hand pinch performs object or detail erasing. Open palm exits erase mode with hysteresis.
- **Camera Tracking Panel UI (`CameraTrackingPanel.tsx`):** Displays active states (`Waiting`, `Hold to Activate`, `Drawing`, `Erasing`, `Adjusting Size`, `Hand Not Detected`, `Disconnected`), dynamic stroke width / eraser radius meters, and an interactive in-app gesture guide.

### 3. Two Distinct Eraser Modes
- **Toolbar Selector:** Added toggle between `Object Eraser` and `Detail Eraser` in `FloatingToolbar.tsx`, with an eraser radius slider and a live cursor brush preview matching the actual eraser circle.
- **A. Object Eraser:** Precise mathematical geometry hit-testing (`intersectsShape`) for lines (point-to-segment distance), circles (interior + perimeter), rectangles (interior + perimeter), triangles (interior + perimeter), and freehand paths. Deletes the entire vector object only when intersected.
- **B. Detail Eraser:**
  - *Freehand paths:* Splits or trims the path at the erased region into preserved sub-strokes, discarding only touched vertices.
  - *Geometric shapes (rectangles, circles, triangles):* Appends persistent vector mask cutouts (`mask: [{ cx, cy, r }]`) so only the touched region disappears while preserving the shape geometry, styles, and vector identities.
  - Never deletes the entire shape in detail mode.
  - Fully preserved in project persistence, collaboration, and exports (SVG `<defs><mask id="mask-${id}">...`, PNG, JPEG, and native JSON).
- **Permissions:** View-only shared users cannot erase.

### 4. Properties Panel Collapse Behavior
- Added `e.stopPropagation()` on mouse and pointer events inside `ProjectPropertiesPanel.tsx` so clicking color pickers, sliders, or controls never collapses the panel.
- Clicking empty canvas space triggers `onEmptyClick` in `Canvas.tsx` which closes the panel (`setShowProperties(false)`).
- Reopens automatically when selecting a shape on the canvas or clicking the floating "Properties" button.
- Fill color controls are strictly restricted to closed 2D shapes (`rectangle`, `circle`, `triangle`); freehand strokes and lines never become filled shapes.

### 5. C++ Geometric Engine Genuine Integration
- Rewrote `cpp-engine/src/recognizer.cpp` and `server/services/geometry-engine.ts`:
  - *Lines:* Straightness ratio $< 1.15$, endpoint distance spanning bounds diagonal, not closed.
  - *Closedness Check:* Stricter closure requirements ($< 0.28 \times \text{diagonal}$).
  - *Circles:* Circularity $> 0.70$, radial coefficient of variation $CV < 0.10$, radial ratio $R_{\max}/R_{\min} < 1.25$, balanced aspect ratio ($< 0.22$).
  - *Triangles:* Closed path with 3 distinct corner clusters and fill ratio $\le 0.70$.
  - *Rectangles:* Closed path covering all 4 bounding box quadrants.
  - *Ambiguous Strokes:* Explicitly returns `unknown` / `freehand` instead of defaulting to circle or rectangle.
- C++ engine subprocess (`airdoodle-geometry.exe`) communicates over clean standard I/O (stdin/stdout for JSON-lines protocol, stderr for debug logs).
- Added Node-to-C++ integration test in `server/services/geometry-engine.spec.ts`.
- Updated client-side fallback `client/services/recognizer.ts` with matching geometric precision.

### 6. Test Commands & Real Pass/Fail Results
| Test Suite | Execution Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Frontend Tests** | `npm test` | **PASS (Exit 0)** | 29/29 tests passed across 6 test files |
| **Frontend Typecheck** | `npm run typecheck` | **PASS (Exit 0)** | 0 TypeScript errors across client, server, and shared |
| **Frontend Production Build** | `npm run build` | **PASS (Exit 0)** | SPA and SSR server bundles generated cleanly |
| **C++ Unit Tests** | `.\cpp-engine\build\test_geometry.exe` | **PASS (Exit 0)** | Distance, intersection, transforms, 4-shape recognition + unknown |
| **Python Unit Tests** | `python -m unittest discover tests` | **PASS (Exit 0)** | 4/4 tests passed (gesture recognizer + vision agent server) |
| **Git Whitespace & Diff** | `git diff --check` | **PASS (Exit 0)** | Zero whitespace warnings or syntax issues |

### 7. Physical Webcam Checks Requiring Manual Hardware Verification
- Automated tests run using mock/simulation modes (`--test`), asserting packet structure, landmark validation, hand scale calibration, and WebSocket dispatch.
- Physical webcam checks requiring manual verification with hardware:
  1. Verify OpenCV index 0 opens the physical USB/integrated camera in ambient room lighting.
  2. Verify physical two-hand simultaneous tracking (left hand adjusting eraser radius, right hand drawing).
  3. Verify optical hand occlusion tolerance when hands cross in front of the camera lens.

---

## 15. Critical Runtime Bug Fixes & Architecture Hardening (Phase V — October 22, 2026)

### 1. Webcam Ownership Conflict & Live Hand-Controlled Drawing
- **Root Cause (Windows Exclusive Camera Lock):** On Windows, when `navigator.mediaDevices.getUserMedia` was invoked by `CameraTrackingPanel.tsx` in Chrome/Edge, the operating system granted exclusive hardware capture lock to the browser process. Consequently, OpenCV's `cv2.VideoCapture(0)` in `vision/agent_server.py` threw hardware access errors or failed silently to open. Furthermore, in-progress hand strokes were not rendered live on the canvas, appearing only after stroke finalization.
- **Authoritative Capture Architecture:**
  - Designated Python OpenCV (`agent_server.py`) as the single authoritative hardware capture owner.
  - Initialized OpenCV with DirectShow (`cv2.CAP_DSHOW` on Windows) with automatic fallback from device index 0 to 1, logging detailed `VideoCapture.isOpened()` status and hardware errors.
  - Broadcasts throttled diagnostic status (`agentStatus`), hardware errors (`cameraError`), and a lightweight downscaled JPEG preview (`cameraPreview` base64, ~320x240, 50% JPEG quality at ~10 FPS) over local WebSocket loopback (`ws://127.0.0.1:8765`).
  - Removed browser `getUserMedia` and HTML `<video>` from `CameraTrackingPanel.tsx` entirely. Browser renders the secure local loopback JPEG stream in an `<img>` tag without competing for hardware handles or streaming raw video through cloud or collaborative Socket.IO channels.
  - Implemented `liveHandStroke` state in `Project.tsx` and `<Canvas>` SVG rendering so right-hand drawing gestures produce an active, visible polyline path following the index fingertip in real-time.

### 2. Line-Segment Circle Clipping for Detail Eraser & Vector Masks
- **Root Cause (Vertex-Only Point Filtering):** Previously, `applyDetailEraser` only checked whether existing polyline points fell inside the eraser radius. If a long vector line segment passed completely through the eraser circle with both endpoints outside ($d > r$), the segment was completely ignored. Additionally, rotated shape masks did not account for shape rotation angles.
- **Targeted Mathematical Fix:**
  - Implemented exact mathematical segment-to-brush-circle clipping in `eraserGeometry.ts` (`clipPolylineWithCircle`). Computes parametric intersection points along segment $P(t) = A + t(B - A)$ using quadratic equation $a t^2 + b t + c = 0$. Accurately splits crossing segments into preserved sub-strokes even when neither endpoint lies inside the brush.
  - For closed shapes (`rectangle`, `circle`, `triangle`), converts eraser brush points into the shape's local un-rotated coordinate frame (`rotatePoint(eraser, center, -shape.rotation)`).
  - Appends persistent SVG mask cutouts with explicit `maskUnits="userSpaceOnUse"`.
  - Added comprehensive test suite in `eraserGeometry.spec.ts` covering non-endpoint crossing segments, multiple sequential erasures, and rotated masks (10/10 tests pass).

### 3. Dark/Black Shape Conversion & Recognition Styling
- **Root Cause (SVG Spec Default Fill):** SVG specification dictates that elements lacking an explicit `fill` attribute default to solid black (`#000000`). If a converted shape lacked `style.fill`, browsers rendered it solid black.
- **Targeted Fix:**
  - Enforced `fill: shape.style.fill || "none"` across `Canvas.tsx`, `export.service.ts`, and `svgExport.ts`.
  - In `Project.tsx`, when converting recognized strokes, inherited original stroke color and stroke width while strictly forcing `fill: "none"` unless explicitly chosen by the user.
  - Restricted recognition triggers strictly to `tool === "draw"`. Freehand drawing with `tool === "pen"` preserves organic freehand strokes without conversion prompts.
  - Ambiguous or low-confidence recognition results preserve the original freehand stroke without destructive fallback to default shapes.

### 4. C++ Native Geometry Engine Bridge Verification
- Verified bi-directional Node-to-C++ JSON-lines subprocess pipeline (`server/services/geometry-engine.ts` spawning `cpp-engine/build/airdoodle-geometry.exe`).
- Tagged responses with `engine: "native-cpp"` vs `engine: "js-fallback"` to differentiate native execution.
- Deterministic test cases for lines, rectangles, circles, triangles, and ambiguous squiggly strokes verified against the compiled native engine binary.

### 5. Export Verification & Properties Panel Interactivity
- **SVG Export:** Validated vector output with `<defs><mask id="..." maskUnits="userSpaceOnUse">`, explicit canvas background, and `fill || "none"`.
- **PNG/JPEG Export & Downloads:** Extended `downloadFile` object URL revocation timeout from 100ms to 2000ms to guarantee complete browser download initiation before URL disposal.
- **Properties Panel:** Maintained `e.stopPropagation()` on all panel controls so interactive clicks do not collapse the panel. Canvas empty space clicks trigger `onEmptyClick` to collapse the panel cleanly. Fixed collaboration broadcast in `Project.tsx` so style updates send the fresh modified shape instead of pre-dispatch state.

### 6. Full Verification Matrix
| Test Suite | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Frontend Tests** | `npm test` | **PASS (Exit 0)** | 32/32 tests passed across 6 test files |
| **Frontend Typecheck** | `npm run typecheck` | **PASS (Exit 0)** | 0 TypeScript errors |
| **Frontend Build** | `npm run build` | **PASS (Exit 0)** | Clean Vite SPA and SSR server builds |
| **C++ Unit Tests** | `.\cpp-engine\build\test_geometry.exe` | **PASS (Exit 0)** | All distance, intersection, and recognition checks pass |
| **Python Unit Tests** | `python -m unittest discover tests` | **PASS (Exit 0)** | 4/4 tests pass |
| **Git Diff Check** | `git diff --check` | **PASS (Exit 0)** | Clean diff with zero whitespace warnings |

### 7. Physical Hardware Checks Requiring Manual User Action
- **Physical Webcam Device Handle:** Automated test suite validates mock and simulated packet streaming. Because hardware webcam devices cannot be physically accessed by headless test runners, the user should:
  1. Ensure no other application (e.g. Zoom, Teams, Camera app) is holding an exclusive handle on camera device index 0.
  2. Launch `python vision/agent_server.py` in one terminal and `npm run dev` in `air-doodle-frontend`.
  3. Toggle "Start Camera" in the bottom-right panel and confirm live video appears in the thumbnail.
  4. Perform a right-hand index pinch to verify real-time continuous drawing following the fingertip.

---

## 16. Hand-Tracking System Completion & Camera Privacy Architecture (Phase VI — October 23, 2026)

### 1. Camera Privacy & Explicit User Permission Architecture
- **Root Cause & Architectural Shift**: Previously, starting `agent_server.py` immediately opened the webcam hardware, even with zero clients connected. Furthermore, visiting or refreshing the page could silently restart capture.
- **Implementation**:
  - Designated Python/OpenCV as the authoritative hardware capture owner, but kept the device **strictly OFF by default** on server launch (`cap = None`, `camera_state = "off"`).
  - Web application starts in `Camera Off` / `Permission Required` state. Camera capture begins **only** when the user explicitly clicks **"Allow Camera / Start Tracking"** in `CameraTrackingPanel.tsx`.
  - Implemented explicit loopback WebSocket protocol commands:
    - Client sends `{"action": "startCapture"}`: Server transitions state to `starting`, initializes OpenCV with DirectShow/default fallback, sets 640×480 resolution, and broadcasts `cameraStatus: active`.
    - Client sends `{"action": "stopCapture"}`: Server transitions state to `stopping`, immediately calls `cap.release()`, sets `cap = None`, stops frame acquisition, terminates active strokes cleanly, and broadcasts `cameraStatus: off`.
  - Automatic hardware release on:
    - Project page unmount (`useEffect` cleanup in `Project.tsx`).
    - User logout (`authService.logout()` in `auth.service.ts`).
    - Browser session closure (server detects client disconnection; when all authorized sessions disconnect, capture releases immediately).
    - WebSocket transport reconnection never silently restarts capture.
  - Implemented separate, distinct controls in `CameraTrackingPanel.tsx`:
    - "Hide Video Preview" / "Show Video Preview" toggles only the video box visibility without stopping tracking.
    - "Stop Camera" completely halts capture, releases hardware, and clears cursors.

### 2. Strict Left-Hand and Right-Hand Identification & Spatial Continuity
- **Root Cause & Mirroring Correction**:
  - Horizontal camera mirroring (`cv2.flip(frame, 1)`) causes MediaPipe's anatomical model to invert handedness labels (a physical Right hand appears anatomically as a Left hand).
  - Inverted the classification (`physical_hand = "Right" if raw_label == "Left" else "Left"`).
  - Extracted classification confidence score (`classification[0].score`) in `HandTracker.process()`.
  - Added spatial sorting by wrist X-coordinate: in mirrored selfie view, the user's physical Right hand is consistently positioned on the right side of the frame (higher X), and Left on the left (lower X).
- **Strict Role Separation**:
  - **Right Hand**: Exclusively controls index fingertip pointer, brush sizing, and drawing. Cannot initiate erasing.
  - **Left Hand**: Exclusively controls eraser pointer, eraser radius, and erasing. Cannot initiate drawing.

### 3. Continuous 1.0-Second Activation Hold & Intentional Release
- **Implementation**:
  - Implemented a debounced state machine requiring a continuous **1,000 milliseconds (1.0s)** pinch hold before `penDown` triggers.
  - Releasing or opening the pinch before the full second resets the activation timer immediately without drawing.
  - While holding, server broadcasts `action: "waiting"` with `holdProgress: 0.0 - 1.0` and `holdDuration: 1.0`.
  - When drawing begins, stroke width is **frozen** to prevent unintended thickness changes during the stroke.
  - When the user releases the pinch, the stroke finalizes cleanly (`penUp`, `strokeFinished`) precisely at the last valid fingertip coordinate. The next stroke requires another uninterrupted 1.0s hold.
  - Applied the identical 1.0s hold activation pattern to Left-hand erasing.

### 4. High-Contrast Master Hand Pointer & Zero Gesture Zoom
- **Canvas Pointer Rendering**:
  - Rendered a distinctive, high-contrast master hand pointer centered on the index fingertip on `<Canvas>`.
  - Features high-contrast double outline, pinpoint target dot, and state badge (`Move Pointer`, `Hold to Draw — 1.0s`, `Drawing`, `Erasing`).
  - When `action === "waiting"`, renders a circular SVG countdown progress ring (0% to 100%) around the pointer tip.
  - Strictly independent of mouse movement.
- **Removed Gesture Zoom**:
  - Finger spreading strictly controls brush width (Right hand: 2–24px) or eraser radius (Left hand: 10–60px). It never triggers camera or canvas zoom.

### 5. Native C++ Geometric Recognition Integration
- Verified the complete stroke pipeline:
  `Project.tsx` -> `recognizeStroke(strokePoints)` -> `POST /api/recognize` -> `geometryEngine.recognize(points)` -> `cpp-engine/build/airdoodle-geometry.exe`.
- Successfully distinguishes Lines, Rectangles/Squares, Circles, Triangles, and Unknown/Freehand strokes.
- Freehand and ambiguous strokes are safely preserved without destructive fallback.
- Recognized shapes inherit stroke width and color with explicit `fill: "none"` (no black fill artifacts).

### 6. Component & Service Modifications Breakdown
- **[`vision/agent_server.py`](file:///d:/VsCode/Projects/AirDoodle/vision/agent_server.py)**:
  - Hardware camera capture is completely inactive (`cap = None`, `camera_state = "off"`) on server startup.
  - Implemented loopback action dispatcher: handles `startCapture` and `stopCapture` WebSocket messages.
  - Mirrored handedness correction: flips raw MediaPipe labels (`"Right" if raw == "Left" else "Left"`).
  - Spatial wrist sorting across multiple hands to maintain continuous identity tracking.
  - State machine requiring an uninterrupted 1.0-second pinch hold before dispatching `penDown`, broadcasting continuous `holdProgress` updates (`0.0 - 1.0`).
  - Strict role isolation: Right hand only produces `action: "drawing"`; Left hand only produces `action: "erasing"`.
  - Stroke width freeze on draw activation.
  - Auto-releases hardware handle when all authorized WebSocket client connections terminate.
- **[`vision/tracking/hand_tracker.py`](file:///d:/VsCode/Projects/AirDoodle/vision/tracking/hand_tracker.py)**:
  - Added classification confidence score extraction (`classification.score`) from MediaPipe results.
- **[`client/services/vision.service.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/services/vision.service.ts)**:
  - Added `CameraState` type (`"off" | "starting" | "active" | "stopping" | "error"`).
  - Implemented explicit `startCapture()`, `stopCapture()`, and reactive `onCameraStatus()` subscribers.
  - Added loopback control ensuring reconnects never silently re-engage camera capture without user intent.
- **[`client/components/panels/CameraTrackingPanel.tsx`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/components/panels/CameraTrackingPanel.tsx)**:
  - Decoupled video preview toggling from camera hardware lifecycle.
  - Added 1.0s countdown progress bar for `action: "waiting"`.
  - Added primary "Allow Camera / Start Tracking" and "Stop Camera" controls with explicit status badges.
- **[`client/components/canvas/Canvas.tsx`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/components/canvas/Canvas.tsx)**:
  - Added high-contrast master hand cursor centered on the index fingertip.
  - Added circular SVG countdown progress ring during the 1.0s activation hold.
  - Renders live active polyline during continuous drawing.
- **[`client/pages/Project.tsx`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/pages/Project.tsx)**:
  - Fixed stale closure in WebSocket event subscriber by referencing latest handlers via mutable ref (`handleInputEventRef`).
  - Added automatic camera shutdown on unmount and navigation cleanup.
- **[`client/services/auth.service.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/services/auth.service.ts)**:
  - Ensures camera hardware is immediately stopped when user logs out.
- **[`tests/test_vision_agent.py`](file:///d:/VsCode/Projects/AirDoodle/tests/test_vision_agent.py)** & **[`client/services/vision.service.spec.ts`](file:///d:/VsCode/Projects/AirDoodle/air-doodle-frontend/client/services/vision.service.spec.ts)**:
  - Unit tests covering explicit camera activation, stop commands, privacy guarantees, and message schema validations.

### 7. Physical Hardware Acceptance Protocol
1. **Camera Off Default**: Launch `python vision/agent_server.py` and open the site; verify camera status is `Camera Off` and no webcam light turns on.
2. **Explicit Start**: Click **Allow Camera / Start Tracking** in the floating panel; verify camera status transitions `Starting -> Active` and preview appears.
3. **Right Hand Tracking**: Raise right hand; verify master pointer follows index fingertip on the canvas with label `Right Hand • Move Pointer`.
4. **Pinch Under 1s**: Pinch thumb and index for 0.5s and release; verify activation countdown ring resets with NO stroke drawn.
5. **Continuous 1.0s Hold to Draw**: Pinch and hold for 1.0s; verify countdown reaches 100%, transitions to `Drawing (W: Xpx)`, draws active live polyline, and releases cleanly at the last point when opened.
6. **Left Hand Erasing**: Raise left hand, hold pinch 1.0s; verify red dashed eraser circle appears and erases vector paths.
7. **Explicit Stop**: Click **Stop Camera** icon; verify capture immediately halts, webcam hardware releases, and cursor disappears.

### 8. Comprehensive Verification Matrix
| Test Suite | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Python Unit Tests** | `python -m unittest discover -s tests -v` | **PASS (5/5)** | Handshake, normalized events, gesture recognition, and explicit camera privacy/permission control |
| **Frontend Typecheck** | `npm run typecheck` | **PASS (Exit 0)** | 0 TypeScript errors across client, server, and shared contracts |
| **Frontend Unit Tests** | `npm test` | **PASS (37/37)** | 7 test suites passing: `vision.service`, `recognizer`, `shapeReducer`, `eraserGeometry`, `export`, `utils`, `geometry-engine` |
| **Frontend Production Build** | `npm run build` | **PASS (Exit 0)** | Vite SPA (`dist/spa`) and SSR server bundle (`dist/server/node-build.mjs`) generated cleanly |
| **C++ Geometry Engine** | `.\cpp-engine\build\test_geometry.exe` | **PASS (Exit 0)** | Native binary passed distance, intersection, transforms, and 4-shape recognition |
| **Git Diff Check** | `git diff --check` | **PASS (Exit 0)** | Clean diff with zero whitespace warnings |
