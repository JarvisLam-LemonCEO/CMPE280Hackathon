import { startTrace, trackEvent, trackException } from "./telemetry";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export async function uploadToCloudinary(file) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env");
  }

  const uploadTrace = startTrace("cloudinary_image_upload", {
    attributes: { file_type: file?.type || "unknown" },
    metrics: { file_size_bytes: file?.size || 0 },
  });
  trackEvent("cloudinary_image_upload_start", {
    file_type: file?.type || "unknown",
    file_size_bytes: file?.size || 0,
  });

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudinary upload failed: ${text}`);
    }
    const data = await res.json();
    uploadTrace?.putAttribute("status", "success");
    uploadTrace?.putMetric("response_bytes", data.bytes || 0);
    trackEvent("cloudinary_image_upload_success", {
      file_type: file?.type || "unknown",
      file_size_bytes: file?.size || 0,
      response_bytes: data.bytes || 0,
    });
    return { url: data.secure_url, publicId: data.public_id };
  } catch (err) {
    uploadTrace?.putAttribute("status", "error");
    uploadTrace?.putAttribute("error_code", err?.code || err?.name || "error");
    trackEvent("cloudinary_image_upload_failed", {
      file_type: file?.type || "unknown",
      error_code: err?.code || err?.name || "error",
    });
    trackException(err, { area: "cloudinary_image_upload" });
    throw err;
  } finally {
    uploadTrace?.stop();
  }
}
