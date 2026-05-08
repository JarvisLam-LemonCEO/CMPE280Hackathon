import OpenAI from "openai";
import { readJson, sendError, sendJson } from "./_shared.js";

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
              "Per-pair transitions, length = N-1. transitions[i] is the transition between order[i] and order[i+1]. Vary the picks.",
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
              "Short evocative title (4-8 words). Avoid generic titles.",
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

function normalizeComposeResult(parsed, photoCount) {
  const order = Array.isArray(parsed.order) ? parsed.order : [];
  const seen = new Set();
  const validOrder = [];

  for (const index of order) {
    if (
      Number.isInteger(index) &&
      index >= 0 &&
      index < photoCount &&
      !seen.has(index)
    ) {
      seen.add(index);
      validOrder.push(index);
    }
  }

  for (let index = 0; index < photoCount; index += 1) {
    if (!seen.has(index)) validOrder.push(index);
  }

  const secondsPerImage = [2, 3, 5].includes(parsed.secondsPerImage)
    ? parsed.secondsPerImage
    : 3;
  const cappedSeconds =
    photoCount * secondsPerImage > 60
      ? Math.max(2, Math.floor(60 / photoCount))
      : secondsPerImage;

  const rawTransitions = Array.isArray(parsed.transitions)
    ? parsed.transitions
    : [];
  const transitions = [];

  for (let index = 0; index < photoCount - 1; index += 1) {
    const transition = rawTransitions[index];
    transitions.push(TRANSITIONS.includes(transition) ? transition : "fade");
  }

  const aspectRatio = ["16:9", "1:1", "9:16"].includes(parsed.aspectRatio)
    ? parsed.aspectRatio
    : "16:9";

  return {
    order: validOrder,
    secondsPerImage: cappedSeconds,
    transitions,
    aspectRatio,
    title: typeof parsed.title === "string" ? parsed.title.trim() : "",
    reasoning:
      typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed.");
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    sendError(res, 500, "OpenAI is not configured.");
    return;
  }

  try {
    const body = await readJson(req);
    const photos = Array.isArray(body.photos)
      ? body.photos.filter((photo) => typeof photo?.url === "string" && photo.url)
      : [];

    if (photos.length < 2) {
      sendError(res, 400, "Need at least 2 photos.");
      return;
    }

    const imageBlocks = photos.map((photo) => ({
      type: "image_url",
      image_url: { url: photo.url },
    }));

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a creative video editor. You will be shown the photos from one user's album. Your job: design a short slideshow video.

Rules:
- Always reply by calling the compose_video tool exactly once.
- Reorder photos for a coherent narrative.
- Total length (N * secondsPerImage) MUST be <= 60 seconds.
- Provide ONE transition per pair (transitions array length = N-1). Vary them.
- Choose aspect ratio matching the majority orientation.
- Title should feel personal, not generic.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Compose a slideshow from these ${photos.length} photos. They are presented below in their original order.`,
            },
            ...imageBlocks,
          ],
        },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "compose_video" } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "compose_video") {
      throw new Error("AI did not call compose_video.");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    sendJson(res, 200, normalizeComposeResult(parsed, photos.length));
  } catch (err) {
    console.error("openai compose failed", err);
    sendError(res, 500, err?.message || "AI compose failed.");
  }
}
