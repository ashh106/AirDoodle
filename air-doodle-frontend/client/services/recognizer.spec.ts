import { describe, expect, it } from "vitest";
import { recognizeStroke } from "@/services/recognizer";

describe("recognizeStroke", () => {
  it("recognizes a straight path as a line", async () => {
    const shape = await recognizeStroke([
      { x: 10, y: 10 },
      { x: 50, y: 10 },
      { x: 100, y: 10 },
    ]);
    expect(shape.type).toBe("line");
    expect(shape.revision).toBe(1);
  });

  it("recognizes a closed 4-corner box as a rectangle", async () => {
    const shape = await recognizeStroke([
      { x: 10, y: 10 },
      { x: 110, y: 10 },
      { x: 110, y: 110 },
      { x: 10, y: 110 },
      { x: 10, y: 10 },
    ]);
    expect(shape.type).toBe("rectangle");
  });

  it("recognizes points sampled along a circle as a circle", async () => {
    const points = [];
    const cx = 100;
    const cy = 100;
    const r = 50;
    for (let i = 0; i <= 16; i++) {
      const theta = (i * 2 * Math.PI) / 16;
      points.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
    }
    const shape = await recognizeStroke(points);
    expect(shape.type).toBe("circle");
  });

  it("recognizes a closed 3-corner shape as a triangle", async () => {
    const shape = await recognizeStroke([
      { x: 100, y: 20 },
      { x: 180, y: 160 },
      { x: 20, y: 160 },
      { x: 100, y: 20 },
    ]);
    expect(shape.type).toBe("triangle");
  });

  it("returns original freehand for ambiguous squiggle strokes", async () => {
    const shape = await recognizeStroke([
      { x: 10, y: 10 },
      { x: 20, y: 50 },
      { x: 80, y: 20 },
      { x: 40, y: 90 },
      { x: 90, y: 100 },
    ]);
    expect(shape.type).toBe("freehand");
  });
});
