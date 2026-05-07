// AI auto-composition for the slideshow modal.
//
// We expose the modal's manual controls (order / seconds-per-image /
// per-pair transitions / aspect ratio / title) as a single OpenAI
// function-call tool and let GPT-4o-mini "use" those tools after looking
// at the photos.

import OpenAI from "openai";
import { startTrace, trackEvent, trackException } from "./telemetry";

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

const client = API_KEY
  ? new OpenAI({ apiKey: API_KEY, dangerouslyAllowBrowser: true })
  : null;

const TRANSITIONS = [
  "none",
  "fade",
  "slide-left",
  "slide-up",
  "zoom-in",
  "zoom-out",
];

const tools = [
  {
    type: "function",
    function: {
      name: "compose_video",
      description:
        "Set every parameter of the slideshow video that the user is about to render.",
      parameters: {
        type: "object",
        required: [
          "order",
          "secondsPerImage",
          "transitions",
          "aspectRatio",
          "title",
          "reasoning",
        ],
        properties: {
          order: {
            type: "array",
            items: { type: "integer" },
            description:
              "The order to play the photos, expressed as their original 0-based indices. MUST be a permutation of [0, 1, ..., N-1] where N is the total number of photos provided.",
          },
          secondsPerImage: {
            type: "integer",
            enum: [2, 3, 5],
            description:
              "How long each photo is shown. Total length = N * secondsPerImage MUST be <= 60.",
          },
          transitions: {
            type: "array",
            items: { type: "string", enum: TRANSITIONS },
            description:
              "Per-pair transitions, length = N-1. transitions[i] is the transition between order[i] and order[i+1]. Vary the picks (don't always pick fade); use 'zoom-in' for portraits, 'slide-left'/'slide-up' for sequences, 'fade' for calm landscapes, 'none' for punchy cuts.",
          },
          aspectRatio: {
            type: "string",
            enum: ["16:9", "1:1", "9:16"],
            description:
              "16:9 if most photos are landscape, 9:16 if portrait, 1:1 if mixed/square.",
          },
          title: {
            type: "string",
            description:
              "Short evocative title (4-8 words). Examples: 'Sunset hike at Mt. Hamilton', 'Birthday weekend recap'. Avoid generic titles.",
          },
          reasoning: {
            type: "string",
            description: "One sentence on why these choices fit the photos.",
          },
        },
      },
    },
  },
];

/**
 * Ask the AI to compose a slideshow from the given photos.
 *
 * @param {Array<{ url: string, title?: string }>} photos
 * @returns {Promise<{ order: number[], secondsPerImage: number, transitions: string[], aspectRatio: string, title: string, reasoning: string }>}
 */
export async function aiCompose(photos) {
  if (!client) {
    throw new Error(
      "OpenAI not configured. Set VITE_OPENAI_API_KEY in .env and restart dev server.",
    );
  }
  if (!Array.isArray(photos) || photos.length < 2) {
    throw new Error("Need at least 2 photos.");
  }

  // OpenAI vision content blocks: pass URLs only, no extra keys.
  const imageBlocks = photos.map((p) => ({
    type: "image_url",
    image_url: { url: p.url },
  }));

  const messages = [
    {
      role: "system",
      content: `You are a creative video editor. You will be shown the photos from one user's album. Your job: design a short slideshow video.

Rules:
- Always reply by calling the compose_video tool exactly once.
- Reorder photos for a coherent narrative.
- Total length (N * secondsPerImage) MUST be <= 60 seconds.
- Provide ONE transition per pair (transitions array length = N-1). Vary them — don't always pick fade.
- Choose aspect ratio matching the majority orientation.
- Title should feel personal, not generic.`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Compose a slideshow from these ${photos.length} photos. They are presented below in their original order, with photo at index 0 being the first image, photo at index 1 the second, and so on.`,
        },
        ...imageBlocks,
      ],
    },
  ];

  const model = "gpt-4o-mini";
  const composeTrace = startTrace("ai_compose_video", {
    attributes: { model },
    metrics: { photo_count: photos.length },
  });
  trackEvent("ai_compose_video_start", { photo_count: photos.length });

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: { type: "function", function: { name: "compose_video" } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "compose_video") {
      throw new Error("AI didn't call compose_video.");
    }

    let parsed;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (err) {
      throw new Error("AI response was not valid JSON: " + err.message);
    }

    const N = photos.length;

    // Validate order: must be a permutation of [0..N-1].
    const order = Array.isArray(parsed.order) ? parsed.order : [];
    const seen = new Set();
    const validOrder = [];
    for (const i of order) {
      if (Number.isInteger(i) && i >= 0 && i < N && !seen.has(i)) {
        seen.add(i);
        validOrder.push(i);
      }
    }
    for (let i = 0; i < N; i++) if (!seen.has(i)) validOrder.push(i);

    const secondsPerImage = [2, 3, 5].includes(parsed.secondsPerImage)
      ? parsed.secondsPerImage
      : 3;
    const cappedSeconds =
      N * secondsPerImage > 60 ? Math.max(2, Math.floor(60 / N)) : secondsPerImage;

    // Transitions: length should be N-1. Pad / truncate as needed.
    const rawTrans = Array.isArray(parsed.transitions) ? parsed.transitions : [];
    const transitions = [];
    for (let i = 0; i < N - 1; i++) {
      const t = rawTrans[i];
      transitions.push(TRANSITIONS.includes(t) ? t : "fade");
    }

    const aspectRatio = ["16:9", "1:1", "9:16"].includes(parsed.aspectRatio)
      ? parsed.aspectRatio
      : "16:9";

    composeTrace?.putAttribute("status", "success");
    composeTrace?.putAttribute("aspect_ratio", aspectRatio);
    composeTrace?.putMetric("seconds_per_image", cappedSeconds);
    composeTrace?.putMetric("transition_count", transitions.length);
    trackEvent("ai_compose_video_success", {
      photo_count: photos.length,
      seconds_per_image: cappedSeconds,
      aspect_ratio: aspectRatio,
      transition_count: transitions.length,
    });

    return {
      order: validOrder,
      secondsPerImage: cappedSeconds,
      transitions,
      aspectRatio,
      title: typeof parsed.title === "string" ? parsed.title.trim() : "",
      reasoning:
        typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "",
    };
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
  return !!API_KEY && !!client;
}

export { TRANSITIONS };
