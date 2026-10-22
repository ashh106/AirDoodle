import React, { useEffect, useMemo, useReducer, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Redo, Settings, Undo } from "lucide-react";
import { Button } from "@/components/ui/button";
import Topbar, { ExportType } from "@/components/layout/Topbar";
import FloatingToolbar from "@/components/toolbar/FloatingToolbar";
import Canvas from "@/components/canvas/Canvas";
import ProjectPropertiesPanel from "@/components/panels/ProjectPropertiesPanel";
import { CameraTrackingPanel } from "@/components/panels/CameraTrackingPanel";
import { ShapeAcceptancePrompt } from "@/components/panels/ShapeAcceptancePrompt";
import { ShareDialog } from "@/components/dialogs/ShareDialog";
import { loadProject, saveProject, renameProject } from "@/services/project.service";
import { recognizeStroke } from "@/services/recognizer";
import { exportShapesSvg, exportShapesToPngOrJpeg, exportShapesToJson, downloadFile } from "@/services/export.service";
import { collaborationService, RemoteCursor } from "@/services/collaboration.service";
import { visionAgent } from "@/services/vision.service";
import { useAuth } from "@/context/useAuth";
import { initialShapeState, shapeReducer } from "@/state/shapeReducer";
import { InputEvent } from "@/types/input";
import { Point, Shape, ShapeAction, ShapeStyle, Tool } from "@/types/shape";
import { intersectsShape, applyDetailEraser } from "@/lib/eraserGeometry";
import { toast } from "sonner";


const ProjectPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get("shareToken") || undefined;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projectTitle, setProjectTitle] = useState("");
  const [projectPermission, setProjectPermission] = useState<"owner" | "view" | "edit">("owner");
  const [shapeState, dispatch] = useReducer(shapeReducer, undefined, () => initialShapeState());
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [showProperties, setShowProperties] = useState(true);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Shape Recognition Prompt state
  const [pendingRecognition, setPendingRecognition] = useState<{ original: Shape; recognized: Shape } | null>(null);

  // Real-time collaboration state
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);

  // Local vision camera state
  const [isCameraTracking, setIsCameraTracking] = useState(false);
  const [visionConnected, setVisionConnected] = useState(false);
  const [handCursor, setHandCursor] = useState<{
    x: number;
    y: number;
    hand: "Right" | "Left";
    action: "idle" | "waiting" | "drawing" | "erasing" | "adjusting_size";
    strokeWidth?: number;
    radius?: number;
  } | null>(null);

  // Eraser modes & brush sizes
  const [eraserMode, setEraserMode] = useState<"object" | "detail">("object");
  const [eraserRadius, setEraserRadius] = useState<number>(24);
  const [activeStrokeWidth, setActiveStrokeWidth] = useState<number>(2);
  const [cameraPreview, setCameraPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [liveHandStroke, setLiveHandStroke] = useState<Point[] | null>(null);
  const handTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const shapes = shapeState.present;
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  const selectedShape = useMemo(() => shapes.find((shape) => shape.id === selectedId) ?? null, [shapes, selectedId]);

  // Load project initial data
  useEffect(() => {
    if (!id) return;
    loadProject(id, shareToken)
      .then((project) => {
        setProjectTitle(project.title);
        if (project.permission) setProjectPermission(project.permission);
        dispatch({ type: "load", shapes: project.shapes });
        setLoaded(true);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Project not found or access denied";
        toast.error(msg);
        navigate("/dashboard", { replace: true });
      });
  }, [id, shareToken, navigate]);

  // Connect real-time collaboration
  useEffect(() => {
    if (!id || !loaded) return;

    collaborationService.connect(id, user, {
      onShapeCreated: (shape) => {
        dispatch({ type: "create", shape });
      },
      onShapeUpdated: (shape) => {
        dispatch({ type: "load", shapes: shapesRef.current.map((s) => (s.id === shape.id ? shape : s)) });
      },
      onShapeDeleted: (deletedId) => {
        dispatch({ type: "delete", id: deletedId });
      },
      onCursorMoved: (cursor) => {
        setRemoteCursors((prev) => {
          const filtered = prev.filter((c) => c.socketId !== cursor.socketId);
          return [...filtered, cursor];
        });
      },
      onPeerLeft: ({ socketId }) => {
        setRemoteCursors((prev) => prev.filter((c) => c.socketId !== socketId));
      },
      onStatusChange: (connected) => {
        setIsLiveConnected(connected);
      },
    });

    return () => {
      collaborationService.disconnect();
    };
  }, [id, loaded, user]);

  // Controlled Vision Agent connection with strict cursor timeout & cleanup
  useEffect(() => {
    if (!isCameraTracking) {
      visionAgent.disconnect();
      setVisionConnected(false);
      setHandCursor(null);
      setCameraPreview(null);
      setCameraError(null);
      setLiveHandStroke(null);
      if (handTimeoutRef.current) clearTimeout(handTimeoutRef.current);
      return;
    }

    visionAgent.connect(
      (event) => {
        handleInputEvent(event);
      },
      (status) => {
        setVisionConnected(status.connected);
        if (!status.connected) {
          setHandCursor(null);
          setCameraPreview(null);
          setLiveHandStroke(null);
        }
      }
    );

    return () => {
      visionAgent.disconnect();
      setHandCursor(null);
      setCameraPreview(null);
      setCameraError(null);
      setLiveHandStroke(null);
      if (handTimeoutRef.current) clearTimeout(handTimeoutRef.current);
    };
  }, [isCameraTracking]);


  // Auto-save debounce effect
  useEffect(() => {
    if (!loaded || !id || projectPermission === "view") return;

    setSaveStatus("unsaved");
    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await saveProject(id, shapes, undefined, shareToken);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unsaved");
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [shapes, id, loaded, projectPermission, shareToken]);

  // Keyboard shortcuts (Undo, Redo, Delete, Tool switches)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (projectPermission !== "view") dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        if (projectPermission !== "view") dispatch({ type: "redo" });
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        if (projectPermission !== "view") {
          dispatch({ type: "delete", id: selectedId });
          collaborationService.sendShapeDelete(selectedId);
          setSelectedId(null);
        }
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === "v") setTool("select");
        if (key === "p") setTool("pen");
        if (key === "e") setTool("eraser");
        if (key === "d") setTool("draw");
        if (key === "r") setTool("rectangle");
        if (key === "c") setTool("circle");
        if (key === "l") setTool("line");
        if (key === "t") setTool("triangle");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, projectPermission]);

  const handleInputEvent = (event: InputEvent) => {
    if (projectPermission === "view") return;

    if (event.type === "cameraPreview") {
      setCameraPreview(event.image);
      setCameraError(null);
    } else if (event.type === "cameraError") {
      setCameraError(event.message);
      setCameraPreview(null);
    } else if (event.type === "penDown") {
      if (isCameraTracking) {
        setLiveHandStroke([{ x: event.x, y: event.y }]);
      }
    } else if (event.type === "penUp") {
      setLiveHandStroke(null);
    } else if (event.type === "cursorMoved") {
      if (!isCameraTracking) return;
      if (event.strokeWidth) setActiveStrokeWidth(event.strokeWidth);

      if (event.action === "drawing") {
        setLiveHandStroke((prev) => (prev ? [...prev, { x: event.x, y: event.y }] : [{ x: event.x, y: event.y }]));
      } else {
        setLiveHandStroke(null);
      }

      setHandCursor({
        x: event.x,
        y: event.y,
        hand: event.hand || "Right",
        action: event.action || "idle",
        strokeWidth: event.strokeWidth,
        radius: event.radius,
      });

      if (handTimeoutRef.current) clearTimeout(handTimeoutRef.current);
      handTimeoutRef.current = setTimeout(() => {
        setHandCursor(null);
        setLiveHandStroke(null);
      }, 700);
    } else if (event.type === "handStatus") {
      if (!event.handDetected) {
        setHandCursor(null);
        setLiveHandStroke(null);
        if (handTimeoutRef.current) clearTimeout(handTimeoutRef.current);
      }
    } else if (event.type === "eraseAt") {
      const eraserX = event.x;
      const eraserY = event.y;
      const radius = event.radius || eraserRadius || 24;
      const mode = event.mode || eraserMode;

      if (mode === "object") {
        const shapesToDelete = shapes.filter((shape) =>
          intersectsShape({ x: eraserX, y: eraserY }, radius, shape)
        );

        shapesToDelete.forEach((s) => {
          dispatch({ type: "delete", id: s.id });
          collaborationService.sendShapeDelete(s.id);
          if (selectedId === s.id) setSelectedId(null);
        });
      } else {
        const { updatedShapes, affected } = applyDetailEraser(
          { x: eraserX, y: eraserY },
          radius,
          shapes
        );
        if (affected) {
          dispatch({ type: "batch", shapes: updatedShapes });
          updatedShapes.forEach((s) => collaborationService.sendShapeUpdate(s));
        }
      }
    } else if (event.type === "strokeFinished") {
      setLiveHandStroke(null);
      const strokePoints = event.points;
      if (strokePoints.length < 2) return;

      const strokeWidth = event.strokeWidth || activeStrokeWidth || 2;
      const freehandShape: Shape = {
        id: crypto.randomUUID(),
        type: "freehand",
        geometry: { points: strokePoints.map((p) => [p.x, p.y]) },
        rotation: 0,
        style: { stroke: "#ffffff", fill: "none", strokeWidth },
        revision: 1,
      };

      dispatch({ type: "create", shape: freehandShape });
      collaborationService.sendShapeCreate(freehandShape);
      setSelectedId(freehandShape.id);

      if (tool === "draw") {
        recognizeStroke(strokePoints)
          .then((recognized) => {
            if (recognized.type !== "freehand") {
              setPendingRecognition({ original: freehandShape, recognized });
            }
          })
          .catch(() => {
            // Keep original stroke on recognition error
          });
      }
    }
  };

  const handleAcceptRecognition = () => {
    if (!pendingRecognition) return;
    const { original, recognized } = pendingRecognition;
    dispatch({ type: "delete", id: original.id });
    collaborationService.sendShapeDelete(original.id);

    // Ensure recognized shape inherits original stroke color and stroke width, with transparent fill
    const convertedShape: Shape = {
      ...recognized,
      style: {
        stroke: original.style.stroke || "#ffffff",
        fill: "none", // Never convert transparent stroke into dark fill
        strokeWidth: original.style.strokeWidth || 2,
      },
    };

    dispatch({ type: "create", shape: convertedShape });
    collaborationService.sendShapeCreate(convertedShape);
    setSelectedId(convertedShape.id);
    setPendingRecognition(null);
    toast.success(`Converted to ${recognized.type}`);
  };

  const handleRejectRecognition = () => {
    setPendingRecognition(null);
  };

  const handleCanvasChange = (action: ShapeAction) => {
    if (projectPermission === "view") {
      toast.error("View-only access: you cannot modify this project");
      return;
    }

    dispatch(action);

    if (action.type === "create") {
      collaborationService.sendShapeCreate(action.shape);
    } else if (action.type === "delete") {
      collaborationService.sendShapeDelete(action.id);
    } else if (action.type === "batch") {
      action.shapes.forEach((s) => collaborationService.sendShapeUpdate(s));
    } else if (action.type === "update") {
      collaborationService.sendShapeUpdate(action.shape);
    } else if (action.type === "updateStyle") {
      const target = shapes.find((s) => s.id === action.id);
      if (target) {
        collaborationService.sendShapeUpdate({
          ...target,
          style: { ...target.style, ...action.style },
          revision: (target.revision || 1) + 1,
        });
      }
    } else if (
      action.type === "move" ||
      action.type === "rotate" ||
      action.type === "scale"
    ) {
      setTimeout(() => {
        const fresh = shapesRef.current.find((s) => s.id === action.id);
        if (fresh) collaborationService.sendShapeUpdate(fresh);
      }, 0);
    }
  };

  const handleCursorBroadcast = (x: number, y: number) => {
    collaborationService.sendCursorMove(x, y);
  };

  const handleSave = async () => {
    if (!id || projectPermission === "view") return;
    setSaveStatus("saving");
    try {
      await saveProject(id, shapes, projectTitle, shareToken);
      setSaveStatus("saved");
      toast.success("Project saved successfully");
    } catch {
      setSaveStatus("unsaved");
      toast.error("Could not save project");
    }
  };

  const handleRenameTitle = async (newTitle: string) => {
    if (!id || projectPermission === "view") return;
    try {
      await renameProject(id, newTitle);
      setProjectTitle(newTitle);
      toast.success("Project renamed");
    } catch {
      toast.error("Could not rename project");
    }
  };

  const handleExport = async (format: ExportType) => {
    const filename = `${projectTitle.replace(/[^a-zA-Z0-9_-]/g, "_") || "air-doodle-project"}`;

    try {
      if (format === "svg") {
        const svgString = exportShapesSvg(shapes);
        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        downloadFile(blob, `${filename}.svg`);
        toast.success("Exported SVG vector file");
      } else if (format === "png" || format === "jpeg") {
        const blob = await exportShapesToPngOrJpeg(shapes, format);
        downloadFile(blob, `${filename}.${format === "png" ? "png" : "jpg"}`);
        toast.success(`Exported ${format.toUpperCase()} image`);
      } else if (format === "json") {
        const jsonString = exportShapesToJson(projectTitle, shapes);
        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
        downloadFile(blob, `${filename}.airdoodle.json`);
        toast.success("Exported AirDoodle project JSON");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed";
      toast.error(msg);
    }
  };

  if (!loaded) return <div className="h-screen w-screen bg-background" />;

  return (
    <div className="h-screen w-screen bg-background overflow-hidden relative">
      <Topbar
        title={projectTitle}
        onRenameTitle={handleRenameTitle}
        onSave={handleSave}
        onExport={handleExport}
        onOpenShare={projectPermission === "owner" ? () => setIsShareOpen(true) : undefined}
        saveStatus={saveStatus}
        isLiveConnected={isLiveConnected}
        visionConnected={visionConnected}
        permission={projectPermission}
      />

      <main className="absolute inset-0 pt-20">
        <Canvas
          shapes={shapes}
          tool={tool}
          selectedId={selectedId}
          onSelect={(newId) => {
            setSelectedId(newId);
            if (newId) setShowProperties(true);
          }}
          onChange={handleCanvasChange}
          onInputEvent={handleInputEvent}
          remoteCursors={remoteCursors}
          onCursorBroadcast={handleCursorBroadcast}
          handCursor={handCursor}
          eraserMode={eraserMode}
          eraserRadius={eraserRadius}
          onEmptyClick={() => setShowProperties(false)}
          liveHandStroke={liveHandStroke}
        />
      </main>

      {/* Floating Toolbar for tools */}
      {projectPermission !== "view" && (
        <FloatingToolbar
          currentTool={tool}
          onToolSelect={setTool}
          eraserMode={eraserMode}
          onEraserModeChange={setEraserMode}
          eraserRadius={eraserRadius}
          onEraserRadiusChange={setEraserRadius}
        />
      )}

      {/* Properties Panel for selected shape */}
      <ProjectPropertiesPanel
        isOpen={showProperties}
        onClose={() => setShowProperties(false)}
        selectedShape={selectedShape}
        currentTool={tool}
        inputSource={visionConnected ? "Gesture" : "Mouse"}
        onRotationChange={(rotation) => {
          if (selectedShape) {
            handleCanvasChange({ type: "rotate", id: selectedShape.id, rotation });
          }
        }}
        onStyleChange={(style: Partial<ShapeStyle>) => {
          if (selectedShape) {
            handleCanvasChange({ type: "updateStyle", id: selectedShape.id, style });
          }
        }}
        onDelete={() => {
          if (selectedShape) {
            handleCanvasChange({ type: "delete", id: selectedShape.id });
          }
          setSelectedId(null);
        }}
      />

      {!showProperties && (
        <Button
          variant="secondary"
          size="icon"
          aria-label="Open properties"
          onClick={() => setShowProperties(true)}
          className="fixed left-6 top-1/2 -translate-y-1/2 z-50 rounded-2xl w-12 h-12 glass border-border/40 shadow-lg hover:scale-105 transition-transform"
        >
          <Settings className="w-5 h-5" />
        </Button>
      )}


      {/* Local Camera Tracking Controls & Floating Panel */}
      <CameraTrackingPanel
        isTracking={isCameraTracking}
        onStartTracking={() => setIsCameraTracking(true)}
        onStopTracking={() => setIsCameraTracking(false)}
        visionConnected={visionConnected}
        handState={handCursor ? { handDetected: true, ...handCursor } : null}
        cameraPreview={cameraPreview}
        cameraError={cameraError}
      />


      {/* Recognition Accept/Reject Banner */}
      <ShapeAcceptancePrompt
        recognizedShape={pendingRecognition?.recognized ?? null}
        onAccept={handleAcceptRecognition}
        onReject={handleRejectRecognition}
      />

      {/* Share Dialog */}
      {id && (
        <ShareDialog
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          projectId={id}
          projectTitle={projectTitle}
        />
      )}

      {/* Status Footer */}
      <footer className="fixed bottom-4 right-6 h-10 glass rounded-xl border-border/40 flex items-center gap-2 px-3 z-40">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {shapes.length} Shapes
        </span>
        <div className="h-3 w-px bg-border/40 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={!shapeState.past.length || projectPermission === "view"}
          onClick={() => dispatch({ type: "undo" })}
          className="h-7 w-7"
        >
          <Undo className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Redo"
          title="Redo (Ctrl+Y)"
          disabled={!shapeState.future.length || projectPermission === "view"}
          onClick={() => dispatch({ type: "redo" })}
          className="h-7 w-7"
        >
          <Redo className="w-3.5 h-3.5" />
        </Button>
      </footer>
    </div>
  );
};

export default ProjectPage;
