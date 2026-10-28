import { Point } from "@/types/shape";

export type HandAction =
  | "idle"
  | "waiting"
  | "drawing"
  | "erasing"
  | "detail_erasing"
  | "object_erasing"
  | "adjusting_size"
  | "music"
  | "lost";

export type CameraLifecycleState = "off" | "permission_required" | "starting" | "active" | "error" | "stopping";

export interface FingerCoordinates {
  x: number;
  y: number;
}

export interface HandFingers {
  thumb?: FingerCoordinates;
  index?: FingerCoordinates;
  middle?: FingerCoordinates;
  ring?: FingerCoordinates;
  pinky?: FingerCoordinates;
}

export type InputEvent =
  | {
      type: "cursorMoved";
      x: number;
      y: number;
      hand?: "Right" | "Left";
      action?: HandAction;
      mode?: "draw" | "erase" | "music";
      strokeWidth?: number;
      radius?: number;
      pinchConfidence?: number;
      holdProgress?: number;
      holdDuration?: number;
      fingers?: HandFingers;
      palmScale?: number;
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
    }
  | { type: "cameraPreview"; image: string }
  | { type: "cameraError"; message: string }
  | {
      type: "cameraStatus";
      state: "off" | "starting" | "active" | "error" | "stopping";
      opened?: boolean;
      deviceIndex?: number;
      backend?: string;
      active?: boolean;
      lockedHand?: "auto" | "Right" | "Left";
      mode?: "draw" | "music" | "recognize";
    }
  | {
      type: "agentStatus";
      status: string;
      cameraState?: string;
      canvas?: { width: number; height: number };
      camera?: { opened: boolean; deviceIndex: number; backend: string };
      lockedHand?: "auto" | "Right" | "Left";
      mode?: "draw" | "music" | "recognize";
    };

