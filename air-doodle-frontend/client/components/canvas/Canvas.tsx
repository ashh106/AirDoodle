import React, { PointerEvent, useRef, useState } from "react";
import { InputEvent, HandAction } from "@/types/input";
import { EraserMode, Point, Shape, ShapeAction, ShapeType, Tool } from "@/types/shape";
import { intersectsShape, applyDetailEraser } from "@/lib/eraserGeometry";

interface CanvasProps {
  shapes: Shape[];
  tool: Tool;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (action: ShapeAction) => void;
  onInputEvent: (event: InputEvent) => void;
  remoteCursors?: { socketId: string; user?: { id: string; name: string }; x: number; y: number }[];
  onCursorBroadcast?: (x: number, y: number) => void;
  handCursor?: {
    x: number;
    y: number;
    hand: "Right" | "Left";
    action: HandAction;
    strokeWidth?: number;
    radius?: number;
  } | null;
  eraserMode?: EraserMode;
  eraserRadius?: number;
  onEmptyClick?: () => void;
}

type Bounds = { x: number; y: number; width: number; height: number };
type DragState =
  | { mode: "stroke"; start: Point; current: Point; points: Point[] }
  | { mode: "create"; start: Point; current: Point; shapeType: ShapeType }
  | { mode: "move"; start: Point; current: Point; shapeId: string; center: Point; rotation: number }
  | { mode: "scale"; start: Point; current: Point; shapeId: string; fixed: Point; handle: string; bounds: Bounds; center: Point; rotation: number }
  | { mode: "rotate"; start: Point; current: Point; shapeId: string; center: Point; initialAngle: number; rotation: number }
  | { mode: "erase"; start: Point; current: Point };

const handlePoints: Record<string, (bounds: Bounds) => Point> = {
  nw: bounds => ({ x: bounds.x, y: bounds.y }),
  ne: bounds => ({ x: bounds.x + bounds.width, y: bounds.y }),
  se: bounds => ({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }),
  sw: bounds => ({ x: bounds.x, y: bounds.y + bounds.height }),
};
const oppositeHandle: Record<string, string> = { nw: "se", ne: "sw", se: "nw", sw: "ne" };

const shapePoints = (shape: Shape): Point[] => {
  switch (shape.type) {
    case "line": return [{ x: shape.geometry.x1, y: shape.geometry.y1 }, { x: shape.geometry.x2, y: shape.geometry.y2 }];
    case "rectangle": return [
      { x: shape.geometry.x, y: shape.geometry.y },
      { x: shape.geometry.x + shape.geometry.width, y: shape.geometry.y },
      { x: shape.geometry.x + shape.geometry.width, y: shape.geometry.y + shape.geometry.height },
      { x: shape.geometry.x, y: shape.geometry.y + shape.geometry.height },
    ];
    case "circle": return [
      { x: shape.geometry.cx - shape.geometry.r, y: shape.geometry.cy - shape.geometry.r },
      { x: shape.geometry.cx + shape.geometry.r, y: shape.geometry.cy + shape.geometry.r },
    ];
    case "triangle":
    case "freehand": return shape.geometry.points.map(([x, y]) => ({ x, y }));
  }
};

const centerOf = (points: Point[]): Point => {
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
};

const rotatedPoint = (point: Point, center: Point, degrees: number): Point => {
  const radians = degrees * Math.PI / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return { x: center.x + dx * Math.cos(radians) - dy * Math.sin(radians), y: center.y + dx * Math.sin(radians) + dy * Math.cos(radians) };
};

