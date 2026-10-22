import { Point } from "@/types/shape";

export type HandAction = "idle" | "waiting" | "drawing" | "erasing" | "adjusting_size";

export type InputEvent =
  | {
      type: "cursorMoved";
      x: number;
      y: number;
      hand?: "Right" | "Left";
      action?: HandAction;
      strokeWidth?: number;
      radius?: number;
      pinchConfidence?: number;
    }
  | { type: "penDown"; x: number; y: number; strokeWidth?: number }
  | { type: "penUp"; x: number; y: number }
  | { type: "eraseAt"; x: number; y: number; radius?: number; mode?: "object" | "detail" }
  | { type: "strokeFinished"; points: Point[]; strokeWidth?: number }
  | {
      type: "handStatus";
      handDetected: boolean;
      action: HandAction;
      hand?: "Right" | "Left";
      message?: string;
      strokeWidth?: number;
      radius?: number;
    };

