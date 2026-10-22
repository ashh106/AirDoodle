import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";
import crypto from "node:crypto";
import { Point, Shape } from "../../shared/shape";

interface EngineResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

export class GeometryEngineService {
  private process: ChildProcess | null = null;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timer: NodeJS.Timeout }>();
  private binaryPath: string | null = null;
  private isAvailable = false;

  constructor() {
    this.detectBinary();
  }

  private ensureProcess() {
    if (this.process || !this.binaryPath) return;
    this.startProcess();
  }


  private detectBinary() {
    const candidates = [
      path.resolve(process.cwd(), "..", "cpp-engine", "build", "airdoodle-geometry.exe"),
      path.resolve(process.cwd(), "..", "cpp-engine", "build", "Release", "airdoodle-geometry.exe"),
      path.resolve(process.cwd(), "..", "cpp-engine", "build", "airdoodle-geometry"),
      path.resolve(process.cwd(), "cpp-engine", "build", "airdoodle-geometry.exe"),
      path.resolve(process.cwd(), "cpp-engine", "build", "Release", "airdoodle-geometry.exe"),
      path.resolve(process.cwd(), "cpp-engine", "build", "airdoodle-geometry"),
      "/cpp-engine/build/airdoodle-geometry",
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        this.binaryPath = candidate;
        this.isAvailable = true;
        break;
      }
    }
  }

  private startProcess() {
    if (!this.binaryPath) {
      console.log("[GeometryEngine] C++ native binary not found. Utilizing JavaScript geometric fallback.");
      return;
    }

    try {
      this.process = spawn(this.binaryPath, [], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.process.unref();

      if (!this.process.stdout || !this.process.stdin) {
        throw new Error("Unable to open standard I/O pipes for C++ engine");
      }

      const rl = readline.createInterface({ input: this.process.stdout });
      rl.on("line", (line: string) => {
        try {
          const res: EngineResponse = JSON.parse(line.trim());
          const pending = this.pendingRequests.get(res.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(res.id);
            if (res.success) {
              pending.resolve(res.result);
            } else {
              pending.reject(new Error(res.error || "Engine error"));
            }
          }
        } catch (e) {
          console.error("[GeometryEngine] Protocol parse error:", e);
        }
      });

      this.process.stderr?.on("data", (chunk: Buffer) => {
        console.error(`[C++ Engine Debug]: ${chunk.toString().trim()}`);
      });

      this.process.on("exit", (code) => {
        console.warn(`[GeometryEngine] Process exited with code ${code}.`);
        this.process = null;
        this.isAvailable = false;
        // Clean up pending
        for (const [id, req] of this.pendingRequests.entries()) {
          clearTimeout(req.timer);
          req.reject(new Error("Geometry engine process terminated"));
          this.pendingRequests.delete(id);
        }
      });
    } catch (err) {
      console.error("[GeometryEngine] Failed to start native subprocess:", err);
      this.isAvailable = false;
    }
  }

  public get isNative(): boolean {
    return this.isAvailable && this.process !== null;
  }

  private sendCommand(action: string, payload: Record<string, any>): Promise<any> {
    if (!this.process || !this.process.stdin) {
      return Promise.reject(new Error("Native engine not running"));
    }

    const id = crypto.randomUUID();
    const message = JSON.stringify({ id, action, ...payload }) + "\n";

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Geometry engine request timed out"));
        }
      }, 5000);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.process!.stdin!.write(message);
    });
  }

  public async recognize(points: Point[]): Promise<Shape> {
    this.ensureProcess();
    if (this.isNative) {
      try {
        const res = await this.sendCommand("recognize", { points });
        if (!res || res.type === "unknown" || !res.type) {
          return {
            id: crypto.randomUUID(),
            type: "freehand",
            geometry: { points: points.map(p => [p.x, p.y]) },
            rotation: 0,
            style: { stroke: "#ffffff", fill: "none", strokeWidth: 2 },
            revision: 1,
          };
        }
        return {
          id: crypto.randomUUID(),
          ...res,
          rotation: 0,
          style: { stroke: "#ffffff", fill: "none", strokeWidth: 2 },
          revision: 1,
        };
      } catch (err) {
        console.warn("[GeometryEngine] Native recognition failed, using fallback:", err);
      }
    }

    // High-precision geometric recognition fallback
    return this.fallbackRecognize(points);
  }

  private fallbackRecognize(points: Point[]): Shape {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    const diag = Math.hypot(width, height);
    const id = crypto.randomUUID();
    const style = { stroke: "#ffffff", fill: "none", strokeWidth: 2 };

    const freehandFallback: Shape = {
      id,
      type: "freehand",
      geometry: { points: points.map(p => [p.x, p.y]) },
      rotation: 0,
      style,
      revision: 1,
    };

    if (points.length < 2 || diag < 10) return freehandFallback;

    const start = points[0];
    const end = points[points.length - 1];
    const directDist = Math.hypot(end.x - start.x, end.y - start.y);
    let totalPathLength = 0;
    for (let i = 1; i < points.length; i++) {
      totalPathLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }

    const isClosed = directDist / Math.max(diag, 1) < 0.28 || directDist < 40;

    // Line check: straight path and not closed
    if (!isClosed && directDist > 20 && totalPathLength / directDist < 1.15 && directDist / diag > 0.82) {
      return { id, type: "line", geometry: { x1: start.x, y1: start.y, x2: end.x, y2: end.y }, rotation: 0, style, revision: 1 };
    }

    if (!isClosed) return freehandFallback;

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const expectedRadius = (width + height) / 4;
    const maxDim = Math.max(width, height);
    const minDim = Math.min(width, height);
    const aspectDiff = maxDim > 0 ? (maxDim - minDim) / maxDim : 1;

    // Compute radial distances
    let sumDist = 0;
    let minR = Infinity;
    let maxR = 0;
    for (const p of points) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      sumDist += d;
      if (d < minR) minR = d;
      if (d > maxR) maxR = d;
    }
    const meanR = sumDist / points.length;
    let sumSq = 0;
    for (const p of points) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      sumSq += (d - meanR) * (d - meanR);
    }
    const stdDevR = Math.sqrt(sumSq / points.length);
    const radialCV = meanR > 0 ? stdDevR / meanR : 1;
    const radialRatio = minR > 0 ? maxR / minR : 2;

    // Polygon area via shoelace
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    area = Math.abs(area) / 2;
    const circularity = totalPathLength > 0 ? (4 * Math.PI * area) / (totalPathLength * totalPathLength) : 0;
    const fillRatio = (width * height) > 0 ? area / (width * height) : 0;

    // Circle check
    if (points.length >= 8 && aspectDiff <= 0.22 && radialCV < 0.10 && radialRatio < 1.25 && circularity > 0.70) {
      return { id, type: "circle", geometry: { cx, cy, r: expectedRadius }, rotation: 0, style, revision: 1 };
    }

    // Triangle check
    if (width > 20 && height > 20 && fillRatio <= 0.70) {
      let upper = 0;
      let lower = 0;
      for (const p of points) {
        if (p.y < minY + height * 0.35) upper++;
        if (p.y > minY + height * 0.65) lower++;
      }
      if ((upper <= 2 && lower >= 2) || (lower <= 2 && upper >= 2)) {
        const top = { x: cx, y: minY };
        const right = { x: maxX, y: maxY };
        const left = { x: minX, y: maxY };
        return {
          id,
          type: "triangle",
          geometry: { points: [[top.x, top.y], [right.x, right.y], [left.x, left.y]] },
          rotation: 0,
          style,
          revision: 1,
        };
      }
    }

    // Rectangle check
    if (width > 20 && height > 20) {
      let tl = false, tr = false, br = false, bl = false;
      const mx = width * 0.38;
      const my = height * 0.38;
      for (const p of points) {
        if (p.x <= minX + mx && p.y <= minY + my) tl = true;
        if (p.x >= maxX - mx && p.y <= minY + my) tr = true;
        if (p.x >= maxX - mx && p.y >= maxY - my) br = true;
        if (p.x <= minX + mx && p.y >= maxY - my) bl = true;
      }
      if (tl && tr && br && bl) {
        return { id, type: "rectangle", geometry: { x: minX, y: minY, width, height }, rotation: 0, style, revision: 1 };
      }
    }

    // Ambiguous: keep original freehand stroke
    return freehandFallback;
  }
}

export const geometryEngine = new GeometryEngineService();