const boundsOf = (shape: Shape): Bounds => {
  const points = shapePoints(shape);
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

const worldBounds = (shape: Shape): Bounds => {
  const bounds = boundsOf(shape);
  const center = centerOf(shapePoints(shape));
  const points = Object.values(handlePoints).map(position => rotatedPoint(position(bounds), center, shape.rotation));
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

const makeShape = (type: ShapeType, start: Point, end: Point): Shape => {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  const base = { id: crypto.randomUUID(), rotation: 0, style: { stroke: "#ffffff", fill: "none", strokeWidth: 2 }, revision: 1 };
  switch (type) {
    case "line": return { ...base, type, geometry: { x1: start.x, y1: start.y, x2: end.x, y2: end.y } };
    case "rectangle": return { ...base, type, geometry: { x: left, y: top, width, height } };
    case "circle": return { ...base, type, geometry: { cx: (start.x + end.x) / 2, cy: (start.y + end.y) / 2, r: Math.hypot(width, height) / 2 } };
    case "triangle": return { ...base, type, geometry: { points: [[left + width / 2, top], [left + width, top + height], [left, top + height]] } };
    case "freehand": return { ...base, type, geometry: { points: [[start.x, start.y], [end.x, end.y]] } };
  }
};

const renderShape = (shape: Shape) => {
  const maskAttr = shape.mask && shape.mask.length > 0 ? `url(#mask-${shape.id})` : undefined;
  const style = {
    stroke: shape.style.stroke,
    fill: shape.style.fill,
    strokeWidth: shape.style.strokeWidth,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    mask: maskAttr,
  };
  switch (shape.type) {
    case "line": return <line {...style} x1={shape.geometry.x1} y1={shape.geometry.y1} x2={shape.geometry.x2} y2={shape.geometry.y2} />;
    case "rectangle": return <rect {...style} x={shape.geometry.x} y={shape.geometry.y} width={shape.geometry.width} height={shape.geometry.height} />;
    case "circle": return <circle {...style} cx={shape.geometry.cx} cy={shape.geometry.cy} r={shape.geometry.r} />;
    case "triangle": return <polygon {...style} points={shape.geometry.points.map(([x, y]) => `${x},${y}`).join(" ")} />;
    case "freehand": return <polyline {...style} fill="none" points={shape.geometry.points.map(([x, y]) => `${x},${y}`).join(" ")} />;
  }
};

const Canvas: React.FC<CanvasProps> = ({
  shapes,
  tool,
  selectedId,
  onSelect,
  onChange,
  onInputEvent,
  remoteCursors,
  onCursorBroadcast,
  handCursor,
  eraserMode = "object",
  eraserRadius = 24,
  onEmptyClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const selected = shapes.find(shape => shape.id === selectedId) ?? null;
  const selectionBounds = selected ? boundsOf(selected) : null;

  const getPoint = (event: PointerEvent<SVGSVGElement>): Point => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  };

  const findShape = (point: Point) => [...shapes].reverse().find(shape => {
    const bounds = worldBounds(shape);
    return point.x >= bounds.x - 8 && point.x <= bounds.x + bounds.width + 8 && point.y >= bounds.y - 8 && point.y <= bounds.y + bounds.height + 8;
  });

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const point = getPoint(event);
    onInputEvent({ type: "penDown", x: point.x, y: point.y });
    const target = event.target as SVGElement;
    const handle = target.dataset.handle;
    const active = shapes.find(shape => shape.id === selectedId);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (handle && active && selectionBounds) {
      const center = centerOf(shapePoints(active));
      if (handle === "rotate") {
        setDrag({ mode: "rotate", start: point, current: point, shapeId: active.id, center, initialAngle: Math.atan2(point.y - center.y, point.x - center.x), rotation: active.rotation });
      } else {
        const fixed = handlePoints[oppositeHandle[handle]](selectionBounds);
        const local = rotatedPoint(point, center, -active.rotation);
        setDrag({ mode: "scale", start: local, current: local, shapeId: active.id, fixed, handle, bounds: selectionBounds, center, rotation: active.rotation });
      }
      return;
    }

    if (tool === "select") {
      const shape = findShape(point);
      onSelect(shape?.id ?? null);
      if (shape) {
        const center = centerOf(shapePoints(shape));
        const local = rotatedPoint(point, center, -shape.rotation);
        setDrag({ mode: "move", start: local, current: local, shapeId: shape.id, center, rotation: shape.rotation });
      } else {
        onEmptyClick?.();
        setDrag(null);
      }
      return;
    }

    if (tool === "eraser") {
      if (eraserMode === "object") {
        const hitShape = [...shapes].reverse().find(shape => intersectsShape(point, eraserRadius, shape));
        if (hitShape) {
          onChange({ type: "delete", id: hitShape.id });
          if (selectedId === hitShape.id) onSelect(null);
        }
      } else {
        const { updatedShapes, affected } = applyDetailEraser(point, eraserRadius, shapes);
        if (affected) {
          onChange({ type: "batch", shapes: updatedShapes });
        }
      }
      setDrag({ mode: "erase", start: point, current: point });
      return;
    }

    if (tool === "draw" || tool === "pen") {
      setDrag({ mode: "stroke", start: point, current: point, points: [point] });
    } else {
      setDrag({ mode: "create", start: point, current: point, shapeType: tool });
    }
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const point = getPoint(event);
    setCursor(point);
    onCursorBroadcast?.(point.x, point.y);

    if (!drag) return;

    if (drag.mode === "erase") {
      if (eraserMode === "object") {
        const hitShape = [...shapes].reverse().find(shape => intersectsShape(point, eraserRadius, shape));
        if (hitShape) {
          onChange({ type: "delete", id: hitShape.id });
          if (selectedId === hitShape.id) onSelect(null);
        }
      } else {
        const { updatedShapes, affected } = applyDetailEraser(point, eraserRadius, shapes);
        if (affected) {
          onChange({ type: "batch", shapes: updatedShapes });
        }
      }
      setDrag(prev => prev ? { ...prev, current: point } : null);
      return;
    }

    setDrag(previous => {
      if (!previous) return previous;
      if (previous.mode === "move" || previous.mode === "scale") {
        return { ...previous, current: rotatedPoint(point, previous.center, -previous.rotation) };
      }
      return { ...previous, current: point, ...(previous.mode === "stroke" ? { points: [...previous.points, point] } : {}) };
    });
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const point = getPoint(event);
    if (!drag) {
      onInputEvent({ type: "penUp", x: point.x, y: point.y });
      return;
    }

    if (drag.mode === "erase") {
      setDrag(null);
      onInputEvent({ type: "penUp", x: point.x, y: point.y });
      return;
    }

    let strokePoints = [point];
    if (drag.mode === "stroke") {
      strokePoints = [...drag.points, point];
    } else if (drag.mode === "create") {
      const shape = makeShape(drag.shapeType, drag.start, point);
      const size = Math.max(Math.abs(point.x - drag.start.x), Math.abs(point.y - drag.start.y));
      if (size >= 2) {
        onChange({ type: "create", shape });
        onSelect(shape.id);
      }
      strokePoints = [drag.start, point];
    } else if (drag.mode === "move") {
      const local = rotatedPoint(point, drag.center, -drag.rotation);
      const dx = local.x - drag.start.x;
      const dy = local.y - drag.start.y;
      if (dx || dy) onChange({ type: "move", id: drag.shapeId, dx, dy });
    } else if (drag.mode === "scale") {
      const local = rotatedPoint(point, drag.center, -drag.rotation);
      const initial = handlePoints[drag.handle](drag.bounds);
      const scaleX = (local.x - drag.fixed.x) / (initial.x - drag.fixed.x || 1);
      const scaleY = (local.y - drag.fixed.y) / (initial.y - drag.fixed.y || 1);
      onChange({ type: "scale", id: drag.shapeId, scaleX, scaleY, origin: drag.fixed });
    } else if (drag.mode === "rotate") {
      const angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x);
      const rotation = drag.rotation + (angle - drag.initialAngle) * 180 / Math.PI;
      onChange({ type: "rotate", id: drag.shapeId, rotation: Math.round(rotation * 10) / 10 });
    }

    onInputEvent({ type: "penUp", x: point.x, y: point.y });
    const strokeX = strokePoints.map(point => point.x);
    const strokeY = strokePoints.map(point => point.y);
    const strokeSize = Math.max(Math.max(...strokeX) - Math.min(...strokeX), Math.max(...strokeY) - Math.min(...strokeY));
    if (drag.mode === "stroke" && strokeSize >= 2) onInputEvent({ type: "strokeFinished", points: strokePoints });
    setDrag(null);
  };

  const handlePointerCancel = (event: PointerEvent<SVGSVGElement>) => {
    const point = getPoint(event);
    setDrag(null);
    onInputEvent({ type: "penUp", x: point.x, y: point.y });
  };

  const previewTransform = (shape: Shape): string | undefined => {
    if (!drag || drag.mode === "stroke" || drag.mode === "create" || drag.mode === "erase" || shape.id !== drag.shapeId) return undefined;
    if (drag.mode === "move") return `translate(${drag.current.x - drag.start.x} ${drag.current.y - drag.start.y})`;
    if (drag.mode === "rotate") return `rotate(${(Math.atan2(drag.current.y - drag.center.y, drag.current.x - drag.center.x) - drag.initialAngle) * 180 / Math.PI} ${drag.center.x} ${drag.center.y})`;
    if (drag.mode !== "scale") return undefined;
    const origin = drag.fixed;
    const initial = handlePoints[drag.handle](drag.bounds);
    const scaleX = (drag.current.x - origin.x) / (initial.x - origin.x || 1);
    const scaleY = (drag.current.y - origin.y) / (initial.y - origin.y || 1);
    return `translate(${origin.x} ${origin.y}) scale(${scaleX} ${scaleY}) translate(${-origin.x} ${-origin.y})`;
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <svg
        ref={svgRef}
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid meet"
        className={`h-full w-full touch-none ${tool === "select" ? "cursor-default" : tool === "eraser" ? "cursor-none" : "cursor-crosshair"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <defs>
          <pattern id="workspace-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          </pattern>
          {shapes.filter(s => s.mask && s.mask.length > 0).map(s => (
            <mask key={`mask-${s.id}`} id={`mask-${s.id}`}>
              <rect x="-5000" y="-5000" width="10000" height="10000" fill="white" />
              {s.mask!.map((m, idx) => (
                <circle key={idx} cx={m.cx} cy={m.cy} r={m.r} fill="black" />
              ))}
            </mask>
          ))}
        </defs>
        <rect width="1000" height="700" fill="url(#workspace-grid)" />
        <line x1="500" y1="0" x2="500" y2="700" stroke="rgba(139,92,246,0.25)" strokeWidth="1" />
        <line x1="0" y1="350" x2="1000" y2="350" stroke="rgba(139,92,246,0.25)" strokeWidth="1" />
        {shapes.map(shape => (
          <g key={shape.id} transform={`rotate(${shape.rotation} ${centerOf(shapePoints(shape)).x} ${centerOf(shapePoints(shape)).y})`}>
            <g transform={previewTransform(shape)}>
              {renderShape(shape)}
            </g>
          </g>
        ))}
        {drag?.mode === "stroke" && (
          <polyline points={drag.points.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        )}
        {drag?.mode === "create" && (
          <g opacity="0.6">{renderShape(makeShape(drag.shapeType, drag.start, drag.current))}</g>
        )}
        {drag?.mode === "create" && renderShape(makeShape(drag.shapeType, drag.start, drag.current))}
        {selected && selectionBounds && (
          <g transform={`rotate(${selected.rotation} ${centerOf(shapePoints(selected)).x} ${centerOf(shapePoints(selected)).y})`}>
            <rect x={selectionBounds.x} y={selectionBounds.y} width={selectionBounds.width} height={selectionBounds.height} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="6 4" pointerEvents="none" />
            {Object.entries(handlePoints).map(([name, position]) => {
              const point = position(selectionBounds);
              return <circle key={name} data-handle={name} cx={point.x} cy={point.y} r="6" fill="#ffffff" stroke="#8b5cf6" strokeWidth="2" className="cursor-nwse-resize" />;
            })}
            <line x1={centerOf(shapePoints(selected)).x} y1={selectionBounds.y} x2={centerOf(shapePoints(selected)).x} y2={selectionBounds.y - 26} stroke="#8b5cf6" strokeWidth="1.5" pointerEvents="none" />
            <circle data-handle="rotate" cx={centerOf(shapePoints(selected)).x} cy={selectionBounds.y - 30} r="6" fill="#8b5cf6" stroke="#ffffff" strokeWidth="2" className="cursor-grab" />
          </g>
        )}
        {remoteCursors?.map(rc => (
          <g key={rc.socketId} transform={`translate(${rc.x} ${rc.y})`} pointerEvents="none">
            <circle r="4" fill="#10b981" />
            <rect x="6" y="-12" width="60" height="16" rx="4" fill="rgba(16, 185, 129, 0.85)" />
            <text x="10" y="-1" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="sans-serif">{rc.user?.name || "Peer"}</text>
          </g>
        ))}
        {/* Tool-specific mouse cursor previews */}
        {tool === "eraser" && (
          <g transform={`translate(${cursor.x} ${cursor.y})`} pointerEvents="none">
            <circle
              r={eraserRadius}
              fill="rgba(244, 63, 94, 0.15)"
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            <circle r="2" fill="#f43f5e" />
          </g>
        )}
        {/* Real-time Hand Tracking Cursor (Strictly independent of mouse) */}
        {handCursor && (
          <g transform={`translate(${handCursor.x} ${handCursor.y})`} pointerEvents="none">
            {handCursor.action === "erasing" ? (
              <>
                <circle
                  r={handCursor.radius || eraserRadius || 24}
                  fill="rgba(239, 68, 68, 0.25)"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <circle r="4" fill="#ef4444" />
                <rect x="8" y="-18" width="130" height="20" rx="4" fill="rgba(239, 68, 68, 0.9)" />
                <text x="13" y="-4" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                  Erasing (R: {handCursor.radius || eraserRadius || 24}px)
                </text>
              </>
            ) : handCursor.action === "drawing" ? (
              <>
                <circle
                  r={Math.max(4, (handCursor.strokeWidth || 4) / 2)}
                  fill="rgba(139, 92, 246, 0.3)"
                  stroke="#8b5cf6"
                  strokeWidth="2.5"
                />
                <circle r="3" fill="#8b5cf6" />
                <rect x="8" y="-18" width="130" height="20" rx="4" fill="rgba(139, 92, 246, 0.9)" />
                <text x="13" y="-4" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                  Drawing (W: {handCursor.strokeWidth || 4}px)
                </text>
              </>
            ) : handCursor.action === "waiting" ? (
              <>
                <circle r="16" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />
                <circle r="4" fill="#f59e0b" />
                <rect x="8" y="-18" width="95" height="20" rx="4" fill="rgba(245, 158, 11, 0.9)" />
                <text x="13" y="-4" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                  Hold to Activate
                </text>
              </>
            ) : handCursor.action === "adjusting_size" ? (
              <>
                <circle
                  r={handCursor.radius || eraserRadius || 24}
                  fill="rgba(59, 130, 246, 0.25)"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <circle r="4" fill="#3b82f6" />
                <rect x="8" y="-18" width="85" height="20" rx="4" fill="rgba(59, 130, 246, 0.9)" />
                <text x="13" y="-4" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                  Adjusting Size
                </text>
              </>
            ) : (
              <>
                <circle r="7" fill="none" stroke="#a78bfa" strokeWidth="2" />
                <circle r="2.5" fill="#ffffff" />
                <rect x="8" y="-16" width="75" height="18" rx="4" fill="rgba(30, 30, 40, 0.85)" stroke="rgba(255,255,255,0.2)" />
                <text x="13" y="-4" fill="#a78bfa" fontSize="9" fontWeight="bold" fontFamily="sans-serif">
                  {handCursor.hand === "Left" ? "Left Hand" : "Right Hand"}
                </text>
              </>
            )}
          </g>
        )}
      </svg>
      <div className="absolute bottom-10 left-6 rounded-xl px-3 py-2 glass text-[10px] font-mono text-muted-foreground">X: {Math.round(cursor.x)} Y: {Math.round(cursor.y)}</div>
    </div>
  );
};

export default Canvas;
