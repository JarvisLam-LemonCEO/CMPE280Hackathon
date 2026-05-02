import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { Film, Download, RefreshCw, Save, X, Loader2, GripVertical, Sparkles } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { db } from "../lib/firebase";
import { generateAlbumVideo } from "../lib/videoGenerator";
import { aiCompose, isOpenAIConfigured } from "../lib/openaiCompose";

const SECONDS_OPTIONS = [2, 3, 5];
const ASPECT_OPTIONS = [
  { value: "16:9", label: "16:9 — Landscape" },
  { value: "1:1", label: "1:1 — Square" },
  { value: "9:16", label: "9:16 — Portrait" },
];
const TRANSITION_OPTIONS = [
  { value: "none", label: "None (instant cut)" },
  { value: "fade", label: "Fade" },
  { value: "slide-left", label: "Slide left" },
  { value: "slide-up", label: "Slide up" },
  { value: "zoom-in", label: "Zoom in" },
  { value: "zoom-out", label: "Zoom out" },
];

function SortableThumb({ photo, index }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id || photo.publicId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square overflow-hidden rounded-md ring-1 ring-slate-200 dark:ring-slate-700"
    >
      <img
        src={photo.url}
        alt={photo.title || ""}
        className="h-full w-full object-cover"
        draggable={false}
      />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/40 px-1 py-0.5 text-[10px] font-bold text-white">
        <span>#{index + 1}</span>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-0.5 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical size={10} />
        </button>
      </div>
    </div>
  );
}

