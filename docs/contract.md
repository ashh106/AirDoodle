# AirDoodle — Contract & Protocol Specifications

## 1. Canvas Coordinate System
- **Logical Bounds:** Exactly `1000` units wide by `700` units high.
- **Top-left:** `(0, 0)`
- **Bottom-right:** `(1000, 700)`
- **Input Normalization:** All inputs (mouse pointers, touchscreen coordinates, webcam hand coordinates) must be converted into this coordinate space at the ingestion boundary before processing.

---

## 2. Authoritative Shape Contract

Every shape adheres to the TypeScript discriminated union:

```typescript
export type ShapeType = "line" | "rectangle" | "circle" | "triangle" | "freehand";

export type Coordinate = [number, number];

export interface Point {
  x: number;
  y: number;
}

export interface ShapeStyle {
  stroke: string;        // Hex or CSS color string (e.g. "#ffffff")
  fill: string;          // Hex or "none"
  strokeWidth: number;   // In logical canvas units (e.g. 2)
}

export interface BaseShape<T extends ShapeType, G> {
  id: string;            // UUID v4 or persistent identifier
  type: T;
  geometry: G;
  rotation: number;      // Degrees (0 to 360)
  style: ShapeStyle;
  revision: number;      // Monotonically increasing revision counter
}

export type LineShape = BaseShape<"line", { x1: number; y1: number; x2: number; y2: number }>;
export type RectangleShape = BaseShape<"rectangle", { x: number; y: number; width: number; height: number }>;
export type CircleShape = BaseShape<"circle", { cx: number; cy: number; r: number }>;
export type TriangleShape = BaseShape<"triangle", { points: [Coordinate, Coordinate, Coordinate] }>;
export type FreehandShape = BaseShape<"freehand", { points: Coordinate[] }>;

export type Shape = LineShape | RectangleShape | CircleShape | TriangleShape | FreehandShape;
```

---

## 3. REST API Contract

### Authentication
- `POST /api/auth/register`
  - Body: `{ name: string, email: string, password: string }`
  - Response `201`: `{ user: { id: string, name: string, email: string }, token: string }`
- `POST /api/auth/login`
  - Body: `{ email: string, password: string }`
  - Response `200`: `{ user: { id: string, name: string, email: string }, token: string }`
- `GET /api/auth/me`
  - Header: `Authorization: Bearer <token>`
  - Response `200`: `{ user: { id: string, name: string, email: string } }`

### Projects
- `GET /api/projects`
  - Response `200`: `Project[]` where `Project = { id: string, title: string, createdAt: string, updatedAt: string }`
- `POST /api/projects`
  - Body: `{ title: string }`
  - Response `201`: `Project`
- `GET /api/projects/:id`
  - Response `200`: `{ id: string, title: string, createdAt: string, updatedAt: string, shapes: Shape[] }`
- `PUT /api/projects/:id`
  - Body: `{ title?: string, shapes?: Shape[] }`
  - Response `200`: `{ success: true, updatedAt: string }`
- `DELETE /api/projects/:id`
  - Response `200`: `{ success: true }`

---

## 4. Vision Agent WebSocket Protocol (`ws://localhost:8765`)

Events sent from the Python vision agent to the browser:

```json
{ "type": "cursorMoved", "x": 520, "y": 340 }
{ "type": "penDown", "x": 520, "y": 340 }
{ "type": "penUp", "x": 580, "y": 420 }
{ "type": "strokeFinished", "points": [{"x": 520, "y": 340}, {"x": 580, "y": 420}] }
```

Coordinates are normalized to `0..1000` for `x` and `0..700` for `y`.

---

## 5. C++ Geometry Engine Protocol (stdin/stdout JSON-lines)

Each message is a single-line JSON string followed by `\n`.

### Stroke Recognition Request
```json
{"id": "req-1", "action": "recognize", "points": [{"x": 100, "y": 100}, {"x": 400, "y": 100}]}
```
### Response
```json
{"id": "req-1", "success": true, "result": {"type": "line", "geometry": {"x1": 100, "y1": 100, "x2": 400, "y2": 100}}}
```

### Transformation Request (Translate / Scale / Rotate / Bounds)
```json
{"id": "req-2", "action": "bounds", "shape": {"type": "rectangle", "geometry": {"x": 100, "y": 100, "width": 200, "height": 150}, "rotation": 0}}
```
### Response
```json
{"id": "req-2", "success": true, "result": {"x": 100, "y": 100, "width": 200, "height": 150}}
```

---

## 6. Socket.io Collaboration Protocol

- `project:join`: `{ projectId: string, user: { id: string, name: string } }`
- `project:leave`: `{ projectId: string }`
- `shape:create`: `{ projectId: string, shape: Shape }`
- `shape:update`: `{ projectId: string, shape: Shape }`
- `shape:delete`: `{ projectId: string, id: string }`
- `cursor:move`: `{ projectId: string, x: number, y: number }`

Events emitted by server to room:
- `project:joined`: `{ projectId: string }`
- `user:joined`: `{ user: { id: string, name: string }, socketId: string }`
- `user:left`: `{ user: { id: string, name: string }, socketId: string }`
- `shape:created`: `Shape`
- `shape:updated`: `Shape`
- `shape:deleted`: `string` (id)
- `cursor:moved`: `{ user: { id: string, name: string }, socketId: string, x: number, y: number }`
