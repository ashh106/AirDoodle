import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Eye, EyeOff, Video, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraTrackingPanelProps {
  isTracking: boolean;
  onStartTracking: () => void;
  onStopTracking: () => void;
  visionConnected: boolean;
}

export const CameraTrackingPanel: React.FC<CameraTrackingPanelProps> = ({
  isTracking,
  onStartTracking,
  onStopTracking,
  visionConnected,
}) => {
  const [panelOpen, setPanelOpen] = useState(true);
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
        <div className="glass rounded-3xl border-border/40 shadow-2xl p-3 flex flex-col items-end gap-2 w-64">
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
                      {visionConnected ? "Local Tracking" : "Connecting..."}
                    </div>
                  </div>
                )}
                <div className="p-2 text-[10px] text-muted-foreground bg-background/50 border-t border-border/20 space-y-1">
                  <div className="font-semibold text-foreground text-[10.5px]">Gesture Controls:</div>
                  <div className="text-[9.5px] leading-tight text-muted-foreground">
                    <span className="text-violet-400 font-bold">Right Hand:</span> Hold pinch ~1s to draw, release to stop.
                  </div>
                  <div className="text-[9.5px] leading-tight text-muted-foreground">
                    <span className="text-rose-400 font-bold">Left Hand:</span> Hold pinch ~1s to erase intersecting shapes.
                  </div>
                  <div className="text-[9px] text-muted-foreground/70 pt-0.5">🔒 Camera feed stays 100% local.</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </aside>
  );
};
