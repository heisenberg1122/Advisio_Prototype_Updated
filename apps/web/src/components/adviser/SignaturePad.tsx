import { useEffect, useRef, useState, type PointerEvent } from "react";

type Point = { x: number; y: number };

/** Trim transparent margins so the placement box represents the actual signature. */
function signaturePng(canvas: HTMLCanvasElement): string | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  if (right < left) return null;
  const output = window.document.createElement("canvas");
  output.width = right - left + 9;
  output.height = bottom - top + 9;
  output
    .getContext("2d")!
    .drawImage(
      canvas,
      left,
      top,
      right - left + 1,
      bottom - top + 1,
      4,
      4,
      right - left + 1,
      bottom - top + 1,
    );
  return output.toDataURL("image/png");
}

export function SignaturePad({
  mode,
  onChange,
  disabled,
}: {
  mode: "draw" | "type";
  onChange: (image: string | null) => void;
  disabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const pointer = useRef<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [name, setName] = useState("");

  const paint = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#173f63";
    context.fillStyle = "#173f63";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of strokes.current) {
      if (stroke.length === 1) {
        context.beginPath();
        context.arc(
          stroke[0].x * canvas.width,
          stroke[0].y * canvas.height,
          2.5,
          0,
          Math.PI * 2,
        );
        context.fill();
      } else {
        context.beginPath();
        stroke.forEach((point, index) => {
          const x = point.x * canvas.width,
            y = point.y * canvas.height;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.stroke();
      }
    }
  };

  useEffect(() => {
    if (mode !== "draw" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const observer = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(bounds.width * 2));
      canvas.height = Math.max(1, Math.round(bounds.height * 2));
      paint();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [mode]);

  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  };
  const finish = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    setDrawing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    onChange(signaturePng(event.currentTarget));
  };

  const typeName = (value: string) => {
    setName(value);
    const canvas = window.document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 240;
    const context = canvas.getContext("2d")!;
    context.font = "italic 88px Georgia, serif";
    context.fillStyle = "#173f63";
    context.fillText(value.trim(), 20, 150, 1160);
    onChange(value.trim() ? signaturePng(canvas) : null);
  };

  return (
    <div className="mt-3">
      {mode === "type" ? (
        <>
          <label
            htmlFor="typed-signature"
            className="text-sm font-bold text-slate-600"
          >
            Type your signature
          </label>
          <input
            id="typed-signature"
            value={name}
            onChange={(event) => typeName(event.target.value)}
            maxLength={100}
            disabled={disabled}
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 font-serif italic text-[#173f63] focus-visible:outline-2 focus-visible:outline-[#173f63]"
          />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span>Draw your signature</span>
            <button
              type="button"
              disabled={disabled || !hasInk}
              onClick={() => {
                strokes.current = [];
                paint();
                setHasInk(false);
                onChange(null);
              }}
              className="rounded px-2 py-1 text-[#173f63] focus-visible:outline-2 disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <div
            className={`relative mt-2 overflow-hidden rounded-xl border border-slate-300 bg-slate-50 ${drawing ? "ring-2 ring-[#173f63]" : ""}`}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-4 bottom-8 border-b border-dashed border-slate-300"
            />
            {!hasInk && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400"
              >
                Sign here
              </span>
            )}
            <canvas
              ref={canvasRef}
              aria-label="Draw your signature with mouse, touch, or pen. Choose Type for a keyboard alternative."
              className="relative block h-[150px] w-full touch-none"
              style={{ pointerEvents: disabled ? "none" : undefined }}
              onPointerDown={(event) => {
                if (pointer.current !== null || event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                pointer.current = event.pointerId;
                setDrawing(true);
                strokes.current.push([point(event)]);
                setHasInk(true);
                onChange(null);
                paint();
              }}
              onPointerMove={(event) => {
                if (pointer.current === event.pointerId) {
                  strokes.current[strokes.current.length - 1].push(
                    point(event),
                  );
                  paint();
                }
              }}
              onPointerUp={finish}
              onPointerCancel={finish}
              onLostPointerCapture={finish}
            />
          </div>
          <p className="mt-2 text-base text-slate-500">
            Use a mouse, touch, or pen. Choose Type to sign with a keyboard.
          </p>
        </>
      )}
    </div>
  );
}
