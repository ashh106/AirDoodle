import { describe, it, expect } from "vitest";
import { exportShapesSvg, exportShapesToJson } from "./export.service";
import { Shape } from "@/types/shape";

const testShapes: Shape[] = [
  {
    id: "rect-1",
    type: "rectangle",
    geometry: { x: 100, y: 150, width: 200, height: 100 },
    rotation: 0,
    style: { stroke: "#ffffff", fill: "#8b5cf6", strokeWidth: 3 },
    revision: 1,
  },
  {
    id: "circle-1",
    type: "circle",
    geometry: { cx: 400, cy: 300, r: 50 },
    rotation: 45,
    style: { stroke: "#10b981", fill: "none", strokeWidth: 2 },
    revision: 1,
  },
  {
    id: "freehand-1",
    type: "freehand",
    geometry: {
      points: [
        [10, 20],
        [30, 40],
        [50, 60],
      ],
    },
    rotation: 0,
    style: { stroke: "#f59e0b", fill: "none", strokeWidth: 4 },
    revision: 1,
  },
];

describe("Export Service", () => {
  it("generates valid, non-empty SVG markup with shapes and dimensions", () => {
    const svg = exportShapesSvg(testShapes);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 1000 700"');
    expect(svg).toContain('<rect width="1000" height="700" fill="#0a0a0c" />'); // Background rect
    expect(svg).toContain('<rect fill="#8b5cf6" stroke="#ffffff" stroke-width="3"');
    expect(svg).toContain('<circle fill="none" stroke="#10b981" stroke-width="2"');
    expect(svg).toContain('<polyline fill="none" stroke="#f59e0b" stroke-width="4"');
    expect(svg).toContain('points="10,20 30,40 50,60"');
    expect(svg).toContain("</svg>");
  });

  it("supports transparent or custom background options in SVG", () => {
    const transparentSvg = exportShapesSvg(testShapes, { backgroundColor: "transparent" });
    expect(transparentSvg).not.toContain('<rect fill="transparent"');

    const customSvg = exportShapesSvg(testShapes, { backgroundColor: "#1e1e24" });
    expect(customSvg).toContain('<rect width="1000" height="700" fill="#1e1e24" />');
  });

  it("exports project state as valid JSON with canvas metadata and shape records", () => {
    const jsonStr = exportShapesToJson("My Test Drawing", testShapes);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.app).toBe("AirDoodle");
    expect(parsed.title).toBe("My Test Drawing");
    expect(parsed.shapes.length).toBe(3);
    expect(parsed.shapes[0].id).toBe("rect-1");
    expect(parsed.shapes[1].type).toBe("circle");
    expect(parsed.canvas.width).toBe(1000);
  });

  it("exports persistent vector masks for partially detail-erased shapes", () => {
    const maskedShapes: Shape[] = [
      {
        id: "rect-masked",
        type: "rectangle",
        geometry: { x: 50, y: 50, width: 100, height: 100 },
        rotation: 0,
        style: { stroke: "#ffffff", fill: "#3b82f6", strokeWidth: 2 },
        revision: 1,
        mask: [{ cx: 80, cy: 80, r: 15 }],
      },
    ];

    const svg = exportShapesSvg(maskedShapes);
    expect(svg).toContain('<defs><mask id="mask-rect-masked" maskUnits="userSpaceOnUse">');
    expect(svg).toContain('<circle cx="80" cy="80" r="15" fill="black" />');
    expect(svg).toContain('mask="url(#mask-rect-masked)"');

    const jsonStr = exportShapesToJson("Masked", maskedShapes);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.shapes[0].mask).toEqual([{ cx: 80, cy: 80, r: 15 }]);
  });
});
