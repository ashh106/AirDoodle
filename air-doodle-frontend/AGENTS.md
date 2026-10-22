# AirDoodle Workspace & Full-Stack System

AirDoodle is a gesture-driven 2D design workspace featuring synchronized multi-user canvas editing, persistent projects, C++ geometry acceleration, and local OpenCV/MediaPipe computer vision hand tracking.

## Architecture

```
air-doodle-frontend/
├── client/                   # React 18 SPA frontend
│   ├── pages/                # Route components (Index, Login, Register, Dashboard, Project)
│   ├── components/           # Canvas, toolbar, layout, properties panels, ui library
│   ├── context/              # AuthContext (real auth with offline fallback)
│   ├── services/             # API services (auth, project, recognizer, vision, svgExport)
│   ├── state/                # shapeReducer (undo/redo, revisions, affine transforms)
│   └── types/                # Authoritative shape, user, input contracts
├── server/                   # Node.js + Express API backend & Socket.io server
│   ├── index.ts              # Express routes & Socket.io integration
│   ├── routes/               # Auth, project CRUD, recognition endpoints
│   └── services/             # Storage & C++ geometry engine subprocess manager
└── shared/                   # Shared contracts (types, protocol definitions)
```

## Available Scripts

- `pnpm dev` — Start Vite client + Express API server concurrently
- `pnpm build` — Build production client SPA and server bundle
- `pnpm start` — Run production server
- `pnpm test` — Run Vitest suite
- `pnpm typecheck` — Run TypeScript compiler verification
