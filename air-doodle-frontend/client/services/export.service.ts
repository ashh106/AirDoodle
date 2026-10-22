import { Coordinate, Point, Shape } from "@/types/shape";

export type ExportFormat = "svg" | "png" | "jpeg" | "json";

const shapeCenter = (shape: Shape): Point => {
  switch (shape.type) {
    case "line":
      return { x: (shape.geometry.x1 + shape.geometry.x2) / 2, y: (shape.geometry.y1 + shape.geometry.y2) / 2 };
    case "rectangle":
      return { x: shape.geometry.x + shape.geometry.width / 2, y: shape.geometry.y + shape.geometry.height / 2 };
    case "circle":
      return { x: shape.geometry.cx, y: shape.geometry.cy };
    case "triangle":
    case "freehand": {
      const points = shape.geometry.points;
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    }
  }
};

const pointsAttribute = (points: Coordinate[]) => points.map(([x, y]) => `${x},${y}`).join(" ");

const shapeMarkup = (shape: Shape): string => {
  const maskAttr = shape.mask && shape.mask.length > 0 ? ` mask="url(#mask-${shape.id})"` : "";
  const style = `fill="${shape.style.fill}" stroke="${shape.style.stroke}" stroke-width="${shape.style.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${maskAttr}`;
  switch (shape.type) {
    case "line":
      return `<line ${style} x1="${shape.geometry.x1}" y1="${shape.geometry.y1}" x2="${shape.geometry.x2}" y2="${shape.geometry.y2}" />`;
    case "rectangle":
      return `<rect ${style} x="${shape.geometry.x}" y="${shape.geometry.y}" width="${shape.geometry.width}" height="${shape.geometry.height}" />`;
    case "circle":
      return `<circle ${style} cx="${shape.geometry.cx}" cy="${shape.geometry.cy}" r="${shape.geometry.r}" />`;
    case "triangle":
      return `<polygon ${style} points="${pointsAttribute(shape.geometry.points)}" />`;
    case "freehand":
      return `<polyline ${style} fill="none" points="${pointsAttribute(shape.geometry.points)}" />`;
  }
};

export interface ExportSvgOptions {
  backgroundColor?: string;
  width?: number;
  height?: number;
}

export const exportShapesSvg = (shapes: Shape[], options: ExportSvgOptions = {}): string => {
  const width = options.width || 1000;
  const height = options.height || 700;
  const bg = options.backgroundColor || "#0a0a0c"; // Default to dark background

  const bgRect = bg !== "transparent" ? `<rect width="${width}" height="${height}" fill="${bg}" />` : "";
  const maskDefs = shapes
    .filter((s) => s.mask && s.mask.length > 0)
    .map(
      (s) =>
        `<mask id="mask-${s.id}"><rect x="-5000" y="-5000" width="10000" height="10000" fill="white" />${s
          .mask!.map((m) => `<circle cx="${m.cx}" cy="${m.cy}" r="${m.r}" fill="black" />`)
          .join("")}</mask>`
    )
    .join("");
  const defsSection = maskDefs ? `<defs>${maskDefs}</defs>` : "";

  const markup = shapes
    .map((shape) => {
      const center = shapeCenter(shape);
      return `<g transform="rotate(${shape.rotation} ${center.x} ${center.y})">${shapeMarkup(shape)}</g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${defsSection}${bgRect}${markup}</svg>`;
};


export const exportShapesToPngOrJpeg = async (
  shapes: Shape[],
  format: "png" | "jpeg",
  options: ExportSvgOptions = {}
): Promise<Blob> => {
  const svgString = exportShapesSvg(shapes, options);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = options.width || 1000;
      canvas.height = options.height || 700;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error("Canvas 2D context unavailable"));
      }

      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      // Fill background for JPG
      if (format === "jpeg") {
        ctx.fillStyle = options.backgroundColor || "#0a0a0c";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob((blobResult) => {
        if (blobResult) {
          resolve(blobResult);
        } else {
          reject(new Error("Failed to encode image canvas"));
        }
      }, mimeType, 0.95);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG into Image for export"));
    };

    img.src = url;
  });
};

export const exportShapesToJson = (projectTitle: string, shapes: Shape[]): string => {
  const payload = {
    app: "AirDoodle",
    version: "2.0",
    title: projectTitle,
    exportedAt: new Date().toISOString(),
    canvas: {
      viewBox: "0 0 1000 700",
      width: 1000,
      height: 700,
    },
    shapes,
  };
  return JSON.stringify(payload, null, 2);
};

export const downloadFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
};
