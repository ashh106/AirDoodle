import { describe, expect, it } from "vitest";
import {
  defaultViewport,
  fitToContent,
  panBy,
  visionToWorld,
  worldToVision,
  zoomToward,
} from "./viewport";
import { Shape } from "@/types/shape";

describe("viewport transforms", () => {
  it("maps vision coordinates onto the visible world window", () => {
    const vp = { originX: 200, originY: 50, scale: 2 };
    const world = visionToWorld(500, 350, vp);
    expect(world.x).toBeCloseTo(200 + 250);
    expect(world.y).toBeCloseTo(50 + 175);
    const back = worldToVision(world, vp);
    expect(back.x).toBeCloseTo(500);
    expect(back.y).toBeCloseTo(350);
  });

  it("zooms toward an anchor without rewriting stored points", () => {
    const vp = defaultViewport();
    const next = zoomToward(vp, 2, 0.5, 0.5);
    expect(next.scale).toBe(2);
    const center = visionToWorld(500, 350, next);
    expect(center.x).toBeCloseTo(500);
    expect(center.y).toBeCloseTo(350);
  });

  it("pans independently of zoom", () => {
    const zoomed = zoomToward(defaultViewport(), 2, 0.5, 0.5);
    const panned = panBy(zoomed, 40, -10);
    expect(panned.scale).toBe(2);
    expect(panned.originX).toBeCloseTo(zoomed.originX + 40);
    expect(panned.originY).toBeCloseTo(zoomed.originY - 10);
  });

  it("fits content without mutating shape geometry", () => {
    const shape: Shape = {
      id: "s1",
      type: "rectangle",
      geometry: { x: 2000, y: 1500, width: 100, height: 80 },
      rotation: 0,
      style: { stroke: "#fff", fill: "none", strokeWidth: 4 },
      revision: 1,
    };
    const vp = fitToContent([shape]);
    expect(shape.geometry).toEqual({ x: 2000, y: 1500, width: 100, height: 80 });
    expect(vp.originX).toBeLessThan(2000);
    expect(vp.scale).toBeGreaterThan(1);
  });
});
