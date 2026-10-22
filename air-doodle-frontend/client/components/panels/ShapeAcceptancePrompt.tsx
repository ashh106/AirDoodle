import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shape } from "@/types/shape";

interface ShapeAcceptancePromptProps {
  recognizedShape: Shape | null;
  onAccept: () => void;
  onReject: () => void;
}

export const ShapeAcceptancePrompt: React.FC<ShapeAcceptancePromptProps> = ({
  recognizedShape,
  onAccept,
  onReject,
}) => {
  return (
    <AnimatePresence>
      {recognizedShape && (
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.9 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-50 glass-card px-5 py-3 rounded-2xl border-border/40 shadow-2xl flex items-center gap-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold leading-none capitalize">
                Recognized as {recognizedShape.type}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Convert stroke to geometric {recognizedShape.type}?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              className="h-8 px-3 rounded-xl text-xs gap-1 border-border/40 hover:bg-secondary/40"
            >
              <X className="w-3.5 h-3.5" />
              <span>Keep Stroke</span>
            </Button>
            <Button
              size="sm"
              onClick={onAccept}
              className="h-8 px-3 rounded-xl text-xs gap-1 bg-primary text-primary-foreground shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Convert Shape</span>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
