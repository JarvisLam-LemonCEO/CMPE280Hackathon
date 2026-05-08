import { AI_STYLES } from "./aiStyles";
import { startTrace, trackEvent, trackException } from "./telemetry";

const HF_MODEL = "black-forest-labs/FLUX.1-Kontext-dev";
const HF_PROVIDER = "replicate";

const absoluteUrl = (url) => {
  if (!url || typeof window === "undefined") return url;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

async function readErrorMessage(response) {
  try {
    const body = await response.json();
    return body?.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

async function sourceToImageUrl(imageFile) {
  if (typeof imageFile === "string") return absoluteUrl(imageFile);
  if (imageFile instanceof Blob) return blobToDataUrl(imageFile);
  return "";
}

/**
 * Generate a styled version of an image using the server-side Hugging Face API.
 *
 * @param {Blob|File|string} imageFile - Image file or URL to transform
 * @param {string} styleKey - Key from AI_STYLES object
 * @returns {Promise<Blob>} - Transformed image as blob
 */
export async function generateStyledImage(imageFile, styleKey) {
  if (!imageFile) {
    throw new Error("Please select an image file first.");
  }

  const style = AI_STYLES[styleKey];
  if (!style) {
    throw new Error(`Unknown style: ${styleKey}`);
  }

  const sourceType = typeof imageFile === "string" ? "url" : "file";
  const generationTrace = startTrace("ai_photo_generate", {
    attributes: {
      provider: HF_PROVIDER,
      model: HF_MODEL,
      source_type: sourceType,
      style_key: styleKey,
    },
    metrics: {
      source_bytes: imageFile?.size || 0,
    },
  });
  trackEvent("ai_photo_generate_start", {
    provider: HF_PROVIDER,
    source_type: sourceType,
    style_key: styleKey,
  });

  try {
    const imageUrl = await sourceToImageUrl(imageFile);
    const response = await fetch("/api/huggingface-style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, styleKey }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const outputBlob = await response.blob();
    generationTrace?.putAttribute("status", "success");
    generationTrace?.putMetric("output_bytes", outputBlob.size || 0);
    trackEvent("ai_photo_generate_success", {
      provider: HF_PROVIDER,
      style_key: styleKey,
      output_bytes: outputBlob.size || 0,
    });
    return outputBlob;
  } catch (err) {
    generationTrace?.putAttribute("status", "error");
    generationTrace?.putAttribute("error_code", err?.code || err?.name || "error");
    trackEvent("ai_photo_generate_failed", {
      provider: HF_PROVIDER,
      style_key: styleKey,
      error_code: err?.code || err?.name || "error",
    });
    trackException(err, { area: "ai_photo_generate", provider: HF_PROVIDER });
    console.error("Style generation failed:", err);
    throw new Error(
      `Failed to generate styled image: ${err.message || "Unknown error"}`,
    );
  } finally {
    generationTrace?.stop();
  }
}

/**
 * The secret key lives on the server. The button can be shown in the browser;
 * the API route will return a configuration error if the Vercel env is missing.
 */
export function isHFConfigured() {
  return true;
}

export { AI_STYLES };
