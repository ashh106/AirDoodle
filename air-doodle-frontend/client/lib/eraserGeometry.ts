import { Coordinate, Point, Shape } from "@/types/shape";

/**
 * Calculates Euclidean distance between two points.
 */
export const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Calculates perpendicular/minimum distance from point P to line segment AB.
 */
export const pointToSegmentDistance = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) return distance(p, a);

  // Project point p onto segment ab: p = a + t * (b - a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.hypot(p.x - projX, p.y - projY);
};

const shapeCenter = (shape: Shape): Point => {
  switch (shape.type) {
    case "line":
      return { x: (shape.geometry.x1 + shape.geometry.x2) / 2, y: (shape.geometry.y1 + shape.geometry.y2) / 2 };
    case "rectangle":
      return { x: shape.geometry.x + shape.geometry.width / 2, y: shape.geometry.y + shape.geometry.height / 2 };
    case "circle":
      return { x: shape.geometry.cx, y: shape.geometry.cy };
    case "triangle":
    case "freehand": {
      const xs = shape.geometry.points.map(([x]) => x);
      const ys = shape.geometry.points.map(([, y]) => y);
      return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    }
  }
};

const rotatePoint = (point: Point, center: Point, degrees: number): Point => {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
};

/**
 * Checks if a point is inside a polygon using ray casting.
 */
const pointInPolygon = (p: Point, polygon: Coordinate[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Accurate mathematical geometry hit-testing between an eraser circle at (center, radius)
 * and an arbitrary AirDoodle Shape.
 */
export const intersectsShape = (eraser: Point, radius: number, shape: Shape): boolean => {
  const strokePadding = (shape.style.strokeWidth || 2) / 2;
  const effectiveRadius = radius + strokePadding;

  switch (shape.type) {
    case "line": {
      const a = { x: shape.geometry.x1, y: shape.geometry.y1 };
      const b = { x: shape.geometry.x2, y: shape.geometry.y2 };
      return pointToSegmentDistance(eraser, a, b) <= effectiveRadius;
    }

    case "circle": {
      const distToCenter = Math.hypot(eraser.x - shape.geometry.cx, eraser.y - shape.geometry.cy);
      const r = shape.geometry.r;
      if (shape.style.fill && shape.style.fill !== "none") {
        return distToCenter <= r + effectiveRadius;
      }
      return Math.abs(distToCenter - r) <= effectiveRadius;
    }

    case "rectangle": {
      const center = shapeCenter(shape);
      // Un-rotate the eraser point into axis-aligned space
      const local = rotatePoint(eraser, center, -shape.rotation);
      const { x, y, width, height } = shape.geometry;

      const closestX = Math.max(x, Math.min(local.x, x + width));
      const closestY = Math.max(y, Math.min(local.y, y + height));
      const dist = Math.hypot(local.x - closestX, local.y - closestY);

      if (shape.style.fill && shape.style.fill !== "none") {
        return dist <= effectiveRadius;
      }

      // If hollow, check distance to 4 border segments
      const top = pointToSegmentDistance(local, { x, y }, { x: x + width, y });
      const right = pointToSegmentDistance(local, { x: x + width, y }, { x: x + width, y: y + height });
      const bottom = pointToSegmentDistance(local, { x, y: y + height }, { x: x + width, y: y + height });
      const left = pointToSegmentDistance(local, { x, y }, { x, y: y + height });

      return Math.min(top, right, bottom, left) <= effectiveRadius;
    }

    case "triangle": {
      const center = shapeCenter(shape);
      const local = rotatePoint(eraser, center, -shape.rotation);
      const pts = shape.geometry.points;

      if (shape.style.fill && shape.style.fill !== "none") {
        if (pointInPolygon(local, pts)) return true;
      }

      const p0 = { x: pts[0][0], y: pts[0][1] };
      const p1 = { x: pts[1][0], y: pts[1][1] };
      const p2 = { x: pts[2][0], y: pts[2][1] };

      const e1 = pointToSegmentDistance(local, p0, p1);
      const e2 = pointToSegmentDistance(local, p1, p2);
      const e3 = pointToSegmentDistance(local, p2, p0);

      return Math.min(e1, e2, e3) <= effectiveRadius;
    }

    case "freehand": {
      const pts = shape.geometry.points;
      if (pts.length === 0) return false;
      if (pts.length === 1) {
        return Math.hypot(eraser.x - pts[0][0], eraser.y - pts[0][1]) <= effectiveRadius;
      }

      for (let i = 0; i < pts.length - 1; i++) {
        const a = { x: pts[i][0], y: pts[i][1] };
        const b = { x: pts[i + 1][0], y: pts[i + 1][1] };
        if (pointToSegmentDistance(eraser, a, b) <= effectiveRadius) {
          return true;
        }
      }
      return false;
    }
  }
};

/**
 * Detail Eraser:
 * - For freehand paths: splits/trims the path at the erased region while preserving untouched segments.
 * - For geometric SVG shapes: adds a persistent vector mask cutout.
 */
export const applyDetailEraser = (
  eraser: Point,
  radius: number,
  shapes: Shape[]
): { updatedShapes: Shape[]; affected: boolean } => {
  let anyAffected = false;
  const result: Shape[] = [];

  for (const shape of shapes) {
    if (!intersectsShape(eraser, radius, shape)) {
      result.push(shape);
      continue;
    }

    anyAffected = true;

    if (shape.type === "freehand") {
      // Split freehand points into contiguous untouched runs
      const pts = shape.geometry.points;
      const runs: Coordinate[][] = [];
      let currentRun: Coordinate[] = [];

      for (const pt of pts) {
        const d = Math.hypot(eraser.x - pt[0], eraser.y - pt[1]);
        if (d > radius) {
          currentRun.push(pt);
        } else {
          if (currentRun.length > 0) {
            runs.push(currentRun);
            currentRun = [];
          }
        }
      }
      if (currentRun.length > 0) {
        runs.push(currentRun);
      }

      // Convert runs into preserved shapes
      runs.forEach((run, index) => {
        const normalizedRun: Coordinate[] = run.length === 1 ? [run[0], [run[0][0] + 0.1, run[0][1] + 0.1]] : run;
        if (index === 0) {
          result.push({
            ...shape,
            geometry: { points: normalizedRun },
            revision: shape.revision + 1,
          });
        } else {
          result.push({
            ...shape,
            id: crypto.randomUUID(),
            geometry: { points: normalizedRun },
            revision: 1,
          });
        }
      });
    } else {
      // Geometric shape: attach persistent vector mask cutout
      const existingMask = shape.mask || [];
      const newMask = [...existingMask, { cx: Math.round(eraser.x * 10) / 10, cy: Math.round(eraser.y * 10) / 10, r: radius }];
      result.push({
        ...shape,
        mask: newMask,
        revision: shape.revision + 1,
      });
    }
  }

  return { updatedShapes: result, affected: anyAffected };
};
