import { Point, Shape } from "@/types/shape";

export const VIEW_W = 1000;
export const VIEW_H = 700;
export const MIN_SCALE = 0.2;
export const MAX_SCALE = 8;

export interface Viewport {
  originX: number;
  originY: number;
  scale: number;
}

export const defaultViewport = (): Viewport => ({ originX: 0, originY: 0, scale: 1 });

export const clampScale = (scale: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

export const viewBoxString = (vp: Viewport): string => {
  const w = VIEW_W / vp.scale;
  const h = VIEW_H / vp.scale;
  return `${vp.originX} ${vp.originY} ${w} ${h}`;
};

/** Map vision/camera coordinates (logical 1000x700 of the visible viewport) into world space. */
export const visionToWorld = (vx: number, vy: number, vp: Viewport): Point => ({
  x: vp.originX + (vx / VIEW_W) * (VIEW_W / vp.scale),
  y: vp.originY + (vy / VIEW_H) * (VIEW_H / vp.scale),
});

export const worldToVision = (point: Point, vp: Viewport): Point => ({
  x: (point.x - vp.originX) * vp.scale,
  y: (point.y - vp.originY) * vp.scale,
});

export const zoomToward = (vp: Viewport, nextScale: number, fx: number, fy: number): Viewport => {
  const scale = clampScale(nextScale);
  const worldX = vp.originX + fx * (VIEW_W / vp.scale);
  const worldY = vp.originY + fy * (VIEW_H / vp.scale);
  return {
    scale,
    originX: worldX - fx * (VIEW_W / scale),
    originY: worldY - fy * (VIEW_H / scale),
  };
};

export const panBy = (vp: Viewport, dxWorld: number, dyWorld: number): Viewport => ({
  ...vp,
  originX: vp.originX + dxWorld,
  originY: vp.originY + dyWorld,
});

const shapeExtents = (shape: Shape): { minX: number; minY: number; maxX: number; maxY: number } => {
  switch (shape.type) {
    case "line":
      return {
        minX: Math.min(shape.geometry.x1, shape.geometry.x2),
        minY: Math.min(shape.geometry.y1, shape.geometry.y2),
        maxX: Math.max(shape.geometry.x1, shape.geometry.x2),
        maxY: Math.max(shape.geometry.y1, shape.geometry.y2),
      };
    case "rectangle":
      return {
        minX: shape.geometry.x,
        minY: shape.geometry.y,
        maxX: shape.geometry.x + shape.geometry.width,
        maxY: shape.geometry.y + shape.geometry.height,
      };
    case "circle":
      return {
        minX: shape.geometry.cx - shape.geometry.r,
        minY: shape.geometry.cy - shape.geometry.r,
        maxX: shape.geometry.cx + shape.geometry.r,
        maxY: shape.geometry.cy + shape.geometry.r,
      };
    default: {
      const xs = shape.geometry.points.map(([x]) => x);
      const ys = shape.geometry.points.map(([, y]) => y);
      return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }
  }
};

export const fitToContent = (shapes: Shape[], padding = 80): Viewport => {
  if (!shapes.length) return defaultViewport();
  const extents = shapes.map(shapeExtents);
  const minX = Math.min(...extents.map((e) => e.minX)) - padding;
  const minY = Math.min(...extents.map((e) => e.minY)) - padding;
  const maxX = Math.max(...extents.map((e) => e.maxX)) + padding;
  const maxY = Math.max(...extents.map((e) => e.maxY)) + padding;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = clampScale(Math.min(VIEW_W / width, VIEW_H / height));
  return { originX: minX, originY: minY, scale };
};
