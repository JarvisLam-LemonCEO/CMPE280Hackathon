// Generate a slideshow video in the BROWSER using Canvas + MediaRecorder,
// then upload the resulting blob to Cloudinary.

import { startTrace } from "./telemetry";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const ASPECT_DIMS = {
  "16:9": { w: 1280, h: 720 },
  "1:1": { w: 720, h: 720 },
  "9:16": { w: 720, h: 1280 },
};

const TRANSITIONS = ["none", "fade", "slide-left", "slide-up", "zoom-in", "zoom-out"];

function pickMimeType() {
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
      return m;
    }
  }
  return "video/webm";
}

function scaledCloudinaryUrl(originalUrl, w, h) {
  if (!originalUrl?.includes("/upload/")) return originalUrl;
  return originalUrl.replace("/upload/", `/upload/c_fill,w_${w},h_${h},q_auto,f_jpg/`);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

async function uploadVideoBlobToCloudinary(blob) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env",
    );
  }

  const fileType = blob?.type || "unknown";
  const fileSize = blob?.size || 0;
  const uploadTrace = startTrace("cloudinary_video_upload", {
    attributes: { file_type: fileType },
    metrics: { file_size_bytes: fileSize },
  });

  const form = new FormData();
  form.append("file", blob, "slideshow");
  form.append("upload_preset", UPLOAD_PRESET);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
      { method: "POST", body: form },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudinary upload failed (${res.status}): ${text.slice(0, 240)}`);
    }
    const data = await res.json();
    uploadTrace?.putAttribute("status", "success");
    uploadTrace?.putMetric("response_bytes", data.bytes || 0);
    return { videoUrl: data.secure_url, publicId: data.public_id };
  } catch (err) {
    uploadTrace?.putAttribute("status", "error");
    uploadTrace?.putAttribute("error_code", err?.code || err?.name || "error");
    throw err;
  } finally {
    uploadTrace?.stop();
  }
}

export { TRANSITIONS };

/**
 * Build a slideshow video from album images.
 *
 * options.transition: one of TRANSITIONS
 * options.transitionMs: ms for the transition (default 500). Capped to half
 *   the per-image time so each image is fully visible at some point.
 */
export async function generateAlbumVideo(
  { images, options = {} } = {},
  onProgress,
) {
  if (!Array.isArray(images) || images.length < 2) {
    throw new Error("Need at least 2 photos for a slideshow.");
  }
  const usable = images.filter((img) => img && img.url);
  if (usable.length < 2) {
    throw new Error("Album needs at least 2 photos with valid URLs.");
  }

  const secondsPerImage = Number(options.secondsPerImage) || 3;
  const aspectKey = ASPECT_DIMS[options.aspectRatio] ? options.aspectRatio : "16:9";
  const { w, h } = ASPECT_DIMS[aspectKey];
  const totalDurationSec = usable.length * secondsPerImage;

  if (totalDurationSec > 60) {
    throw new Error(
      `Video can be at most 60 seconds. Yours would be ${totalDurationSec}s. Reduce seconds per image or photos in album.`,
    );
  }

  // Accept either:
  //   options.transitions: string[] of length usable.length-1 (per-pair)
  //   options.transition: single string applied to all pairs (legacy)
  const buildPerPair = () => {
    if (Array.isArray(options.transitions) && options.transitions.length > 0) {
      const arr = [];
      for (let i = 0; i < usable.length - 1; i++) {
        const t = options.transitions[i];
        arr.push(TRANSITIONS.includes(t) ? t : "fade");
      }
      return arr;
    }
    const single = TRANSITIONS.includes(options.transition)
      ? options.transition
      : "fade";
    return Array(Math.max(usable.length - 1, 0)).fill(single);
  };
  const perPairTransitions = buildPerPair();
  const requestedTransMs = Math.max(0, Number(options.transitionMs ?? 500));
  const transitionMs = Math.min(requestedTransMs, (secondsPerImage * 1000) / 2);

  const totalTrace = startTrace("generate_album_video_total", {
    attributes: { aspect_ratio: aspectKey },
    metrics: {
      image_count: usable.length,
      seconds_per_image: secondsPerImage,
      duration_sec: totalDurationSec,
      transition_count: perPairTransitions.length,
    },
  });

  try {
  // Pre-load images.
  const loadedImages = [];
  const downloadTrace = startTrace("video_download_images", {
    attributes: { aspect_ratio: aspectKey },
    metrics: { image_count: usable.length },
  });
  try {
  for (let i = 0; i < usable.length; i++) {
    onProgress?.({
      stage: "downloading",
      current: i + 1,
      total: usable.length,
      ratio: i / usable.length,
    });
    const url = scaledCloudinaryUrl(usable[i].url, w, h);
    const img = await loadImage(url);
    loadedImages.push(img);
  }
  downloadTrace?.putAttribute("status", "success");
  } catch (err) {
    downloadTrace?.putAttribute("status", "error");
    downloadTrace?.putAttribute("error_code", err?.code || err?.name || "error");
    throw err;
  } finally {
    downloadTrace?.stop();
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  const stream = canvas.captureStream(30);
  const mimeType = pickMimeType();
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Your browser doesn't support MediaRecorder.");
  }
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  // Geometry for "contained" image draw.
  const containedRect = (img) => {
    const ir = img.width / img.height;
    const cr = w / h;
    let dw, dh;
    if (ir > cr) {
      dw = w;
      dh = w / ir;
    } else {
      dh = h;
      dw = h * ir;
    }
    return { dw, dh, dx: (w - dw) / 2, dy: (h - dh) / 2 };
  };

  const clearCanvas = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
  };

  const drawAt = (img, dx, dy, dw, dh, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
  };

  const drawContained = (img, alpha = 1) => {
    const { dx, dy, dw, dh } = containedRect(img);
    drawAt(img, dx, dy, dw, dh, alpha);
  };

  // Apply a specific transition between current (a) and next (b) at t (0..1).
  const drawTransition = (kind, a, b, t) => {
    clearCanvas();
    if (kind === "none") {
      drawContained(t < 0.5 ? a : b);
      return;
    }
    if (kind === "fade") {
      drawContained(a, 1 - t);
      drawContained(b, t);
      return;
    }
    if (kind === "slide-left") {
      const offA = -t * w;
      const offB = (1 - t) * w;
      const ar = containedRect(a);
      const br = containedRect(b);
      drawAt(a, ar.dx + offA, ar.dy, ar.dw, ar.dh, 1);
      drawAt(b, br.dx + offB, br.dy, br.dw, br.dh, 1);
      return;
    }
    if (kind === "slide-up") {
      const offA = -t * h;
      const offB = (1 - t) * h;
      const ar = containedRect(a);
      const br = containedRect(b);
      drawAt(a, ar.dx, ar.dy + offA, ar.dw, ar.dh, 1);
      drawAt(b, br.dx, br.dy + offB, br.dw, br.dh, 1);
      return;
    }
    if (kind === "zoom-in") {
      drawContained(a, 1 - t);
      const br = containedRect(b);
      const scale = 0.4 + 0.6 * t;
      const dw = br.dw * scale;
      const dh = br.dh * scale;
      drawAt(b, (w - dw) / 2, (h - dh) / 2, dw, dh, t);
      return;
    }
    if (kind === "zoom-out") {
      const ar = containedRect(a);
      const scale = 1 - 0.6 * t;
      const dw = ar.dw * scale;
      const dh = ar.dh * scale;
      drawAt(a, (w - dw) / 2, (h - dh) / 2, dw, dh, 1 - t);
      drawContained(b, t);
      return;
    }
    drawContained(a, 1 - t);
    drawContained(b, t);
  };

  const paintFrame = (elapsedMs) => {
    const slotMs = secondsPerImage * 1000;
    const idx = Math.min(Math.floor(elapsedMs / slotMs), loadedImages.length - 1);
    const localMs = elapsedMs - idx * slotMs;
    const fadeStart = slotMs - transitionMs;

    if (
      transitionMs <= 0 ||
      localMs < fadeStart ||
      idx >= loadedImages.length - 1
    ) {
      clearCanvas();
      drawContained(loadedImages[idx], 1);
      return;
    }
    const t = (localMs - fadeStart) / transitionMs;
    const kind = perPairTransitions[idx] || "fade";
    drawTransition(kind, loadedImages[idx], loadedImages[idx + 1], t);
  };

  const encodeTrace = startTrace("video_encode_browser", {
    attributes: {
      aspect_ratio: aspectKey,
      mime_type: mimeType,
    },
    metrics: {
      image_count: usable.length,
      duration_sec: totalDurationSec,
      width: w,
      height: h,
    },
  });
  let blob;

  try {
    onProgress?.({ stage: "encoding", ratio: 0 });

    await new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = (e) => reject(e?.error || new Error("MediaRecorder error"));

      const startTime = performance.now();
      const totalMs = totalDurationSec * 1000;

      paintFrame(0);
      recorder.start(200);

      const tick = () => {
        const elapsed = performance.now() - startTime;
        paintFrame(Math.min(elapsed, totalMs));
        onProgress?.({
          stage: "encoding",
          ratio: Math.min(elapsed / totalMs, 1),
        });
        if (elapsed >= totalMs) {
          setTimeout(() => {
            if (recorder.state !== "inactive") recorder.stop();
          }, 150);
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    blob = new Blob(chunks, { type: mimeType.split(";")[0] });
    encodeTrace?.putAttribute("status", "success");
    encodeTrace?.putMetric("output_bytes", blob.size || 0);
    encodeTrace?.putMetric("chunk_count", chunks.length);
  } catch (err) {
    encodeTrace?.putAttribute("status", "error");
    encodeTrace?.putAttribute("error_code", err?.code || err?.name || "error");
    throw err;
  } finally {
    encodeTrace?.stop();
  }

  onProgress?.({ stage: "uploading", ratio: 1 });
  const { videoUrl, publicId } = await uploadVideoBlobToCloudinary(blob);

  totalTrace?.putAttribute("status", "success");
  totalTrace?.putMetric("output_bytes", blob.size || 0);
  return { videoUrl, publicId, durationSec: totalDurationSec };
  } catch (err) {
    totalTrace?.putAttribute("status", "error");
    totalTrace?.putAttribute("error_code", err?.code || err?.name || "error");
    throw err;
  } finally {
    totalTrace?.stop();
  }
}
