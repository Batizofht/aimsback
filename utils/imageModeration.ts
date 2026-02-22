import * as nsfw from "nsfwjs";
import * as tf from "@tensorflow/tfjs";
import sharp from "sharp";
import { createCanvas, loadImage } from "canvas";

let model: nsfw.NSFWJS | null = null;

// Load model once
async function loadModel() {
  if (!model) {
    model = await nsfw.load();
    console.log("NSFW model loaded");
  }
}

export async function moderateImage(
  imagePath: string,
  rules?: { allowShirtless?: boolean }
): Promise<boolean> {
  await loadModel();

  if (!model) return true; // Allow if model not loaded

  try {
    // Load image using canvas (REQUIRED for pure tfjs)
    const img = await loadImage(imagePath);
    const canvas = createCanvas(224, 224);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0, 224, 224);

    const tensor = tf.browser.fromPixels(canvas as any);
    const predictions = await model.classify(tensor);
    tensor.dispose();

    const porn = predictions.find(p => p.className === "Porn")?.probability || 0;
    const sexy = predictions.find(p => p.className === "Sexy")?.probability || 0;

    // 🚫 RULE 1 — Any sexual intent (higher threshold for dating app context)
    if (porn > 0.2 || sexy > 0.97) {
      return false;
    }

    // 🚫 RULE 2 — Skin exposure (blocks bikinis & underwear)
    const skinRatio = await estimateSkinRatio(imagePath);

    if (skinRatio > 0.9 && !rules?.allowShirtless) {
      return false;
    }

    return true;
  } catch (error) {
    console.log("Image moderation failed, allowing image:", error);
    return true; // Allow image if moderation fails
  }
}

// Strict skin detector
async function estimateSkinRatio(imagePath: string): Promise<number> {
  try {
    const { data, info } = await sharp(imagePath)
      .resize(100, 100)
      .raw()
      .toBuffer({ resolveWithObject: true });

    let skinPixels = 0;

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const isSkin =
        r > 95 &&
        g > 40 &&
        b > 20 &&
        r > g &&
        r > b &&
        Math.abs(r - g) > 15;

      if (isSkin) skinPixels++;
    }

    return skinPixels / (info.width * info.height);
  } catch (error) {
    console.log("Skin ratio estimation failed:", error);
    return 0; // Return 0 if analysis fails
  }
}
