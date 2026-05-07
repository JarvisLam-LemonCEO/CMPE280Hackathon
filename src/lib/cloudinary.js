const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

function getResourceType(file) {
  const mimeType = file?.type || "";
  const name = file?.name || "";
  const ext = name.split(".").pop()?.toLowerCase();

  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif", "avif"];
  const videoExts = ["mp4", "mov", "webm", "m4v", "avi", "mkv"];

  if (mimeType.startsWith("image/") || imageExts.includes(ext)) return "image";
  if (mimeType.startsWith("video/") || videoExts.includes(ext)) return "video";

  return "raw";
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
        {
          method: "POST",
          body: form,
        },
      );

      if (!res.ok) {
        const errBody = await safeJson(res);
        throw new Error(
          errBody?.error?.message ||
            errBody?.raw ||
            `Upload failed with status ${res.status}`,
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
          `Chunk upload failed at ${contentRange}`,
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

  const isLargeVideo =
    resourceType === "video" &&
    typeof file.size === "number" &&
    file.size > 100 * 1024 * 1024;

  const data = isLargeVideo
    ? await uploadVideoChunked(file)
    : await uploadSimple(file, resourceType);

  return {
    // group-compatible fields
    url: data.secure_url,
    publicId: data.public_id,

    // your added functionality support
    resourceType: data.resource_type || resourceType,
    mimeType: file.type || "application/octet-stream",
    originalFilename: file.name || data.original_filename || "uploaded-file",
    bytes: typeof file.size === "number" ? file.size : data.bytes,
  };
}