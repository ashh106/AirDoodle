import { Coordinate, Point, Shape } from "@/types/shape";

const shapeCenter = (shape: Shape): Point => {
  switch (shape.type) {
    case "line": return { x: (shape.geometry.x1 + shape.geometry.x2) / 2, y: (shape.geometry.y1 + shape.geometry.y2) / 2 };
    case "rectangle": return { x: shape.geometry.x + shape.geometry.width / 2, y: shape.geometry.y + shape.geometry.height / 2 };
    case "circle": return { x: shape.geometry.cx, y: shape.geometry.cy };
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
  const style = `fill="${shape.style.fill}" stroke="${shape.style.stroke}" stroke-width="${shape.style.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (shape.type) {
    case "line": return `<line ${style} x1="${shape.geometry.x1}" y1="${shape.geometry.y1}" x2="${shape.geometry.x2}" y2="${shape.geometry.y2}" />`;
    case "rectangle": return `<rect ${style} x="${shape.geometry.x}" y="${shape.geometry.y}" width="${shape.geometry.width}" height="${shape.geometry.height}" />`;
    case "circle": return `<circle ${style} cx="${shape.geometry.cx}" cy="${shape.geometry.cy}" r="${shape.geometry.r}" />`;
    case "triangle": return `<polygon ${style} points="${pointsAttribute(shape.geometry.points)}" />`;
    case "freehand": return `<polyline ${style} fill="none" points="${pointsAttribute(shape.geometry.points)}" />`;
  }
};

export const exportShapesSvg = (shapes: Shape[]): string => {
  const markup = shapes.map(shape => {
    const center = shapeCenter(shape);
    return `<g transform="rotate(${shape.rotation} ${center.x} ${center.y})">${shapeMarkup(shape)}</g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700">${markup}</svg>`;
};
