import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Eye, EyeOff, Video, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraTrackingPanelProps {
  isTracking: boolean;
  onStartTracking: () => void;
  onStopTracking: () => void;
  visionConnected: boolean;
  handState?: {
    handDetected: boolean;
    action: "idle" | "waiting" | "drawing" | "erasing" | "adjusting_size";
    hand?: "Right" | "Left";
    strokeWidth?: number;
    radius?: number;
  } | null;
}

export const CameraTrackingPanel: React.FC<CameraTrackingPanelProps> = ({
  isTracking,
  onStartTracking,
  onStopTracking,
  visionConnected,
  handState,
}) => {
  const [panelOpen, setPanelOpen] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // When tracking is active, open local webcam feed for user feedback
  useEffect(() => {
    if (!isTracking) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setHasPermission(null);
      return;
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 320, height: 240 } })
      .then((stream) => {
        streamRef.current = stream;
        setHasPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.warn("[CameraTrackingPanel] Local camera preview unavailable:", err);
        setHasPermission(false);
      });

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isTracking]);

  // Meaningful state text
  const stateLabel = !visionConnected
    ? "Disconnected"
    : !handState || !handState.handDetected
    ? "Hand Not Detected"
    : handState.action === "waiting"
    ? "Hold to Activate..."
    : handState.action === "drawing"
    ? `Drawing (W: ${handState.strokeWidth || 4}px)`
    : handState.action === "erasing"
    ? `Erasing (R: ${handState.radius || 24}px)`
    : handState.action === "adjusting_size"
    ? "Adjusting Size"
    : "Hand Tracked (Idle)";

  return (
    <aside aria-label="Camera tracking controls" className="fixed top-24 right-4 z-40 flex flex-col items-end gap-2">
      {!isTracking ? (
        <Button
          onClick={onStartTracking}
          size="sm"
          className="rounded-2xl gap-2 h-10 px-4 glass border-border/40 shadow-xl bg-violet-600/90 hover:bg-violet-600 text-white"
        >
          <Camera className="w-4 h-4" />
          <span>Enable Hand Tracking</span>
        </Button>
      ) : (
        <div className="glass rounded-3xl border-border/40 shadow-2xl p-3 flex flex-col items-end gap-2 w-72 backdrop-blur-xl">
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-violet-400">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Camera Tracking</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPanelOpen(!panelOpen)}
                className="h-7 w-7 rounded-lg"
                title={panelOpen ? "Hide Preview" : "Show Preview"}
              >
                {panelOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onStopTracking}
                className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                title="Stop Hand Tracking"
              >
                <CameraOff className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Live Status Pill */}
          <div className="w-full flex items-center justify-between px-2 py-1 rounded-xl bg-secondary/40 text-[11px] font-mono border border-border/30">
            <span className="text-muted-foreground text-[10px] uppercase font-bold">Status:</span>
            <span
              className={`font-semibold ${
                !visionConnected
                  ? "text-rose-400"
                  : !handState || !handState.handDetected
                  ? "text-amber-400"
                  : handState.action === "drawing"
                  ? "text-violet-400 animate-pulse"
                  : handState.action === "erasing"
                  ? "text-rose-400 animate-pulse"
                  : "text-emerald-400"
              }`}
            >
              {stateLabel}
            </span>
          </div>

          <AnimatePresence>
            {panelOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="w-full overflow-hidden rounded-2xl bg-black/60 relative border border-border/30"
              >
                {hasPermission === false ? (
                  <div className="p-4 text-center text-xs text-muted-foreground space-y-1">
                    <AlertCircle className="w-5 h-5 text-amber-400 mx-auto" />
                    <p className="font-semibold text-foreground">Webcam Access Denied</p>
                    <p className="text-[10px]">Mouse drawing remains fully functional.</p>
                  </div>
                ) : (
                  <div className="aspect-[4/3] w-full relative flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover -scale-x-100 rounded-2xl"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[9px] font-mono text-emerald-400 border border-white/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {visionConnected ? "Vision Agent Linked" : "Connecting Agent..."}
                    </div>
                  </div>
                )}

                {/* Gesture Guide Accordion */}
                <div className="p-2.5 text-[10px] text-muted-foreground bg-background/60 border-t border-border/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-[11px]">Gesture Guide</span>
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
                      <span className="text-violet-400 font-bold">Right Hand:</span> Hold pinch ~0.8s to draw. Spread fingers to widen stroke (2–24px). Open palm to release.
                    </div>
                    <div>
                      <span className="text-rose-400 font-bold">Left Hand:</span> Hold pinch ~0.8s to erase. Spread fingers to expand radius (12–64px). Open palm to exit.
                    </div>
                  </div>

                  {showGuide && (
                    <div className="mt-2 pt-2 border-t border-border/20 space-y-1 text-[9px]">
                      <div className="grid grid-cols-3 gap-1 py-0.5 font-semibold text-foreground">
                        <span>Action</span>
                        <span>Activation</span>
                        <span>Size / Exit</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 py-0.5 text-muted-foreground">
                        <span className="text-violet-400">Right Draw</span>
                        <span>Hold pinch ~0.8s</span>
                        <span>Spread: Widen / Open: Stop</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 py-0.5 text-muted-foreground">
                        <span className="text-rose-400">Left Erase</span>
                        <span>Hold pinch ~0.8s</span>
                        <span>Spread: Radius / Open: Stop</span>
                      </div>
                      <div className="text-[8.5px] text-muted-foreground/70 pt-1">
                        🔒 Note: Opening preview does not synthesize data. Fresh tracking requires physical camera frames with MediaPipe hands.
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
