import { Point } from "@/types/shape";

export type HandAction = "idle" | "waiting" | "drawing" | "erasing";

export type InputEvent =
  | { type: "cursorMoved"; x: number; y: number; hand?: "Right" | "Left"; action?: HandAction; pinchConfidence?: number }
  | { type: "penDown"; x: number; y: number }
  | { type: "penUp"; x: number; y: number }
  | { type: "eraseAt"; x: number; y: number; radius?: number }
  | { type: "strokeFinished"; points: Point[] }
  | { type: "handStatus"; handDetected: boolean; action: HandAction; hand?: "Right" | "Left" };

