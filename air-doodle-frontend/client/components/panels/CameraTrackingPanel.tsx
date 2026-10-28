import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Eye, EyeOff, Video, AlertCircle, Sparkles, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraLifecycleState, HandAction } from "@/types/input";

interface CameraTrackingPanelProps {
  isTracking: boolean;
  cameraState?: CameraLifecycleState;
  onStartTracking: () => void;
  onStopTracking: () => void;
  visionConnected: boolean;
  cameraPreview?: string | null;
  cameraError?: string | null;
  handState?: {
    handDetected: boolean;
    action: HandAction;
    hand?: "Right" | "Left";
    strokeWidth?: number;
    radius?: number;
    holdProgress?: number;
    mode?: "draw" | "erase" | "music" | "detail" | "object";
  } | null;
}

export const CameraTrackingPanel: React.FC<CameraTrackingPanelProps> = ({
  isTracking,
  cameraState = "off",
  onStartTracking,
  onStopTracking,
  visionConnected,
  cameraPreview,
  cameraError,
  handState,
}) => {
  const [previewVisible, setPreviewVisible] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  // Compute authoritative status label
  let stateLabel = "Camera Off";
  let stateColor = "text-muted-foreground";

  if (!visionConnected) {
    stateLabel = "Vision Agent Offline";
    stateColor = "text-rose-400";
  } else if (cameraState === "starting") {
    stateLabel = "Starting Camera...";
    stateColor = "text-amber-400";
  } else if (cameraState === "stopping") {
    stateLabel = "Stopping Camera...";
    stateColor = "text-amber-400";
  } else if (cameraState === "error" || cameraError) {
    stateLabel = "Camera Error";
    stateColor = "text-rose-400";
  } else if (cameraState === "active" || isTracking) {
    if (!handState || !handState.handDetected) {
      stateLabel = "Camera Active — Searching for Hands";
      stateColor = "text-amber-400";
    } else if (handState.action === "waiting") {
      const pct = Math.round((handState.holdProgress || 0) * 100);
      stateLabel = `Hold to Draw — 1.0s (${pct}%)`;
      stateColor = "text-amber-400 animate-pulse";
    } else if (handState.action === "drawing") {
      stateLabel = `Drawing (W: ${handState.strokeWidth || 4}px)`;
      stateColor = "text-violet-400 font-bold";
    } else if (handState.action === "erasing") {
      stateLabel = `Erasing (R: ${handState.radius || 24}px)`;
      stateColor = "text-rose-400 font-bold";
    } else {
      stateLabel = "Move Pointer (Idle)";
      stateColor = "text-emerald-400";
    }
  }

  const isCapturing = isTracking && cameraState === "active";

  return (
    <aside aria-label="Camera tracking controls" className="fixed top-24 right-4 z-40 flex flex-col items-end gap-2">
      {!isCapturing && cameraState !== "starting" ? (
        <div className="flex flex-col items-end gap-1.5">
          <Button
            onClick={onStartTracking}
            size="sm"
            className="rounded-2xl gap-2 h-10 px-4 glass border-border/40 shadow-xl bg-violet-600/90 hover:bg-violet-600 text-white font-medium"
          >
            <Camera className="w-4 h-4" />
            <span>Allow Camera / Start Tracking</span>
          </Button>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 px-1 font-mono">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>Webcam OFF by default. Strictly local processing.</span>
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl border-border/40 shadow-2xl p-3 flex flex-col items-end gap-2 w-80 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-violet-400">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Camera Tracking Active</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewVisible(!previewVisible)}
                className="h-7 w-7 rounded-lg"
                title={previewVisible ? "Hide Video Preview" : "Show Video Preview"}
              >
                {previewVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onStopTracking}
                className="h-7 w-7 rounded-lg text-rose-400 hover:bg-rose-500/10"
                title="Stop Camera & Release Hardware"
              >
                <CameraOff className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Live Status Pill */}
          <div className="w-full flex flex-col gap-1 px-2.5 py-1.5 rounded-xl bg-secondary/40 text-[11px] font-mono border border-border/30">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Status:</span>
              <span className={`font-semibold ${stateColor}`}>{stateLabel}</span>
            </div>

            {/* 1.0s Activation Hold Progress Bar */}
            {handState?.action === "waiting" && (
              <div className="w-full mt-1">
                <div className="flex items-center justify-between text-[9px] text-amber-300 mb-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 animate-spin" />
                    Continuous Hold:
                  </span>
                  <span>{Math.round((handState.holdProgress || 0) * 100)}% / 1.0s</span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-amber-500/30">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-75 ease-out rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, (handState.holdProgress || 0) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <AnimatePresence>
            {previewVisible && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="w-full overflow-hidden rounded-2xl bg-black/60 relative border border-border/30"
              >
                {cameraError ? (
                  <div className="p-4 text-center text-xs text-muted-foreground space-y-1">
                    <AlertCircle className="w-5 h-5 text-rose-400 mx-auto" />
                    <p className="font-semibold text-foreground">Webcam Device Issue</p>
                    <p className="text-[10px] leading-tight text-rose-300">{cameraError}</p>
                    <p className="text-[9.5px] text-muted-foreground">Mouse drawing remains fully functional.</p>
                  </div>
                ) : (
                  <div className="aspect-[4/3] w-full relative flex items-center justify-center bg-zinc-950">
                    {cameraPreview ? (
                      <img
                        src={cameraPreview}
                        alt="Webcam hand tracking preview"
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      <div className="p-4 text-center text-xs text-muted-foreground space-y-1">
                        <Video className="w-5 h-5 text-violet-400 mx-auto animate-pulse" />
                        <p className="font-medium text-foreground text-[11px]">
                          {cameraState === "starting" ? "Initializing camera device..." : "Awaiting camera frames..."}
                        </p>
                        <p className="text-[9.5px]">DirectShow local capture running.</p>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[9px] font-mono text-emerald-400 border border-white/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{cameraState === "active" ? "Camera Active" : "Starting..."}</span>
                    </div>
                  </div>
                )}

                {/* Hand Roles & Gesture Guide */}
                <div className="p-2.5 text-[10px] text-muted-foreground bg-background/60 border-t border-border/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-[11px]">Hand Responsibilities</span>
                    <button
                      type="button"
                      onClick={() => setShowGuide(!showGuide)}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      {showGuide ? "Less" : "Details"}
                    </button>
                  </div>

                  <div className="text-[9.5px] leading-tight space-y-1">
                    <div>
                      <span className="text-violet-400 font-bold">Right Hand:</span> Pointer cursor. Hold pinch 1.0s to draw. Spread fingers to adjust brush width (2–24px). Release pinch to end stroke.
                    </div>
                    <div>
                      <span className="text-rose-400 font-bold">Left Hand:</span> Eraser cursor. Hold pinch 1.0s to erase. Spread fingers to adjust radius (10–60px). Release pinch to exit.
                    </div>
                  </div>

                  {showGuide && (
                    <div className="mt-2 pt-2 border-t border-border/20 space-y-1 text-[9px]">
                      <div className="grid grid-cols-3 gap-1 py-0.5 font-semibold text-foreground">
                        <span>Role</span>
                        <span>Activation</span>
                        <span>Size / Release</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 py-0.5 text-muted-foreground">
                        <span className="text-violet-400 font-medium">Right Hand</span>
                        <span>Hold pinch 1.0s</span>
                        <span>Spread: Width / Release: End</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 py-0.5 text-muted-foreground">
                        <span className="text-rose-400 font-medium">Left Hand</span>
                        <span>Hold pinch 1.0s</span>
                        <span>Spread: Radius / Release: End</span>
                      </div>
                      <div className="text-[8.5px] text-muted-foreground/70 pt-1">
                        🔒 Note: Hiding preview does not stop capture. To turn off camera, click the camera icon.
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </aside>
  );
};
