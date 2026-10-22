import { describe, expect, it } from "vitest";
import { initialShapeState, shapeReducer } from "@/state/shapeReducer";
import { RectangleShape } from "@/types/shape";

const rectangle: RectangleShape = {
  id: "rect-1",
  type: "rectangle",
  geometry: { x: 10, y: 20, width: 100, height: 50 },
  rotation: 0,
  style: { stroke: "#fff", fill: "none", strokeWidth: 2 },
  revision: 1,
};

describe("shapeReducer", () => {
  it("creates a shape at revision one", () => {
    const state = shapeReducer(initialShapeState(), { type: "create", shape: rectangle });
    expect(state.present).toEqual([rectangle]);
    expect(state.present[0].revision).toBe(1);
  });

  it("moves, rotates, and scales shapes while incrementing revision", () => {
    let state = initialShapeState([rectangle]);
    state = shapeReducer(state, { type: "move", id: rectangle.id, dx: 5, dy: -5 });
    expect(state.present[0]).toMatchObject({ geometry: { x: 15, y: 15, width: 100, height: 50 }, revision: 2 });
    state = shapeReducer(state, { type: "rotate", id: rectangle.id, rotation: 45 });
    expect(state.present[0]).toMatchObject({ rotation: 45, revision: 3 });
    state = shapeReducer(state, { type: "scale", id: rectangle.id, scaleX: 2, scaleY: 0.5, origin: { x: 15, y: 15 } });
    expect(state.present[0]).toMatchObject({ geometry: { x: 15, y: 15, width: 200, height: 25 }, revision: 4 });
  });

  it("deletes, undoes, and redoes a shape", () => {
    let state = initialShapeState([rectangle]);
    state = shapeReducer(state, { type: "delete", id: rectangle.id });
    expect(state.present).toEqual([]);
    state = shapeReducer(state, { type: "undo" });
    expect(state.present[0]).toMatchObject({ ...rectangle, revision: 2 });
    state = shapeReducer(state, { type: "redo" });
    expect(state.present).toEqual([]);
  });
});
