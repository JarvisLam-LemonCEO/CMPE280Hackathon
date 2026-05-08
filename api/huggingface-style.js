import { InferenceClient } from "@huggingface/inference";
import { AI_STYLES } from "../src/lib/aiStyles.js";
import { readJson, sendError } from "./_shared.js";

const HF_MODEL = "black-forest-labs/FLUX.1-Kontext-dev";
const HF_PROVIDER = "replicate";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendError(res, 405, "Method not allowed.");
    return;
  }

  if (!process.env.HF_API_KEY) {
    sendError(res, 500, "Hugging Face is not configured.");
    return;
  }

  try {
    const body = await readJson(req);
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
    const styleKey = typeof body.styleKey === "string" ? body.styleKey : "";
    const style = AI_STYLES[styleKey];

    if (!imageUrl) {
      sendError(res, 400, "Missing image URL.");
      return;
    }

    if (!style) {
      sendError(res, 400, `Unknown style: ${styleKey}`);
      return;
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Could not fetch source image: ${imageResponse.status}`);
    }

    const imageInput = await imageResponse.blob();
    const hfClient = new InferenceClient(process.env.HF_API_KEY);
    const result = await hfClient.imageToImage({
      model: HF_MODEL,
      provider: HF_PROVIDER,
      inputs: imageInput,
      parameters: {
        prompt: `Transform this photo into a ${style.label} style. ${style.prompt}`,
        guidance_scale: 7.5,
        num_inference_steps: 25,
      },
    });

    const outputBlob = result instanceof Blob ? result : new Blob([result]);
    const buffer = Buffer.from(await outputBlob.arrayBuffer());

    res.statusCode = 200;
    res.setHeader("Content-Type", outputBlob.type || "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.end(buffer);
  } catch (err) {
    console.error("huggingface style failed", err);
    sendError(res, 500, err?.message || "AI image generation failed.");
  }
}
