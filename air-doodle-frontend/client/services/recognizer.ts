import { Point, Shape } from "@/types/shape";

const defaultStyle = { stroke: "#ffffff", fill: "none", strokeWidth: 2 };

export const recognizeStroke = async (points: Point[]): Promise<Shape> => {
  // First attempt backend C++ engine recognition if running in browser
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
      });

      if (res.ok) {
        const shape: Shape = await res.json();
        return shape;
      }
    } catch {
      // Heuristic fallback
    }
  }

  // Client-side heuristic fallback with accurate geometric checks
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const diag = Math.hypot(width, height);
  const id = crypto.randomUUID();

  const freehandFallback: Shape = {
    id,
    type: "freehand",
    geometry: { points: points.map(p => [p.x, p.y]) },
    rotation: 0,
    style: defaultStyle,
    revision: 1,
  };

  if (points.length < 2 || diag < 10) return freehandFallback;

  const start = points[0];
  const end = points[points.length - 1];
  const directDist = Math.hypot(end.x - start.x, end.y - start.y);
  let totalPathLength = 0;
  for (let i = 1; i < points.length; i++) {
    totalPathLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }

  const isClosed = directDist / Math.max(diag, 1) < 0.28 || directDist < 40;

  // Line check: straight path and not closed
  if (!isClosed && directDist > 20 && totalPathLength / directDist < 1.15 && directDist / diag > 0.82) {
    return {
      id,
      type: "line",
      geometry: { x1: start.x, y1: start.y, x2: end.x, y2: end.y },
      rotation: 0,
      style: defaultStyle,
      revision: 1,
    };
  }

  if (!isClosed) return freehandFallback;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const expectedRadius = (width + height) / 4;
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);
  const aspectDiff = maxDim > 0 ? (maxDim - minDim) / maxDim : 1;

  // Compute radial distances
  let sumDist = 0;
  let minR = Infinity;
  let maxR = 0;
  for (const p of points) {
    const d = Math.hypot(p.x - cx, p.y - cy);
    sumDist += d;
    if (d < minR) minR = d;
    if (d > maxR) maxR = d;
  }
  const meanR = sumDist / points.length;
  let sumSq = 0;
  for (const p of points) {
    const d = Math.hypot(p.x - cx, p.y - cy);
    sumSq += (d - meanR) * (d - meanR);
  }
  const stdDevR = Math.sqrt(sumSq / points.length);
  const radialCV = meanR > 0 ? stdDevR / meanR : 1;
  const radialRatio = minR > 0 ? maxR / minR : 2;

  // Area via shoelace
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  area = Math.abs(area) / 2;
  const circularity = totalPathLength > 0 ? (4 * Math.PI * area) / (totalPathLength * totalPathLength) : 0;
  const fillRatio = (width * height) > 0 ? area / (width * height) : 0;

  // Circle check: high circularity, low radial CV, balanced aspect ratio
  if (points.length >= 8 && aspectDiff <= 0.22 && radialCV < 0.10 && radialRatio < 1.25 && circularity > 0.70) {
    return {
      id,
      type: "circle",
      geometry: { cx, cy, r: expectedRadius },
      rotation: 0,
      style: defaultStyle,
      revision: 1,
    };
  }

  // Triangle check: 3 corners / vertex distribution and fill ratio
  if (width > 20 && height > 20 && fillRatio <= 0.70) {
    let upper = 0;
    let lower = 0;
    for (const p of points) {
      if (p.y < minY + height * 0.35) upper++;
      if (p.y > minY + height * 0.65) lower++;
    }
    if ((upper <= 2 && lower >= 2) || (lower <= 2 && upper >= 2)) {
      const top = { x: cx, y: minY };
      const right = { x: maxX, y: maxY };
      const left = { x: minX, y: maxY };
      return {
        id,
        type: "triangle",
        geometry: { points: [[top.x, top.y], [right.x, right.y], [left.x, left.y]] },
        rotation: 0,
        style: defaultStyle,
        revision: 1,
      };
    }
  }

  // Rectangle check: covers all four quadrants
  if (width > 20 && height > 20) {
    let tl = false, tr = false, br = false, bl = false;
    const mx = width * 0.38;
    const my = height * 0.38;
    for (const p of points) {
      if (p.x <= minX + mx && p.y <= minY + my) tl = true;
      if (p.x >= maxX - mx && p.y <= minY + my) tr = true;
      if (p.x >= maxX - mx && p.y >= maxY - my) br = true;
      if (p.x <= minX + mx && p.y >= maxY - my) bl = true;
    }
    if (tl && tr && br && bl) {
      return {
        id,
        type: "rectangle",
        geometry: { x: minX, y: minY, width, height },
        rotation: 0,
        style: defaultStyle,
        revision: 1,
      };
    }
  }

  // Ambiguous: return original freehand stroke
  return freehandFallback;
};
