# AirDoodle — System Architecture & Integration Map

## 1. Process & Runtime Architecture
- **Web App & API Server (`air-doodle-frontend`):**
  - Dev: `npx pnpm dev` runs Vite development server with integrated Express backend middleware on port 8080 (or dynamically assigned port).
  - Prod: `npx pnpm build` builds client (`dist/spa`) and server (`dist/server/node-build.mjs`). `npx pnpm start` launches Node.js serving static assets and API routes.
- **Vision Agent (`vision/`):**
  - Local Python process running on the user's workstation. Uses OpenCV to capture the local webcam stream and MediaPipe Hands to detect landmarks.
  - Exposes a local WebSocket server at `ws://localhost:8765` broadcasting normalized gesture input events (`cursorMoved`, `penDown`, `penUp`, `strokeFinished`).
  - Webcam frames are strictly processed on the client workstation and never uploaded to the backend server.
- **Geometry Engine (`cpp-engine/`):**
  - Compiled C++17 binary managed as a persistent child process via standard input and standard output (JSON-lines protocol) by the Express backend.
  - Executes stroke recognition, affine transformations (translation, rotation, scaling), bounding box calculations, segment intersections, and distance computations.

---

## 2. Frontend Routing & Page Hierarchy
- `/` — Public Landing Page (`client/pages/Index.tsx`).
- `/login` — User authentication login page (`client/pages/Login.tsx`).
- `/register` — User registration page (`client/pages/Register.tsx`).
- `/dashboard` — Protected workspace dashboard (`client/pages/Dashboard.tsx`) with project list, search, creation, and deletion.
- `/project/:id` — Protected canvas workspace (`client/pages/Project.tsx`) containing:
  - Topbar (project title, persistence status, SVG export).
  - Canvas (1000 × 700 logical SVG viewport, shape rendering, selection, transforms, mouse/gesture drawing).
  - Floating Toolbar (tool selection: select, draw, line, rectangle, circle, triangle).
  - Properties Panel (current tool, input source, rotation, shape metadata, delete).
  - Footer (shape count, undo, redo).
- `*` — 404 Not Found Page (`client/pages/NotFound.tsx`).

---

## 3. Project Persistence & State Ownership
- The authoritative owner of committed project geometry is the backend server.
- **Backend Persistence Storage:** The active implementation uses an atomic JSON file store (`server/data/air-doodle-db.json`) with in-memory caching and disk synchronization. This guarantees zero-dependency instant startup for local development and edge deployments.
- **PostgreSQL Provisioning:** `docker-compose.yml` provisions PostgreSQL 16 on port 5432 and injects `DATABASE_URL`. The current application layer relies on the file store as its active engine; direct SQL integration is planned as a future enterprise database adapter.
- In-flight transient states (pointer cursor coordinates, incomplete strokes) exist strictly in browser/client memory and are not persisted.
- Committed shape mutations (create, move, scale, rotate, delete) advance a numeric `revision` counter to ensure deterministic ordering and conflict prevention.
- Fallback local persistence (`localStorage`) is maintained in client services if offline or if backend is unreachable, with transparent sync to the server.

---

## 4. Services Classification (Real vs Mock)
- **Auth Service:**
  - Real: Session token storage, authorization header transmission, registration/login requests to `/api/auth/*`.
  - Fallback: Local user profile emulation when backend offline.
- **Project Service:**
  - Real: RESTful endpoints `/api/projects` and `/api/projects/:id` for listing, creating, loading, updating, and deleting projects.
  - Fallback: LocalStorage cache for offline editing.
- **Stroke Recognition:**
  - Real: Delegated to `/api/recognize` backed by the C++ engine (with local heuristic fallback in client if offline).
- **Collaboration Service:**
  - Real: Socket.io room connection on `project:${projectId}` broadcasting shape mutations.

---

## 5. System Data Flow Diagram

```mermaid
graph TD
    subgraph Client Workstation
        Webcam[Webcam Video Feed] -->|Frames| VisionAgent[Python MediaPipe Agent\nws://localhost:8765]
        Mouse[Mouse / Pen Input] --> BrowserInput[Unified Input Pipeline]
        VisionAgent -->|WS Events\n(0-1000, 0-700)| BrowserInput
        BrowserInput --> Canvas[React SVG Canvas\nViewBox 0 0 1000 700]
        Canvas --> ShapeReducer[Shape Reducer\n(Undo/Redo, Revisions)]
    end

    subgraph AirDoodle Web & Server
        Canvas <-->|REST API\n/api/projects| Server[Express Server]
        Canvas <-->|Socket.io\nproject:room| Server
        Server <-->|stdin/stdout\nJSON-lines| CppEngine[C++17 Geometry Engine]
        Server <-->|Persistence| DB[(PostgreSQL / File Store)]
    end
```
