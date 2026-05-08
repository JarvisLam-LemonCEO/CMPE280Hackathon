import { useCallback, useEffect, useRef, useState } from "react";
import {
  Circle,
  Download,
  ExternalLink,
  PenTool,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { imageDisplayUrl, isImg, isVid } from "./fileTypeUtils";

const fileLabel = (file) => file?.originalFilename || file?.title || "Uploaded media";

function AnnotationWorkspace({ file }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const drawing = useRef(false);
  const currentAnnotation = useRef(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#ef4444");
  const [size, setSize] = useState(4);
  const [history, setHistory] = useState([]);
  const [annotating, setAnnotating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [annotations, setAnnotations] = useState(file?.annotations || []);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(10);

  const renderAnnotations = useCallback(
    (items = annotations, videoTime = null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const visibleItems = items.filter((item) => {
        if (!isVid(file)) return true;
        const t = Number(videoTime || 0);
        return (
          t >= Number(item.startTime || 0) &&
          t <= Number(item.endTime || 999999)
        );
      });

      visibleItems.forEach((item) => {
        ctx.strokeStyle = item.color;
        ctx.fillStyle = item.color;
        ctx.lineWidth = item.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (item.type === "pen") {
          ctx.beginPath();
          item.points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
        }

        if (item.type === "rect") {
          ctx.strokeRect(item.x, item.y, item.width, item.height);
        }

        if (item.type === "circle") {
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (item.type === "text") {
          ctx.font = `${Math.max(14, item.size * 5)}px sans-serif`;
          ctx.fillText(item.text, item.x, item.y);
        }
      });
    },
    [annotations, file],
  );

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const old = document.createElement("canvas");
    old.width = canvas.width;
    old.height = canvas.height;
    if (canvas.width && canvas.height) {
      old.getContext("2d").drawImage(canvas, 0, 0);
    }

    const rect = stage.getBoundingClientRect();
    canvas.width = Math.max(1, rect.width);
    canvas.height = Math.max(1, rect.height);

    if (old.width && old.height) {
      canvas
        .getContext("2d")
        .drawImage(old, 0, 0, canvas.width, canvas.height);
    }

    renderAnnotations();
  }, [renderAnnotations]);

  useEffect(() => {
    const id = requestAnimationFrame(resize);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", resize);
    };
  }, [file?.url, resize]);

  useEffect(() => {
    setAnnotations(file?.annotations || []);
  }, [file?.annotations]);

  useEffect(() => {
    renderAnnotations();
  }, [annotations, renderAnnotations]);

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    return {
      x: (touch?.clientX ?? event.clientX) - rect.left,
      y: (touch?.clientY ?? event.clientY) - rect.top,
    };
  };

  const remember = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory((items) => [...items.slice(-12), canvas.toDataURL("image/png")]);
  };

  const down = (event) => {
    if (!annotating) return;
    event.preventDefault();

    const p = point(event);
    const annotation = {
      id: crypto.randomUUID(),
      type: tool,
      color,
      size,
      points: [p],
      text: "",
      x: p.x,
      y: p.y,
      width: 0,
      height: 0,
      radius: 0,
      startTime: Number(startTime) || 0,
      endTime: Number(endTime) || 999999,
    };

    if (tool === "text") {
      const text = prompt("Annotation text");
      if (!text) return;
      annotation.text = text;
      setAnnotations((items) => [...items, annotation]);
      setSelectedAnnotationId(annotation.id);
      return;
    }

    remember();
    drawing.current = true;
    currentAnnotation.current = annotation;
  };

  const move = (event) => {
    if (!drawing.current || !annotating || !currentAnnotation.current) return;
    event.preventDefault();

    const p = point(event);
    const annotation = currentAnnotation.current;

    if (annotation.type === "pen") {
      annotation.points.push(p);
    }

    if (annotation.type === "rect") {
      annotation.width = p.x - annotation.x;
      annotation.height = p.y - annotation.y;
    }

    if (annotation.type === "circle") {
      annotation.radius = Math.hypot(p.x - annotation.x, p.y - annotation.y);
    }

    renderAnnotations([...annotations, annotation]);
  };

  const stop = () => {
    if (!drawing.current || !currentAnnotation.current) return;

    drawing.current = false;

    const annotation = currentAnnotation.current;
    currentAnnotation.current = null;

    setAnnotations((items) => [...items, annotation]);
    setSelectedAnnotationId(annotation.id);
  };

  const undo = () => {
    const last = history.at(-1);
    if (!last) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHistory((items) => items.slice(0, -1));
    };
    img.src = last;
  };

  const clear = () => {
    remember();
    setAnnotations([]);
    setSelectedAnnotationId("");
  };

  const saveAnnotation = async () => {
    if (!file?.id) {
      alert("This media cannot save annotations because it is not an uploaded file.");
      return;
    }

    try {
      setSaving(true);

      await updateDoc(doc(db, "uploads", file.id), {
        annotations,
        annotationUpdatedAt: serverTimestamp(),
      });

      alert("Annotation saved.");
    } catch (err) {
      console.error("save annotation failed", err);
      alert("Could not save annotation.");
    } finally {
      setSaving(false);
    }
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `${file.title || "media"}-annotations.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  const buttons = [
    ["pen", <PenTool key="pen-icon" size={14} />, "Draw"],
    ["rect", <Square key="rect-icon" size={14} />, "Box"],
    ["circle", <Circle key="circle-icon" size={14} />, "Circle"],
    ["text", <Type key="text-icon" size={14} />, "Text"],
  ];

  return (
    <div className="flex h-full min-h-[620px] flex-col bg-slate-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-900 p-3 text-white">
        <button
          type="button"
          onClick={() => setAnnotating((value) => !value)}
          className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${annotating ? "bg-indigo-600" : "bg-white/10 hover:bg-white/20"}`}
        >
          <PenTool size={14} />
          {annotating ? "Annotation on" : "Enable annotation"}
        </button>

        {buttons.map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTool(id);
              setAnnotating(true);
            }}
            className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${tool === id && annotating ? "bg-indigo-600" : "bg-white/10 hover:bg-white/20"}`}
          >
            {icon}
            {label}
          </button>
        ))}

        <input
          aria-label="Color"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="h-9 w-11 bg-transparent"
        />
        <input
          aria-label="Size"
          type="range"
          min="2"
          max="18"
          value={size}
          onChange={(event) => setSize(Number(event.target.value))}
        />
        <button
          type="button"
          onClick={undo}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
        >
          <Undo2 size={14} />
          Undo
        </button>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
        >
          <Trash2 size={14} />
          Clear
        </button>

        {isVid(file) && (
          <>
            <label className="flex items-center gap-1 text-xs">
              Start
              <input
                type="number"
                min="0"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="w-16 rounded bg-white/10 px-2 py-1 text-white"
              />
            </label>

            <label className="flex items-center gap-1 text-xs">
              End
              <input
                type="number"
                min="0"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="w-16 rounded bg-white/10 px-2 py-1 text-white"
              />
            </label>
          </>
        )}

        <select
          value={selectedAnnotationId}
          onChange={(event) => setSelectedAnnotationId(event.target.value)}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white"
        >
          <option value="">Select annotation</option>
          {annotations.map((item, index) => (
            <option key={item.id} value={item.id}>
              {item.type} #{index + 1}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            if (!selectedAnnotationId) return;
            setAnnotations((items) =>
              items.filter((item) => item.id !== selectedAnnotationId),
            );
            setSelectedAnnotationId("");
          }}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
        >
          Delete selected
        </button>
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
        >
          <Download size={14} />
          Download annotation
        </button>
        <button
          type="button"
          onClick={saveAnnotation}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-60"
        >
          <Download size={14} />
          {saving ? "Saving..." : "Save annotation"}
        </button>
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
        >
          <ExternalLink size={14} />
          Open original
        </a>
      </div>

      <div ref={stageRef} className="relative min-h-[620px] flex-1 overflow-hidden bg-black">
        {isImg(file) && (
          <img
            src={imageDisplayUrl(file)}
            alt={fileLabel(file)}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}

        {isVid(file) && (
          <video
            src={file.url}
            controls
            preload="metadata"
            className="absolute inset-0 h-full w-full object-contain"
            onTimeUpdate={(event) => {
              renderAnnotations(annotations, event.currentTarget.currentTime);
            }}
          />
        )}

        <canvas
          ref={canvasRef}
          className={`absolute inset-0 z-10 h-full w-full touch-none ${annotating ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`}
          onMouseDown={down}
          onMouseMove={move}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={down}
          onTouchMove={move}
          onTouchEnd={stop}
        />
      </div>
    </div>
  );
}

export default function FileWorkspace({ file }) {
  if (!isImg(file) && !isVid(file)) return null;

  return (
    <div className="h-full min-h-[620px] overflow-hidden rounded-2xl bg-white dark:bg-slate-900">
      <AnnotationWorkspace file={file} />
    </div>
  );
}
