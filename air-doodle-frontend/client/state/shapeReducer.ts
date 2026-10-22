import { Coordinate, Point, Shape, ShapeAction, ShapeState } from "@/types/shape";

export const initialShapeState = (shapes: Shape[] = []): ShapeState => ({ past: [], present: shapes, future: [] });

const transformPoint = (point: Point, origin: Point, scaleX: number, scaleY: number): Point => ({
  x: origin.x + (point.x - origin.x) * scaleX,
  y: origin.y + (point.y - origin.y) * scaleY,
});

const moveShape = (shape: Shape, dx: number, dy: number): Shape => {
  switch (shape.type) {
    case "line": return { ...shape, geometry: { x1: shape.geometry.x1 + dx, y1: shape.geometry.y1 + dy, x2: shape.geometry.x2 + dx, y2: shape.geometry.y2 + dy } };
    case "rectangle": return { ...shape, geometry: { ...shape.geometry, x: shape.geometry.x + dx, y: shape.geometry.y + dy } };
    case "circle": return { ...shape, geometry: { ...shape.geometry, cx: shape.geometry.cx + dx, cy: shape.geometry.cy + dy } };
    case "triangle": return { ...shape, geometry: { points: shape.geometry.points.map(([x, y]) => [x + dx, y + dy]) as [Coordinate, Coordinate, Coordinate] } };
    case "freehand": return { ...shape, geometry: { points: shape.geometry.points.map(([x, y]) => [x + dx, y + dy]) } };
  }
};

const scaleShape = (shape: Shape, scaleX: number, scaleY: number, origin: Point): Shape => {
  switch (shape.type) {
    case "line": return { ...shape, geometry: {
      x1: origin.x + (shape.geometry.x1 - origin.x) * scaleX,
      y1: origin.y + (shape.geometry.y1 - origin.y) * scaleY,
      x2: origin.x + (shape.geometry.x2 - origin.x) * scaleX,
      y2: origin.y + (shape.geometry.y2 - origin.y) * scaleY,
    } };
    case "rectangle": {
      const first = transformPoint({ x: shape.geometry.x, y: shape.geometry.y }, origin, scaleX, scaleY);
      const second = transformPoint({ x: shape.geometry.x + shape.geometry.width, y: shape.geometry.y + shape.geometry.height }, origin, scaleX, scaleY);
      return { ...shape, geometry: { x: Math.min(first.x, second.x), y: Math.min(first.y, second.y), width: Math.abs(second.x - first.x), height: Math.abs(second.y - first.y) } };
    }
    case "circle": return { ...shape, geometry: {
      cx: origin.x + (shape.geometry.cx - origin.x) * scaleX,
      cy: origin.y + (shape.geometry.cy - origin.y) * scaleY,
      r: shape.geometry.r * Math.min(Math.abs(scaleX), Math.abs(scaleY)),
    } };
    case "triangle": return { ...shape, geometry: { points: shape.geometry.points.map(([x, y]) => { const point = transformPoint({ x, y }, origin, scaleX, scaleY); return [point.x, point.y]; }) as [Coordinate, Coordinate, Coordinate] } };
    case "freehand": return { ...shape, geometry: { points: shape.geometry.points.map(([x, y]) => { const point = transformPoint({ x, y }, origin, scaleX, scaleY); return [point.x, point.y]; }) } };
  }
};

const commit = (state: ShapeState, present: Shape[]): ShapeState => ({ past: [...state.past, state.present], present, future: [] });

const restoreShapes = (current: Shape[], target: Shape[]): Shape[] => target.map(shape => {
  const previous = current.find(item => item.id === shape.id);
  if (!previous) return { ...shape, revision: shape.revision + 1 };
  const { revision: previousRevision, ...previousContent } = previous;
  const { revision: targetRevision, ...targetContent } = shape;
  if (JSON.stringify(previousContent) === JSON.stringify(targetContent)) return previous;
  return { ...shape, revision: Math.max(previousRevision, targetRevision) + 1 };
});

export const shapeReducer = (state: ShapeState, action: ShapeAction): ShapeState => {
  switch (action.type) {
    case "load": return initialShapeState(action.shapes);
    case "create": return commit(state, [...state.present, { ...action.shape, revision: 1 }]);
    case "move": {
      if ((!action.dx && !action.dy) || !state.present.some(shape => shape.id === action.id)) return state;
      return commit(state, state.present.map(shape => shape.id === action.id ? { ...moveShape(shape, action.dx, action.dy), revision: shape.revision + 1 } : shape));
    }
    case "rotate": {
      const shape = state.present.find(item => item.id === action.id);
      if (!shape || shape.rotation === action.rotation) return state;
      return commit(state, state.present.map(item => item.id === action.id ? { ...item, rotation: action.rotation, revision: item.revision + 1 } : item));
    }
    case "scale": {
      if ((action.scaleX === 1 && action.scaleY === 1) || !state.present.some(shape => shape.id === action.id)) return state;
      return commit(state, state.present.map(shape => shape.id === action.id ? { ...scaleShape(shape, action.scaleX, action.scaleY, action.origin), revision: shape.revision + 1 } : shape));
    }
    case "updateStyle": {
      const target = state.present.find(s => s.id === action.id);
      if (!target) return state;
      return commit(
        state,
        state.present.map(s =>
          s.id === action.id
            ? { ...s, style: { ...s.style, ...action.style }, revision: s.revision + 1 }
            : s
        )
      );
    }
    case "delete": {
      const shapes = state.present.filter(shape => shape.id !== action.id);
      return shapes.length === state.present.length ? state : commit(state, shapes);
    }
    case "undo": {
      if (!state.past.length) return state;
      const present = restoreShapes(state.present, state.past[state.past.length - 1]);
      return { past: state.past.slice(0, -1), present, future: [state.present, ...state.future] };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...future] = state.future;
      return { past: [...state.past, state.present], present: restoreShapes(state.present, next), future };
    }
  }
};
