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

  // Client-side heuristic fallback
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const id = crypto.randomUUID();

  if (Math.min(width, height) < Math.max(width, height) * 0.12) {
    return {
      id,
      type: "line",
      geometry: { x1: points[0].x, y1: points[0].y, x2: points[points.length - 1].x, y2: points[points.length - 1].y },
      rotation: 0,
      style: defaultStyle,
      revision: 1,
    };
  }

  if (Math.abs(width - height) <= Math.max(width, height) * 0.2) {
    return {
      id,
      type: "circle",
      geometry: { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, r: Math.max(width, height) / 2 },
      rotation: 0,
      style: defaultStyle,
      revision: 1,
    };
  }

  return {
    id,
    type: "rectangle",
    geometry: { x: minX, y: minY, width, height },
    rotation: 0,
    style: defaultStyle,
    revision: 1,
  };
};
