# AirDoodle

AirDoodle is a dark-mode 2D design workspace prototype. The current frontend provides mouse-driven shape drawing, local stroke recognition, editable SVG shapes, project storage in localStorage, mock login, and SVG export. Authentication and project services are local mocks; there is no connected API, database, webcam agent, or realtime collaboration service.

## Stack

- React 18, TypeScript, Vite, and React Router 6
- Tailwind CSS 3 for styling and Framer Motion for existing UI animation
- Lucide React icons
- React hooks and a typed reducer for shape state
- Vitest for unit tests

## Structure

```text
client/
├── components/canvas/       SVG workspace and pointer input
├── components/layout/       Project editor header
├── components/panels/       Shape properties and rotation
├── components/toolbar/      Implemented shape tools
├── context/                 Mock authentication state
├── pages/                   Landing, auth, dashboard, and project pages
├── services/                Mock auth/project data, stroke recognition, SVG export
├── state/                   Shape reducer and reducer tests
└── types/                   Project, input, user, and discriminated shape types
```

## Workspace flow

`Project.tsx` loads project details through `project.service.ts` and stores shapes through `shapeReducer.ts`. `Canvas.tsx` maps mouse coordinates into the fixed 1000 × 700 SVG viewBox. Shape tools create typed shapes; Draw sends the finished point list to `recognizer.ts`, a temporary bounding-box-based local mock. Selection supports moving, corner scaling, rotating, Delete, and Ctrl+Z/Ctrl+Y. `svgExport.ts` serializes the current shapes for download.

Projects and shapes persist in browser localStorage via `listProjects`, `createProject`, `loadProject`, and `saveProject`. Authentication remains mocked by `auth.service.ts` and `AuthContext.tsx`. `.env.example` documents the future API and vision WebSocket settings; Stage A does not connect either service.

## Commands

Use pnpm, as specified by `package.json`:

```sh
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

There is no lint script configured in `package.json`.
