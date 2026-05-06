import { InferenceClient } from "@huggingface/inference";

const HF_API_KEY = import.meta.env.VITE_HF_API_KEY;
const HF_MODEL = "black-forest-labs/FLUX.1-Kontext-dev";
const hfClient = HF_API_KEY ? new InferenceClient(HF_API_KEY) : null;
const HF_PROVIDER = "replicate";

// Style prompts for different themes
export const AI_STYLES = {
  professional_photography: {
    label: "Professional Photography",
    prompt:
      "professional photography, sharp focus, studio lighting, high resolution, commercial quality, crisp details",
  },
  cyberpunk: {
    label: "Cyberpunk",
    prompt:
      "cyberpunk neon, futuristic, neon lights, dark moody, sci-fi aesthetic, glowing effects",
  },
  golden_hour: {
    label: "Golden Hour",
    prompt:
      "golden hour lighting, warm sunset tones, soft glowing light, dreamy atmosphere, magical hour photography",
  },
  hdr: {
    label: "HDR",
    prompt:
      "HDR photography, high dynamic range, vibrant colors, enhanced contrast, dramatic tones, vivid details",
  },
  wildwest: {
    label: "Wild West",
    prompt:
      "western desert cinematic wild west outlaw, dusty, dramatic lighting, film grain",
  },
  ghibli: {
    label: "Ghibli",
    prompt:
      "Studio Ghibli style, watercolor, soft colors, dreamy, hand-drawn aesthetic, whimsical",
  },
  vintage: {
    label: "Vintage",
    prompt:
      "vintage film photography, faded colors, retro aesthetic, 1970s style, nostalgic",
  },
  brightairy: {
    label: "Bright & Airy",
    prompt:
      "bright airy aesthetic, soft natural lighting, pastel colors, dreamy, light and ethereal",
  },
  oil_painting: {
    label: "Oil Painting",
    prompt:
      "oil painting, impressionist style, thick brushstrokes, vibrant colors, classical art",
  },
  anime: {
    label: "Anime",
    prompt:
      "anime style, vibrant colors, detailed line art, expressive character design, Japanese animation",
  },
};

/**
 * Generate a styled version of an image using Hugging Face image-to-image
 * @param {Blob|File} imageFile - Image file to transform
 * @param {string} styleKey - Key from AI_STYLES object
 * @returns {Promise<Blob>} - Transformed image as blob
 */
export async function generateStyledImage(imageFile, styleKey) {
  if (!HF_API_KEY) {
    throw new Error(
      "Hugging Face API key not configured. Set VITE_HF_API_KEY in .env"
    );
  }

  if (!hfClient) {
    throw new Error("Hugging Face client could not be initialized.");
  }

  if (!imageFile) {
    throw new Error("Please select an image file first.");
  }

  const style = AI_STYLES[styleKey];
  if (!style) {
    throw new Error(`Unknown style: ${styleKey}`);
  }

  const imageInput =
    typeof imageFile === "string" ? await fetch(imageFile).then((res) => res.blob()) : imageFile;

  try {
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

    if (result instanceof Blob) {
      return result;
    }

    return new Blob([result]);
  } catch (err) {
    console.error("Style generation failed:", err);
    throw new Error(
      `Failed to generate styled image: ${err.message || "Unknown error"}`
    );
  }
}

/**
 * Check if Hugging Face API is configured
 */
export function isHFConfigured() {
  return !!HF_API_KEY;
}
