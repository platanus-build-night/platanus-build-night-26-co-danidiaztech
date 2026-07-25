import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "../../../components/ui";
import type { DrawScene } from "../types";

type Tool = "pen" | "rect" | "circle" | "text";

interface Point {
  x: number;
  y: number;
}

interface PenShape {
  type: "pen";
  points: Point[];
  color: string;
}

interface RectShape {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface CircleShape {
  type: "circle";
  x: number;
  y: number;
  r: number;
  color: string;
}

interface TextShape {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
}

type Shape = PenShape | RectShape | CircleShape | TextShape;

interface CanvasFallbackProps {
  theme: "light" | "dark";
  onSceneChange: (scene: DrawScene) => void;
}

const STROKE_COLOR: Record<"light" | "dark", string> = {
  light: "#18181b",
  dark: "#f4f4f5",
};

const TOOLS: Tool[] = ["pen", "rect", "circle", "text"];

/**
 * Minimal pen/rect/circle/text sketch pad drawn on a plain <canvas>. Used
 * only when the real Excalidraw canvas throws at runtime (see
 * ExcalidrawErrorBoundary) — it exists purely so a whiteboard-shaped
 * thinking tool stays available, not to match Excalidraw's feature set.
 */
export default function CanvasFallback({ theme, onSceneChange }: CanvasFallbackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shapesRef = useRef<Shape[]>([]);
  const drawingRef = useRef<Shape | null>(null);
  const [tool, setTool] = useState<Tool>("pen");

  const color = STROKE_COLOR[theme];

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.font = "14px sans-serif";
    const shapes = drawingRef.current ? [...shapesRef.current, drawingRef.current] : shapesRef.current;
    for (const shape of shapes) {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      if (shape.type === "pen") {
        ctx.beginPath();
        shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      } else if (shape.type === "rect") {
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      } else if (shape.type === "circle") {
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillText(shape.text, shape.x, shape.y);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
    // redraw() closes over refs only, safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const emitScene = () => onSceneChange({ elements: shapesRef.current, appState: {} });

  const commit = (shape: Shape) => {
    shapesRef.current = [...shapesRef.current, shape];
    drawingRef.current = null;
    redraw();
    emitScene();
  };

  const getPos = (e: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);
    if (tool === "text") {
      const text = window.prompt("Text:");
      if (text) commit({ type: "text", x: pos.x, y: pos.y, text, color });
      return;
    }
    if (tool === "pen") drawingRef.current = { type: "pen", points: [pos], color };
    else if (tool === "rect") drawingRef.current = { type: "rect", x: pos.x, y: pos.y, w: 0, h: 0, color };
    else drawingRef.current = { type: "circle", x: pos.x, y: pos.y, r: 0, color };
    redraw();
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const shape = drawingRef.current;
    if (!shape) return;
    const pos = getPos(e);
    if (shape.type === "pen") shape.points.push(pos);
    else if (shape.type === "rect") {
      shape.w = pos.x - shape.x;
      shape.h = pos.y - shape.y;
    } else if (shape.type === "circle") {
      shape.r = Math.hypot(pos.x - shape.x, pos.y - shape.y);
    }
    redraw();
  };

  const handlePointerUp = () => {
    if (drawingRef.current) commit(drawingRef.current);
  };

  const handleClear = () => {
    shapesRef.current = [];
    drawingRef.current = null;
    redraw();
    emitScene();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-surface-alt p-1.5">
        {TOOLS.map((t) => (
          <Button
            key={t}
            type="button"
            variant={tool === t ? "primary" : "ghost"}
            size="sm"
            className="capitalize"
            onClick={() => setTool(t)}
          >
            {t}
          </Button>
        ))}
        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={handleClear}>
          Clear
        </Button>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
    </div>
  );
}