export default function VideoGeneratorModal({
  open,
  onClose,
  album,
  albumPhotos = [],
  ownerUid,
  ownerName,
}) {
  const [seconds, setSeconds] = useState(3);
  const [aspect, setAspect] = useState("16:9");
  const [transitionSec, setTransitionSec] = useState(0.5);

  const [orderedPhotos, setOrderedPhotos] = useState([]);
  // One transition per pair, length = orderedPhotos.length - 1.
  const [transitions, setTransitions] = useState([]);

  // AI compose state.
  const [aiTitle, setAiTitle] = useState("");
  const [aiReasoning, setAiReasoning] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState({ stage: "", current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [savedId, setSavedId] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Only photos that have a Cloudinary publicId can be in the slideshow.
  const usablePhotosFromAlbum = useMemo(
    () => (albumPhotos || []).filter((p) => p && p.publicId),
    [albumPhotos],
  );

  // Reset on open / album change.
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setProgress({ stage: "", current: 0, total: 0 });
      setErrorMsg("");
      setResult(null);
      setSavingDoc(false);
      setSavedId("");
      setOrderedPhotos(usablePhotosFromAlbum);
      setTransitions(
        Array(Math.max(usablePhotosFromAlbum.length - 1, 0)).fill("fade"),
      );
      setAiTitle("");
      setAiReasoning("");
      setAiError("");
    }
  }, [open, album?.id, usablePhotosFromAlbum]);

  // Keep transitions array in sync with photo count after reorder/AI changes.
  useEffect(() => {
    setTransitions((prev) => {
      const target = Math.max(orderedPhotos.length - 1, 0);
      if (prev.length === target) return prev;
      const next = prev.slice(0, target);
      while (next.length < target) next.push("fade");
      return next;
    });
  }, [orderedPhotos.length]);

  const setTransitionAt = (i, value) => {
    setTransitions((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  const setAllTransitions = (value) => {
    setTransitions(Array(Math.max(orderedPhotos.length - 1, 0)).fill(value));
  };

  const handleAiCompose = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError("");
    try {
      const result = await aiCompose(orderedPhotos);
      // Reorder photos according to AI's suggested permutation.
      const reordered = result.order.map((idx) => orderedPhotos[idx]).filter(Boolean);
      if (reordered.length === orderedPhotos.length) {
        setOrderedPhotos(reordered);
      }
      setSeconds(result.secondsPerImage);
      if (Array.isArray(result.transitions) && result.transitions.length > 0) {
        setTransitions(result.transitions);
      }
      setAspect(result.aspectRatio);
      setAiTitle(result.title);
      setAiReasoning(result.reasoning);
    } catch (err) {
      console.error("AI compose failed", err);
      setAiError(err?.message || "AI composition failed.");
    } finally {
      setAiLoading(false);
    }
  };

  if (!open || !album) return null;

  const photoCount = orderedPhotos.length;
  const estimatedSec = Math.max(photoCount * seconds, 1);
  const overLimit = estimatedSec > 60;
  const maxTransition = seconds / 2;

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedPhotos((items) => {
      const oldIndex = items.findIndex((p) => (p.id || p.publicId) === active.id);
      const newIndex = items.findIndex((p) => (p.id || p.publicId) === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleGenerate = async () => {
    setStatus("generating");
    setErrorMsg("");
    setResult(null);
    setProgress({ stage: "downloading", current: 0, total: photoCount });
    try {
      const out = await generateAlbumVideo(
        {
          images: orderedPhotos,
          options: {
            secondsPerImage: seconds,
            aspectRatio: aspect,
            transitions,
            transitionMs: Math.round(transitionSec * 1000),
          },
        },
        (p) => setProgress(p),
      );
      setResult(out);
      setStatus("done");
    } catch (err) {
      console.error("video generation failed", err);
      setErrorMsg(err?.message || "Could not generate the video.");
      setStatus("error");
    }
  };

  const handleSaveToGallery = async () => {
    if (!result || !ownerUid || savingDoc || savedId) return;
    setSavingDoc(true);
    try {
      const ref = await addDoc(collection(db, "videos"), {
        ownerUid,
        ownerName: ownerName || "",
        albumId: album.id,
        title: aiTitle || `${album.name || album.title || "Album"} – Video`,
        url: result.videoUrl,
        publicId: result.publicId,
        durationSec: result.durationSec,
        imageIds: orderedPhotos.map((p) => p.id).filter(Boolean),
        createdAt: Timestamp.now(),
        isShared: false,
        sharedWith: [],
      });
      setSavedId(ref.id);
    } catch (err) {
      console.error("save video failed", err);
      setErrorMsg(err?.message || "Could not save the video to your gallery.");
    } finally {
      setSavingDoc(false);
    }
  };

  const handleAgain = () => {
    setStatus("idle");
    setResult(null);
    setSavedId("");
    setErrorMsg("");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#2a3655] p-6 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="modal-title flex items-center gap-2">
              <Film size={20} className="text-indigo-500" />
              Generate video for "{album.name || album.title}"
            </h2>
            <p className="modal-subtitle">
              Drag photos to reorder · choose transitions · max 60 seconds
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {status === "idle" && (
          <div className="mt-5 space-y-5">
            {/* AI Auto-compose */}
            {isOpenAIConfigured() && photoCount >= 2 && (
              <div className="rounded-xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-fuchsia-50 p-4 dark:border-indigo-900/60 dark:from-indigo-950/40 dark:to-fuchsia-950/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                      <Sparkles size={16} />
                      AI Auto-compose
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      Let GPT-4o-mini look at your photos and pick the order, transition, duration, aspect, and a title for you.
                    </p>
                    {aiTitle && (
                      <div className="mt-3 rounded-lg bg-white/70 p-2 dark:bg-slate-800/40">
                        <p className="text-sm font-bold text-[#0f172f] dark:text-white">
                          “{aiTitle}”
                        </p>
                        {aiReasoning && (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {aiReasoning}
                          </p>
                        )}
                      </div>
                    )}
                    {aiError && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                        {aiError}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAiCompose}
                    disabled={aiLoading}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Composing…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        {aiTitle ? "Re-compose" : "Auto-compose"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Form */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Seconds per image</label>
                <select
                  className="form-input-modal"
                  value={seconds}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSeconds(v);
                    if (transitionSec > v / 2) setTransitionSec(v / 2);
                  }}
                >
                  {SECONDS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s} seconds
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Aspect ratio</label>
                <select
                  className="form-input-modal"
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value)}
                >
                  {ASPECT_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">
                  Transition duration ({transitionSec.toFixed(1)}s)
                </label>
                <input
                  type="range"
                  min="0"
                  max={maxTransition}
                  step="0.1"
                  value={Math.min(transitionSec, maxTransition)}
                  onChange={(e) => setTransitionSec(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span>0s</span>
                  <span>{maxTransition.toFixed(1)}s max</span>
                </div>
              </div>
            </div>

            {/* Per-pair transitions */}
            {orderedPhotos.length >= 2 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Transitions between photos
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Set all:
                    </span>
                    <select
                      className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setAllTransitions(e.target.value);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="" className="bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-100">Bulk apply…</option>
                      {TRANSITION_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value} className="bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                  {orderedPhotos.slice(0, -1).map((p, i) => {
                    const next = orderedPhotos[i + 1];
                    return (
                      <div
                        key={`${p.id || p.publicId}-${next.id || next.publicId}`}
                        className="flex items-center gap-2"
                      >
                        <img
                          src={p.url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                        />
                        <select
                          value={transitions[i] || "fade"}
                          onChange={(e) => setTransitionAt(i, e.target.value)}
                          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        >
                          {TRANSITION_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value} className="bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <img
                          src={next.url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Photos preview with drag-and-drop */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Photo order (drag to reorder)
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {photoCount} photos · ~{estimatedSec}s video
                </span>
              </div>

              {overLimit && (
                <p className="mb-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
                  Video would be {estimatedSec}s. Max allowed is <strong>60 seconds</strong>. Reduce seconds per image or remove photos from this album.
                </p>
              )}

              {photoCount === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                  No Cloudinary-uploaded photos in this album yet. Add at least 2 uploaded photos to build a video.
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={orderedPhotos.map((p) => p.id || p.publicId)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                      {orderedPhotos.map((p, i) => (
                        <SortableThumb key={p.id || p.publicId} photo={p} index={i} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {errorMsg && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
                {errorMsg}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary disabled:opacity-50"
                onClick={handleGenerate}
                disabled={photoCount < 2 || overLimit}
              >
                Generate Video
              </button>
            </div>
          </div>
        )}

        {status === "generating" && (() => {
          const stage = progress.stage;
          const ratio = typeof progress.ratio === "number" ? progress.ratio : 0;
          const stageLabel =
            stage === "downloading" ? `Loading photos (${progress.current ?? 0} / ${progress.total ?? photoCount})` :
            stage === "encoding" ? "Recording video" :
            stage === "uploading" ? "Uploading to your gallery" :
            "Building slideshow";
          const overall =
            stage === "downloading" ? 0.1 * ((progress.current ?? 0) / Math.max(progress.total ?? photoCount, 1)) :
            stage === "encoding" ? 0.1 + 0.85 * ratio :
            stage === "uploading" ? 0.97 :
            0;
          const pct = Math.round(overall * 100);
          return (
            <div className="mt-8 flex flex-col items-center gap-4 py-8">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {stageLabel}…
              </p>
              <div className="w-full max-w-md">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full bg-indigo-500 transition-[width] duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{pct}%</span>
                  <span>
                    {stage === "encoding" && `${Math.round(ratio * 100)}% of frames`}
                    {stage === "downloading" && `${progress.current ?? 0} of ${progress.total ?? photoCount}`}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Runs in your browser. Keep this tab open.
              </p>
            </div>
          );
        })()}

        {status === "done" && result && (
          <div className="mt-5 space-y-4">
            <video
              key={result.videoUrl}
              src={result.videoUrl}
              controls
              autoPlay
              className="w-full rounded-xl bg-black"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Duration: ~{result.durationSec}s · {photoCount} photos
              {savedId && " · Saved to your gallery"}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" className="btn-cancel" onClick={handleAgain}>
                <RefreshCw size={14} className="mr-1 inline" />
                Generate again
              </button>
              <a
                href={result.videoUrl}
                download={`${album.name || "album"}-slideshow.mp4`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
              >
                <Download size={14} />
                Download
              </a>
              <button
                type="button"
                className="btn-primary disabled:opacity-50"
                onClick={handleSaveToGallery}
                disabled={savingDoc || !!savedId}
              >
                <Save size={14} className="mr-1 inline" />
                {savedId ? "Saved" : savingDoc ? "Saving…" : "Save to gallery"}
              </button>
            </div>
            {errorMsg && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
                {errorMsg}
              </p>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="mt-5 space-y-4">
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
              {errorMsg || "Something went wrong while generating the video."}
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn-primary" onClick={handleAgain}>
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
