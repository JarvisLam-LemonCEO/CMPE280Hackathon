/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Download,
  Edit3,
  ExternalLink,
  Maximize2,
  PenTool,
  RefreshCw,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { isDoc, isPpt, isImg, isVid, isPdf, imageDisplayUrl } from "./fileTypeUtils";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { uploadToCloudinary } from "../lib/cloudinary";
import { useCallback } from "react";

const safeUrl = (url) => encodeURIComponent(url || "");
const officeUrl = (f) => `https://view.officeapps.live.com/op/embed.aspx?src=${safeUrl(f.url)}`;
const googleUrl = (f) => `https://docs.google.com/gview?embedded=1&url=${safeUrl(f.url)}`;
const officeScheme = (f) => (isDoc(f) ? "ms-word:ofe|u|" : isPpt(f) ? "ms-powerpoint:ofe|u|" : "");
const fileLabel = (f) => f?.originalFilename || f?.title || "Uploaded file";


function OfficeWorkspace({ file, currentSlideIndex, setCurrentSlideIndex }) {
  const viewers = useMemo(
    () => [
      { id: "office", label: "Office viewer", src: officeUrl(file) },
      { id: "google", label: "Google viewer", src: googleUrl(file) },
    ],
    [file],
  );
  const [viewerIndex, setViewerIndex] = useState(0);
  const [frameKey, setFrameKey] = useState(0);
  const viewer = viewers[viewerIndex];

  const present = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${fileLabel(file)}</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#000}</style></head><body><iframe src="${viewer.src}" allowfullscreen></iframe></body></html>`);
    win.document.close();
  };

  const switchViewer = () => {
    setViewerIndex((current) => (current + 1) % viewers.length);
    setFrameKey((key) => key + 1);
  };

  return (
    <div className="flex h-full min-h-[620px] flex-col bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{fileLabel(file)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Viewing with {viewer.label}. Use Edit in Office for actual DOCX/PPTX editing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              window.location.href = `${officeScheme(file)}${file.url}`;
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <Edit3 size={14} />
            Edit in Office
          </button>
          {isPpt(file) && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const presentationUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`;
                  window.open(presentationUrl, "_blank", "noopener,noreferrer");
                }}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-black hover:bg-white/20"
              >
                Present
              </button>
              <span className="text-xs text-black/80">
                Slide {currentSlideIndex + 1}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={switchViewer}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw size={14} />
            Try alternate viewer
          </button>
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            <ExternalLink size={14} />
            Open original
          </a>
        </div>
      </div>
      <div className="relative flex-1 bg-white">
        <iframe
          key={`${viewer.id}-${frameKey}`}
          title={`${fileLabel(file)} preview`}
          src={viewer.src}
          className="h-full min-h-[620px] w-full border-0 bg-white"
          allowFullScreen
        />
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl bg-slate-950/75 px-3 py-2 text-xs text-white shadow-lg">
          If the preview area stays blank, click <span className="font-semibold">Try alternate viewer</span> or <span className="font-semibold">Open original</span>. Cloudinary files must be publicly reachable for embedded Office/Google preview.
        </div>
      </div>
    </div>
  );
}

function AnnotationWorkspace({ file, currentSlideIndex, setCurrentSlideIndex }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const drawing = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const snap = useRef(null);
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
  const currentAnnotation = useRef(null);

  const saveAnnotation = async () => {
    if (!file?.id) {
      alert("This file cannot save annotations because it is not an uploaded file.");
      return;
    }

    try {
      setSaving(true);

      const annotationCollection = file.isEventPhoto ? "eventPhotos" : "uploads";

      await updateDoc(doc(db, annotationCollection, file.id), {
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

  const resize = () => {
    const c = canvasRef.current;
    const s = stageRef.current;
    if (!c || !s) return;
    const old = document.createElement("canvas");
    old.width = c.width;
    old.height = c.height;
    if (c.width && c.height) old.getContext("2d").drawImage(c, 0, 0);
    const r = s.getBoundingClientRect();
    c.width = Math.max(1, r.width);
    c.height = Math.max(1, r.height);
    if (old.width && old.height) c.getContext("2d").drawImage(old, 0, 0, c.width, c.height);
  };

  const renderAnnotations = useCallback(
    (items = annotations, videoTime = null) => {
      const c = canvasRef.current;
      if (!c) return;

      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);

      const visibleItems = items.filter((item) => {
        if (isVid(file)) {
          const t = Number(videoTime || 0);
          return (
            t >= Number(item.startTime || 0) &&
            t <= Number(item.endTime || 999999)
          );
        }

        if (isPpt(file)) {
          return Number(item.slideIndex || 0) === Number(currentSlideIndex);
        }

        return true;
      });

      visibleItems.forEach((item) => {
        ctx.strokeStyle = item.color;
        ctx.fillStyle = item.color;
        ctx.lineWidth = item.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (item.type === "pen") {
          ctx.beginPath();
          item.points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
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
    [annotations, file, currentSlideIndex]
  );

  useEffect(() => {
    const id = requestAnimationFrame(resize);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", resize);
    };
  }, [file?.url]);

  useEffect(() => {
    renderAnnotations();
  }, [annotations, renderAnnotations]);

  useEffect(() => {
    setAnnotations(file?.annotations || []);
  }, [file?.annotations]);

  useEffect(() => {
  if (!file?.annotationOverlayUrl) return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
  };
  img.src = file.annotationOverlayUrl;
}, [file?.annotationOverlayUrl, file?.url]);

  const point = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const t = e.touches?.[0] || e.changedTouches?.[0];
    return { x: (t?.clientX ?? e.clientX) - r.left, y: (t?.clientY ?? e.clientY) - r.top };
  };
  const remember = () => setHistory((h) => [...h.slice(-12), canvasRef.current.toDataURL("image/png")]);
  const down = (e) => {
    if (!annotating) return;

    e.preventDefault();

    const p = point(e);

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
      slideIndex: isPpt(file) ? currentSlideIndex : null,
    };

    if (tool === "text") {
      const text = prompt("Annotation text");
      if (!text) return;
      annotation.text = text;
      setAnnotations((items) => [...items, annotation]);
      setSelectedAnnotationId(annotation.id);
      return;
    }

    drawing.current = true;
    currentAnnotation.current = annotation;
  };

  const move = (e) => {
    if (!drawing.current || !annotating || !currentAnnotation.current) return;

    e.preventDefault();

    const p = point(e);
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
      const c = canvasRef.current;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      setHistory((h) => h.slice(0, -1));
    };
    img.src = last;
  };
  const clear = () => {
    remember();
    const c = canvasRef.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
  };
  const download = () => {
    const a = document.createElement("a");
    a.download = `${file.title || "file"}-annotations.png`;
    a.href = canvasRef.current.toDataURL("image/png");
    a.click();
  };
  const buttons = [["pen", PenTool, "Draw"], ["rect", Square, "Box"], ["circle", Circle, "Circle"], ["text", Type, "Text"]];

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
        {buttons.map(([id, Icon, label]) => (
          <button key={id} type="button" onClick={() => { setTool(id); setAnnotating(true); }} className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${tool === id && annotating ? "bg-indigo-600" : "bg-white/10 hover:bg-white/20"}`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
        <input aria-label="Color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-11 bg-transparent" />
        <input aria-label="Size" type="range" min="2" max="18" value={size} onChange={(e) => setSize(Number(e.target.value))} />
        <button type="button" onClick={undo} className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"><Undo2 size={14} />Undo</button>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"><Trash2 size={14} />Clear</button>
        <label className="flex items-center gap-1 text-xs">
          Start
          <input
            type="number"
            min="0"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-16 rounded bg-white/10 px-2 py-1 text-white"
          />
        </label>

        <label className="flex items-center gap-1 text-xs">
          End
          <input
            type="number"
            min="0"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-16 rounded bg-white/10 px-2 py-1 text-white"
          />
        </label>
        <select
          value={selectedAnnotationId}
          onChange={(e) => setSelectedAnnotationId(e.target.value)}
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
              items.filter((item) => item.id !== selectedAnnotationId)
            );
            setSelectedAnnotationId("");
          }}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
        >
          Delete selected
        </button>
        <button
          type="button"
          onClick={saveAnnotation}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-60">
          <Download size={14} />
          {saving ? "Saving..." : "Save annotation"}
        </button>
        <a href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"><ExternalLink size={14} />Open original</a>
      </div>
      <div ref={stageRef} className="relative min-h-[620px] flex-1 overflow-hidden bg-black">
        {isImg(file) && (
          <img
            src={imageDisplayUrl(file)}
            alt={file.title || file.originalFilename || "File"}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}

        {isVid(file) && (
          <video
            src={file.url}
            controls
            preload="metadata"
            className="absolute inset-0 h-full w-full object-contain"
            onTimeUpdate={(e) => {
              renderAnnotations(annotations, e.currentTarget.currentTime);
            }}
          />
        )}

        {isPdf(file) && (
          <iframe
            title={file.title || "PDF"}
            src={file.url}
            className="absolute inset-0 h-full w-full border-0 bg-white"
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
  const canOffice = isDoc(file) || isPpt(file);
  const canAnnotate = isImg(file) || isVid(file) || isPdf(file);
  const [mode, setMode] = useState(canOffice ? "office" : "annotate");
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  if (!canOffice && !canAnnotate) return null;
  return (
    <div className="h-full min-h-[620px] overflow-hidden rounded-2xl bg-white dark:bg-slate-900">
      {canOffice && canAnnotate && (
        <div className="flex gap-2 border-b border-slate-200 p-2 dark:border-slate-700">
          <button onClick={() => setMode("office")} className={`rounded-xl px-3 py-2 text-xs font-semibold ${mode === "office" ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>Preview/Edit</button>
          <button onClick={() => setMode("annotate")} className={`rounded-xl px-3 py-2 text-xs font-semibold ${mode === "annotate" ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>Annotate</button>
        </div>
      )}
      {canOffice && mode === "office" ? <OfficeWorkspace
        file={file}
        currentSlideIndex={currentSlideIndex}
        setCurrentSlideIndex={setCurrentSlideIndex}
      /> : <AnnotationWorkspace
            file={file}
            currentSlideIndex={currentSlideIndex}
            setCurrentSlideIndex={setCurrentSlideIndex}
          />}
    </div>
  );
}
