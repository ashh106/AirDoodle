import { Coordinate, Point, Shape, ShapeStyle, ShapeType, Tool } from "@shared/shape";

export * from "@shared/shape";

export interface ShapeState {
  past: Shape[][];
  present: Shape[];
  future: Shape[][];
}

export type ShapeAction =
  | { type: "load"; shapes: Shape[] }
  | { type: "create"; shape: Shape }
  | { type: "move"; id: string; dx: number; dy: number }
  | { type: "rotate"; id: string; rotation: number }
  | { type: "scale"; id: string; scaleX: number; scaleY: number; origin: Point }
  | { type: "updateStyle"; id: string; style: Partial<ShapeStyle> }
  | { type: "delete"; id: string }
  | { type: "undo" }
  | { type: "redo" };
