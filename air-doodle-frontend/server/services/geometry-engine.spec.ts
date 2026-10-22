import { describe, it, expect } from "vitest";
import { geometryEngine } from "./geometry-engine";

describe("GeometryEngineService Integration (Node <-> C++ Engine)", () => {
  it("recognizes a line via geometry engine", async () => {
    const res = await geometryEngine.recognize([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(res.type).toBe("line");
    if (res.type === "line") {
      expect(res.geometry.x1).toBe(0);
      expect(res.geometry.y1).toBe(0);
      expect(res.geometry.x2).toBe(100);
      expect(res.geometry.y2).toBe(0);
    }
  });

  it("recognizes a closed 4-corner box as a rectangle", async () => {
    const res = await geometryEngine.recognize([
      { x: 10, y: 10 },
      { x: 110, y: 10 },
      { x: 110, y: 90 },
      { x: 10, y: 90 },
      { x: 10, y: 10 },
    ]);
    expect(res.type).toBe("rectangle");
    if (res.type === "rectangle") {
      expect(res.geometry.width).toBe(100);
      expect(res.geometry.height).toBe(80);
    }
  });

  it("recognizes a circle shape", async () => {
    const points = [];
    const cx = 150;
    const cy = 150;
    const r = 50;
    for (let i = 0; i <= 24; i++) {
      const theta = (i * 2 * Math.PI) / 24;
      points.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
    }
    const res = await geometryEngine.recognize(points);
    expect(res.type).toBe("circle");
    if (res.type === "circle") {
      expect(Math.abs(res.geometry.cx - cx)).toBeLessThan(5);
      expect(Math.abs(res.geometry.cy - cy)).toBeLessThan(5);
      expect(Math.abs(res.geometry.r - r)).toBeLessThan(5);
    }
  });

  it("recognizes a triangle shape", async () => {
    const res = await geometryEngine.recognize([
      { x: 100, y: 20 },
      { x: 180, y: 160 },
      { x: 20, y: 160 },
      { x: 100, y: 20 },
    ]);
    expect(res.type).toBe("triangle");
    if (res.type === "triangle") {
      expect(res.geometry.points.length).toBe(3);
    }
  });

  it("returns original freehand on ambiguous squiggly stroke", async () => {
    const res = await geometryEngine.recognize([
      { x: 10, y: 10 },
      { x: 50, y: 90 },
      { x: 20, y: 40 },
      { x: 80, y: 10 },
      { x: 90, y: 100 },
    ]);
    expect(res.type).toBe("freehand");
    if (res.type === "freehand") {
      expect(res.geometry.points.length).toBe(5);
    }
  });
});
