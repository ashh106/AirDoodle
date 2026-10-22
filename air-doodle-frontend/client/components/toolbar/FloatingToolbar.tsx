import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Circle, Eraser, Minus, MousePointer2, PenTool, Pencil, Square, Triangle, Scissors, BoxSelect } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EraserMode, Tool } from "@/types/shape";

interface FloatingToolbarProps {
  currentTool: Tool;
  onToolSelect: (tool: Tool) => void;
  eraserMode?: EraserMode;
  onEraserModeChange?: (mode: EraserMode) => void;
  eraserRadius?: number;
  onEraserRadiusChange?: (radius: number) => void;
}

const tools: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select & Move (V)", icon: <MousePointer2 className="w-5 h-5" /> },
  { id: "pen", label: "Freehand Pen (P)", icon: <Pencil className="w-5 h-5" /> },
  { id: "eraser", label: "Eraser (E)", icon: <Eraser className="w-5 h-5" /> },
  { id: "draw", label: "Gesture Shape Recognition (D)", icon: <PenTool className="w-5 h-5" /> },
  { id: "rectangle", label: "Rectangle (R)", icon: <Square className="w-5 h-5" /> },
  { id: "circle", label: "Circle (C)", icon: <Circle className="w-5 h-5" /> },
  { id: "line", label: "Line (L)", icon: <Minus className="w-5 h-5" /> },
  { id: "triangle", label: "Triangle (T)", icon: <Triangle className="w-5 h-5" /> },
];

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  currentTool,
  onToolSelect,
  eraserMode = "object",
  onEraserModeChange,
  eraserRadius = 24,
  onEraserRadiusChange,
}) => (
  <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
    {/* Eraser Mode Sub-bar */}
    <AnimatePresence>
      {currentTool === "eraser" && (
        <motion.div
          initial={{ y: 15, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 15, opacity: 0, scale: 0.95 }}
          className="pointer-events-auto flex items-center gap-2 p-1.5 px-3 glass rounded-2xl border-border/40 shadow-xl text-xs backdrop-blur-xl"
        >
          <div className="flex items-center gap-1 bg-secondary/40 p-0.5 rounded-xl">
            <Button
              variant={eraserMode === "object" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onEraserModeChange?.("object")}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold gap-1.5 ${
                eraserMode === "object" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <BoxSelect className="w-3.5 h-3.5" />
              <span>Object Eraser</span>
            </Button>
            <Button
              variant={eraserMode === "detail" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onEraserModeChange?.("detail")}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold gap-1.5 ${
                eraserMode === "detail" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Detail Eraser</span>
            </Button>
          </div>

          <div className="h-4 w-px bg-border/40" />

          {/* Eraser Radius Slider & Brush Preview */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Radius:</span>
            <input
              type="range"
              min="8"
              max="64"
              step="2"
              value={eraserRadius}
              onChange={(e) => onEraserRadiusChange?.(Number(e.target.value))}
              className="w-20 accent-primary h-1.5 bg-secondary/50 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[11px] w-6 text-right font-semibold">{eraserRadius}px</span>
            <div
              className="rounded-full border border-rose-400 bg-rose-400/20"
              style={{ width: `${Math.min(eraserRadius, 28)}px`, height: `${Math.min(eraserRadius, 28)}px` }}
              title={`Eraser brush radius: ${eraserRadius}px`}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Primary Tool Selector */}
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="pointer-events-auto flex items-center p-2 glass rounded-3xl border-border/40 shadow-2xl"
    >
      <div className="flex items-center gap-1">
        {tools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                aria-label={tool.label}
                variant={currentTool === tool.id ? "secondary" : "ghost"}
                size="icon"
                onClick={() => onToolSelect(tool.id)}
                className={`w-11 h-11 rounded-2xl transition-all duration-300 ${
                  currentTool === tool.id
                    ? "bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {tool.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-semibold px-3 py-1.5 rounded-lg border-border/40">
              {tool.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </motion.div>
  </div>
);

export default FloatingToolbar;
