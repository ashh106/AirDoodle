export type ShapeType = "line" | "rectangle" | "circle" | "triangle" | "freehand";

export interface Point {
  x: number;
  y: number;
}

export type Coordinate = [number, number];

export interface ShapeStyle {
  stroke: string;
  fill: string;
  strokeWidth: number;
}

export interface ShapeBase<T extends ShapeType, G> {
  id: string;
  type: T;
  geometry: G;
  rotation: number;
  style: ShapeStyle;
  revision: number;
}

export type LineShape = ShapeBase<"line", { x1: number; y1: number; x2: number; y2: number }>;
export type RectangleShape = ShapeBase<"rectangle", { x: number; y: number; width: number; height: number }>;
export type CircleShape = ShapeBase<"circle", { cx: number; cy: number; r: number }>;
export type TriangleShape = ShapeBase<"triangle", { points: [Coordinate, Coordinate, Coordinate] }>;
export type FreehandShape = ShapeBase<"freehand", { points: Coordinate[] }>;
export type Shape = LineShape | RectangleShape | CircleShape | TriangleShape | FreehandShape;

export type Tool = "select" | "pen" | "eraser" | "draw" | "line" | "rectangle" | "circle" | "triangle";
