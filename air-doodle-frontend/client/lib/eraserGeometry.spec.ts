import { describe, expect, it } from "vitest";
import { intersectsShape, applyDetailEraser } from "./eraserGeometry";
import { LineShape, RectangleShape, CircleShape, TriangleShape, FreehandShape } from "@/types/shape";

describe("eraserGeometry", () => {
  const line: LineShape = {
    id: "l1",
    type: "line",
    geometry: { x1: 100, y1: 100, x2: 300, y2: 100 },
    rotation: 0,
    style: { stroke: "#fff", fill: "none", strokeWidth: 2 },
    revision: 1,
  };

  const rect: RectangleShape = {
    id: "r1",
    type: "rectangle",
    geometry: { x: 50, y: 50, width: 100, height: 100 },
    rotation: 0,
    style: { stroke: "#fff", fill: "none", strokeWidth: 2 },
    revision: 1,
  };

  const circle: CircleShape = {
    id: "c1",
    type: "circle",
    geometry: { cx: 200, cy: 200, r: 50 },
    rotation: 0,
    style: { stroke: "#fff", fill: "none", strokeWidth: 2 },
    revision: 1,
  };

  const triangle: TriangleShape = {
    id: "t1",
    type: "triangle",
    geometry: {
      points: [
        [200, 100],
        [250, 200],
        [150, 200],
      ],
    },
    rotation: 0,
    style: { stroke: "#fff", fill: "none", strokeWidth: 2 },
    revision: 1,
  };

  const freehand: FreehandShape = {
    id: "f1",
    type: "freehand",
    geometry: {
      points: [
        [0, 50],
        [50, 50],
        [100, 50],
        [150, 50],
        [200, 50],
      ],
    },
    rotation: 0,
    style: { stroke: "#fff", fill: "none", strokeWidth: 2 },
    revision: 1,
  };

  describe("intersectsShape (Object Eraser hit testing)", () => {
    it("accurately intersects line when touching and rejects when far", () => {
      expect(intersectsShape({ x: 200, y: 105 }, 10, line)).toBe(true);
      expect(intersectsShape({ x: 200, y: 150 }, 10, line)).toBe(false);
    });

    it("accurately intersects hollow rectangle borders", () => {
      // Touching top border
      expect(intersectsShape({ x: 100, y: 52 }, 10, rect)).toBe(true);
      // Far outside
      expect(intersectsShape({ x: 300, y: 300 }, 10, rect)).toBe(false);
      // Center of hollow rectangle (fill="none") should NOT intersect if radius < 40
      expect(intersectsShape({ x: 100, y: 100 }, 10, rect)).toBe(false);
    });

    it("accurately intersects circle circumference", () => {
      expect(intersectsShape({ x: 250, y: 200 }, 10, circle)).toBe(true);
      expect(intersectsShape({ x: 200, y: 200 }, 10, circle)).toBe(false); // inside hollow circle
      expect(intersectsShape({ x: 400, y: 400 }, 10, circle)).toBe(false); // far outside
    });

    it("accurately intersects triangle edge", () => {
      expect(intersectsShape({ x: 200, y: 200 }, 10, triangle)).toBe(true); // bottom edge
      expect(intersectsShape({ x: 50, y: 50 }, 10, triangle)).toBe(false);
    });

    it("accurately intersects freehand stroke", () => {
      expect(intersectsShape({ x: 100, y: 50 }, 10, freehand)).toBe(true);
      expect(intersectsShape({ x: 100, y: 150 }, 10, freehand)).toBe(false);
    });
  });

  describe("applyDetailEraser", () => {
    it("splits freehand paths at the touched region and preserves untouched segments", () => {
      // Erase around point [100, 50] with radius 15
      const { updatedShapes, affected } = applyDetailEraser({ x: 100, y: 50 }, 15, [freehand]);
      expect(affected).toBe(true);
      // Freehand should split into 2 separate segments: [0, 50] -> [50, 50] and [150, 50] -> [200, 50]
      expect(updatedShapes.length).toBe(2);
      expect(updatedShapes[0].type).toBe("freehand");
      expect(updatedShapes[1].type).toBe("freehand");
      if (updatedShapes[0].type === "freehand") {
        expect(updatedShapes[0].geometry.points).toEqual([
          [0, 50],
          [50, 50],
        ]);
      }
      if (updatedShapes[1].type === "freehand") {
        expect(updatedShapes[1].geometry.points).toEqual([
          [150, 50],
          [200, 50],
        ]);
      }
    });

    it("adds persistent vector mask cutouts to geometric shapes without deleting them", () => {
      const { updatedShapes, affected } = applyDetailEraser({ x: 100, y: 52 }, 15, [rect]);
      expect(affected).toBe(true);
      expect(updatedShapes.length).toBe(1);
      const updatedRect = updatedShapes[0];
      expect(updatedRect.id).toBe(rect.id);
      expect(updatedRect.mask).toBeDefined();
      expect(updatedRect.mask!.length).toBe(1);
      expect(updatedRect.mask![0]).toEqual({ cx: 100, cy: 52, r: 15 });
    });
  });
});
