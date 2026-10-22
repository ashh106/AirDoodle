import React from "react";
import { motion } from "framer-motion";
import { Circle, Eraser, Minus, MousePointer2, PenTool, Pencil, Square, Triangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tool } from "@/types/shape";

interface FloatingToolbarProps {
  currentTool: Tool;
  onToolSelect: (tool: Tool) => void;
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

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ currentTool, onToolSelect }) => (
  <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center p-2 glass rounded-3xl border-border/40 shadow-2xl">
    <div className="flex items-center gap-1">
      {tools.map(tool => (
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
);

export default FloatingToolbar;
