import { Request, Response } from "express";
import { Point, Shape } from "../../shared/shape";
import { geometryEngine } from "../services/geometry-engine";

export async function handleRecognize(req: Request, res: Response) {
  try {
    const { points } = req.body;
    if (!Array.isArray(points) || points.length < 2) {
      return res.status(400).json({ error: "At least two points are required" });
    }

    const typedPoints: Point[] = points.map((p: { x: number; y: number }) => ({
      x: Number(p.x),
      y: Number(p.y),
    }));

    // Delegate to C++ engine if running, else use server-side geometric recognizer
    const shape = await geometryEngine.recognize(typedPoints);
    res.json(shape);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Recognition failed";
    res.status(500).json({ error: message });
  }
}
