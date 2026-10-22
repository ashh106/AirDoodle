import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings2, Trash2, X, Palette, Sparkles, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shape, ShapeStyle, Tool } from "@/types/shape";

interface LeftSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedShape: Shape | null;
  currentTool: Tool;
  inputSource: "Mouse" | "Gesture";
  onRotationChange: (rotation: number) => void;
  onStyleChange: (style: Partial<ShapeStyle>) => void;
  onDelete: () => void;
}

const PRESET_STROKE_COLORS = [
  "#ffffff",
  "#8b5cf6", // Purple
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
];

const PRESET_FILL_COLORS = [
  "none",
  "rgba(139, 92, 246, 0.2)",
  "rgba(59, 130, 246, 0.2)",
  "rgba(16, 185, 129, 0.2)",
  "rgba(245, 158, 11, 0.2)",
  "rgba(239, 68, 68, 0.2)",
  "#ffffff",
];

const LeftSettingsPanel: React.FC<LeftSettingsPanelProps> = ({
  isOpen,
  onClose,
  selectedShape,
  currentTool,
  inputSource,
  onRotationChange,
  onStyleChange,
  onDelete,
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.aside
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -300, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed left-4 top-24 bottom-20 w-80 z-40 glass rounded-3xl border-border/40 overflow-y-auto shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-border/20 sticky top-0 bg-background/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            <h2 className="font-bold tracking-tight">Properties</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close properties"
            className="rounded-xl hover:bg-secondary/50 h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-6 flex-1">
          {/* Active Context */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Tool</Label>
              <p className="capitalize rounded-xl bg-secondary/40 px-3 py-1.5 text-xs font-semibold">{currentTool}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Input Source</Label>
              <p className="rounded-xl bg-secondary/40 px-3 py-1.5 text-xs font-semibold">{inputSource}</p>
            </div>
          </div>

          <div className="h-px bg-border/40" />

          {selectedShape ? (
            <>
              {/* Shape Details */}
              <section className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selected Element</Label>
                <div className="space-y-1 rounded-xl bg-secondary/30 p-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="capitalize font-semibold">{selectedShape.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rev</span>
                    <span className="font-mono text-muted-foreground">#{selectedShape.revision}</span>
                  </div>
                </div>
              </section>

              {/* Stroke Color */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" /> Stroke Color
                  </Label>
                  <span className="font-mono text-[10px] text-muted-foreground">{selectedShape.style.stroke}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_STROKE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onStyleChange({ stroke: color })}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full border transition-transform ${
                        selectedShape.style.stroke === color ? "scale-125 border-white ring-2 ring-primary" : "border-border/50 hover:scale-110"
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={selectedShape.style.stroke.startsWith("#") ? selectedShape.style.stroke : "#ffffff"}
                    onChange={(e) => onStyleChange({ stroke: e.target.value })}
                    className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    title="Custom Color"
                  />
                </div>
              </section>

              {/* Fill Color: Only for closed geometric shapes (rectangle, circle, triangle) */}
              {(selectedShape.type === "rectangle" || selectedShape.type === "circle" || selectedShape.type === "triangle") && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Fill Color
                    </Label>
                    <span className="font-mono text-[10px] text-muted-foreground">{selectedShape.style.fill}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_FILL_COLORS.map((color, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onStyleChange({ fill: color })}
                        style={{ backgroundColor: color === "none" ? "transparent" : color }}
                        className={`w-6 h-6 rounded-full border transition-transform relative ${
                          selectedShape.style.fill === color ? "scale-125 border-white ring-2 ring-primary" : "border-border/50 hover:scale-110"
                        }`}
                      >
                        {color === "none" && <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-muted-foreground">✕</span>}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={selectedShape.style.fill.startsWith("#") ? selectedShape.style.fill : "#8b5cf6"}
                      onChange={(e) => onStyleChange({ fill: e.target.value })}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                      title="Custom Fill Color"
                    />
                  </div>
                </section>
              )}


              {/* Stroke Width */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" /> Stroke Width
                  </Label>
                  <span className="font-mono text-xs font-semibold">{selectedShape.style.strokeWidth}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="16"
                  step="1"
                  value={selectedShape.style.strokeWidth}
                  onChange={(e) => onStyleChange({ strokeWidth: Number(e.target.value) })}
                  className="w-full accent-primary h-2 bg-secondary/50 rounded-lg cursor-pointer"
                />
              </section>

              {/* Rotation */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="shape-rotation" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Rotation
                  </Label>
                  <span className="font-mono text-xs">{Math.round(selectedShape.rotation)}°</span>
                </div>
                <input
                  id="shape-rotation"
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={((Math.round(selectedShape.rotation) % 360) + 360) % 360}
                  onChange={(e) => onRotationChange(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-secondary/50 rounded-lg cursor-pointer"
                />
              </section>

              <Button
                variant="outline"
                onClick={onDelete}
                className="w-full gap-2 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 mt-4"
              >
                <Trash2 className="w-4 h-4" /> Delete Shape
              </Button>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground space-y-2">
              <p className="text-xs">No shape selected.</p>
              <p className="text-[10px] opacity-70">Click any shape on canvas to edit stroke, fill, rotation or delete.</p>
            </div>
          )}
        </div>
      </motion.aside>
    )}
  </AnimatePresence>
);

export default LeftSettingsPanel;
