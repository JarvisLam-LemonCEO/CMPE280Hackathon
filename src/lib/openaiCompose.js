// AI auto-composition for the slideshow modal.
// The OpenAI API key is used only in /api/openai-compose so it is not exposed
// in the browser bundle.

import { startTrace, trackEvent, trackException } from "./telemetry";

const TRANSITIONS = [
  "none",
  "fade",
  "slide-left",
  "slide-up",
  "zoom-in",
  "zoom-out",
];

const absoluteUrl = (url) => {
  if (!url || typeof window === "undefined") return url;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
};

async function readErrorMessage(response) {
  try {
    const body = await response.json();
    return body?.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

/**
 * Ask the AI to compose a slideshow from the given photos.
 *
 * @param {Array<{ url: string, title?: string }>} photos
 * @returns {Promise<{ order: number[], secondsPerImage: number, transitions: string[], aspectRatio: string, title: string, reasoning: string }>}
 */
export async function aiCompose(photos) {
  if (!Array.isArray(photos) || photos.length < 2) {
    throw new Error("Need at least 2 photos.");
  }

  const model = "gpt-4o-mini";
  const composeTrace = startTrace("ai_compose_video", {
    attributes: { model },
    metrics: { photo_count: photos.length },
  });
  trackEvent("ai_compose_video_start", { photo_count: photos.length });

  try {
    const response = await fetch("/api/openai-compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photos: photos.map((photo) => ({
          url: absoluteUrl(photo.url),
          title: photo.title || "",
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const result = await response.json();

    composeTrace?.putAttribute("status", "success");
    composeTrace?.putAttribute("aspect_ratio", result.aspectRatio || "16:9");
    composeTrace?.putMetric("seconds_per_image", result.secondsPerImage || 0);
    composeTrace?.putMetric(
      "transition_count",
      Array.isArray(result.transitions) ? result.transitions.length : 0,
    );
    trackEvent("ai_compose_video_success", {
      photo_count: photos.length,
      seconds_per_image: result.secondsPerImage,
      aspect_ratio: result.aspectRatio,
      transition_count: Array.isArray(result.transitions)
        ? result.transitions.length
        : 0,
    });

    return result;
  } catch (err) {
    composeTrace?.putAttribute("status", "error");
    composeTrace?.putAttribute("error_code", err?.code || err?.name || "error");
    trackEvent("ai_compose_video_failed", {
      photo_count: photos.length,
      error_code: err?.code || err?.name || "error",
    });
    trackException(err, { area: "ai_compose_video" });
    throw err;
  } finally {
    composeTrace?.stop();
  }
}

export function isOpenAIConfigured() {
  return true;
}

export { TRANSITIONS };
