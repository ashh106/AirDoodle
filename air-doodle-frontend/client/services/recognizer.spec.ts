import { describe, expect, it } from "vitest";
import { recognizeStroke } from "@/services/recognizer";

describe("recognizeStroke mock", () => {
  it("recognizes a narrow stroke as a line", async () => {
    const shape = await recognizeStroke([{ x: 10, y: 10 }, { x: 100, y: 12 }]);
    expect(shape.type).toBe("line");
    expect(shape.revision).toBe(1);
  });

  it("recognizes a square outline as a circle", async () => {
    const shape = await recognizeStroke([{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 110 }, { x: 10, y: 110 }]);
    expect(shape.type).toBe("circle");
  });

  it("recognizes a wide outline as a rectangle", async () => {
    const shape = await recognizeStroke([{ x: 10, y: 10 }, { x: 210, y: 10 }, { x: 210, y: 110 }, { x: 10, y: 110 }]);
    expect(shape.type).toBe("rectangle");
  });
});
