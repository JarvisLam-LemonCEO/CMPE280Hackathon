import { startTrace, trackEvent, trackException } from "./telemetry";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif", "avif"];
const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v", "avi", "mkv"];

function getResourceType(file) {
  const mimeType = file?.type || "";
  const ext = file?.name?.split(".").pop()?.toLowerCase() || "";

  if (mimeType.startsWith("image/") || IMAGE_EXTS.includes(ext)) return "image";
  if (mimeType.startsWith("video/") || VIDEO_EXTS.includes(ext)) return "video";
  throw new Error("Only image and video uploads are supported.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function uploadSimple(file, resourceType, retries = 2) {
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
        { method: "POST", body: form },
      );

      if (!res.ok) {
        const errBody = await safeJson(res);
        throw new Error(
          errBody?.error?.message ||
            errBody?.raw ||
            `Cloudinary upload failed with status ${res.status}`,
        );
      }

      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
}

async function uploadVideoChunked(file, chunkSize = 20 * 1024 * 1024) {
  const uploadId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const totalSize = file.size;
  let start = 0;
  let finalResponse = null;

  while (start < totalSize) {
    const end = Math.min(start + chunkSize, totalSize);
    const chunk = file.slice(start, end);
    const form = new FormData();
    form.append("file", chunk);
    form.append("upload_preset", UPLOAD_PRESET);

    const contentRange = `bytes ${start}-${end - 1}/${totalSize}`;
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
      {
        method: "POST",
        headers: {
          "X-Unique-Upload-Id": uploadId,
          "Content-Range": contentRange,
        },
        body: form,
      },
    );

    if (!res.ok) {
      const errBody = await safeJson(res);
      throw new Error(
        errBody?.error?.message ||
          errBody?.raw ||
          `Cloudinary chunk upload failed at ${contentRange}`,
      );
    }

    finalResponse = await res.json();
    start = end;
  }

  return finalResponse;
}

export async function uploadToCloudinary(file) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env",
    );
  }

  if (!file) {
    throw new Error("No file provided for upload.");
  }

  const resourceType = getResourceType(file);
  const fileType = file?.type || "unknown";
  const fileSize = file?.size || 0;
  const uploadTrace = startTrace("cloudinary_file_upload", {
    attributes: { file_type: fileType, resource_type: resourceType },
    metrics: { file_size_bytes: fileSize },
  });
  trackEvent("cloudinary_file_upload_start", {
    file_type: fileType,
    file_size_bytes: fileSize,
    resource_type: resourceType,
  });

  try {
    const isLargeVideo =
      resourceType === "video" &&
      typeof file.size === "number" &&
      file.size > 100 * 1024 * 1024;
    const data = isLargeVideo
      ? await uploadVideoChunked(file)
      : await uploadSimple(file, resourceType);

    uploadTrace?.putAttribute("status", "success");
    uploadTrace?.putMetric("response_bytes", data.bytes || 0);
    trackEvent("cloudinary_file_upload_success", {
      file_type: fileType,
      file_size_bytes: fileSize,
      response_bytes: data.bytes || 0,
      resource_type: data.resource_type || resourceType,
    });

    return {
      url: data.secure_url,
      publicId: data.public_id,
      resourceType: data.resource_type || resourceType,
      mimeType: file.type || (resourceType === "video" ? "video/*" : "image/*"),
      originalFilename: file.name || data.original_filename || "uploaded-file",
      bytes: typeof file.size === "number" ? file.size : data.bytes,
    };
  } catch (err) {
    uploadTrace?.putAttribute("status", "error");
    uploadTrace?.putAttribute("error_code", err?.code || err?.name || "error");
    trackEvent("cloudinary_file_upload_failed", {
      file_type: fileType,
      error_code: err?.code || err?.name || "error",
      resource_type: resourceType,
    });
    trackException(err, { area: "cloudinary_file_upload" });
    throw err;
  } finally {
    uploadTrace?.stop();
  }
}
