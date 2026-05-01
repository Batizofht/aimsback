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

  if (!model) return true;

  try {
    const img = await loadImage(imagePath);
    const canvas = createCanvas(224, 224);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0, 224, 224);

    const tensor = tf.browser.fromPixels(canvas as any);
    const predictions = await model.classify(tensor);
    tensor.dispose();

    const porn = predictions.find(p => p.className === "Porn")?.probability || 0;
    const sexy = predictions.find(p => p.className === "Sexy")?.probability || 0;
    const hentai = predictions.find(p => p.className === "Hentai")?.probability || 0;
    const neutral = predictions.find(p => p.className === "Neutral")?.probability || 0;

    console.log("NSFW predictions:", { porn, sexy, hentai });

    let blocked = false;
    const blockReasons: string[] = [];
    const block = (reason: string) => {
      blocked = true;
      blockReasons.push(reason);
    };

    // 🚫 Check for combination of factors that indicate nudity
    const skinAnalysis = await analyzeSkinExposure(imagePath);
    const hasExplicitPatterns = await checkForExplicitPatterns(imagePath);

    console.log("Skin analysis:", skinAnalysis);
    console.log("Explicit patterns:", hasExplicitPatterns);

    // 🚫 ABSOLUTE BLOCK - Explicit content (genitals, sex acts)
    // These thresholds catch actual porn while letting normal photos through
    if (porn > 0.75) {
      block("Very high porn confidence");
    } else if (porn > 0.52 && (hasExplicitPatterns || skinAnalysis.bodySkinRatio > 0.25)) {
      block("Porn confidence + skin/patterns");
    }

    // 🚫 Hentai/cartoon porn
    if (hentai > 0.6) {
      block("Hentai detected");
    }

    let shouldAllow = false;
    let allowReason: string | null = null;

    // If high porn score AND lots of skin, definitely block
    if (porn > 0.6 && skinAnalysis.bodySkinRatio > 0.5) {
      block("Porn + excessive skin");
    }

    // ULTRA RELAXED: Only block extreme cases - human review handles the rest
    // Tier 1: Only block 95%+ sexy (almost certainly lingerie/nude)
    // Allow revealing/sexy photos - they go to human review
    if (sexy > 0.95 && skinAnalysis.totalSkinRatio > 0.15 && !rules?.allowShirtless) {
      block("Extreme sexy score - likely inappropriate");
    } else if (sexy > 0.85 && !skinAnalysis.hasFace && skinAnalysis.totalSkinRatio > 0.40 && !rules?.allowShirtless) {
      block("High sexy + skin (no face detected)");
    }

    if (hasExplicitPatterns && (skinAnalysis.bodySkinRatio > 0.35 || skinAnalysis.totalSkinRatio > 0.55)) {
      block("Explicit patterns + skin exposure");
    }

    // Strong signal of normal image (do NOT early-return; just mark as likely safe)
    if (neutral > 0.75 && porn < 0.52 && hentai < 0.3 && sexy < 0.3) {
      shouldAllow = true;
      allowReason = "Neutral image";
    }

    // Profile picture protection (do NOT early-return; just mark as likely safe)
    if (skinAnalysis.hasFace && porn < 0.4 && hentai < 0.4) {
      shouldAllow = true;
      allowReason = "Face detected with low porn/hentai";
    }

    // If most skin is face, it's safe (do NOT early-return; just mark as likely safe)
    if (skinAnalysis.hasFace && skinAnalysis.totalSkinRatio < 0.5) {
      shouldAllow = true;
      allowReason = "Skin mostly in face region";
    }

    // 🚫 Pure skin-based blocking for extreme cases
    if (skinAnalysis.bodySkinRatio > 0.75) {
      block("Excessive skin exposure");
    }

    if (blocked) {
      console.log("Blocked:", blockReasons);
      return false;
    }

    if (shouldAllow && allowReason) {
      console.log("Allowed:", allowReason);
    }

    return true;
  } catch (error) {
    console.log("Image moderation failed, allowing image:", error);
    return true;
  }
}

async function analyzeSkinExposure(imagePath: string): Promise<{
  totalSkinRatio: number;
  bodySkinRatio: number;
  hasFace: boolean;
  skinIntensity: number;
}> {
  try {
    const { data, info } = await sharp(imagePath)
      .resize(300, 300, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Better face region detection - top 25% is more accurate for face
const faceRegionEnd = Math.floor(info.height * 0.4);

    let totalSkinPixels = 0;
    let bodySkinPixels = 0;
    let facePixels = 0;
    let totalIntensity = 0;

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * 3;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const isSkin = isSkinTone(r, g, b);
        const skinIntensity = getSkinIntensity(r, g, b);
        totalIntensity += skinIntensity;

        if (isSkin) {
          totalSkinPixels++;

          if (y < faceRegionEnd) {
            facePixels++;
          } else {
            bodySkinPixels++;
          }
        }
      }
    }

    const totalPixels = info.width * info.height;
    const faceRegionPixels = info.width * faceRegionEnd;
    const bodyRegionPixels = totalPixels - faceRegionPixels;

    // Calculate average skin intensity (0-1)
    const avgSkinIntensity = totalIntensity / totalPixels;

    return {
      totalSkinRatio: totalSkinPixels / totalPixels,
      bodySkinRatio: bodyRegionPixels > 0 ? bodySkinPixels / bodyRegionPixels : 0,
      hasFace: (facePixels / faceRegionPixels) > 0.12, // Slightly lower threshold
      skinIntensity: avgSkinIntensity
    };
  } catch (error) {
    console.log("Skin analysis failed:", error);
    return { totalSkinRatio: 0, bodySkinRatio: 0, hasFace: false, skinIntensity: 0 };
  }
}

function isSkinTone(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // More refined skin detection
  const basicSkin =
    r > 50 && g > 30 && b > 15 &&
    r > g && r > b &&
    Math.abs(r - g) > 8;

  // Exclude extremely dark/bright
  const notTooDark = max > 60;
  const notTooBright = max < 245;

  // Skin typically has moderate saturation
  const saturationOk = delta < 110 && delta > 5;

  return basicSkin && notTooDark && notTooBright && saturationOk;
}

function getSkinIntensity(r: number, g: number, b: number): number {
  // Returns how "skin-like" a pixel is (0-1)
  if (!isSkinTone(r, g, b)) return 0;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Higher score for pixels that match typical skin tones closely
  let score = 0.5;

  // Boost score for typical skin color ranges
  if (r > 150 && g > 80 && b > 50) score += 0.3;
  if (r > 200 && g > 120 && b > 80) score += 0.2;

  // Reduce for unusual hues
  if (delta < 10) score *= 0.5; // Too gray
  if (r > 250 && g > 200 && b > 150) score *= 0.7; // Very light/white

  return Math.min(score, 1);
}

// Optional: Add a secondary check for explicit content patterns
async function checkForExplicitPatterns(imagePath: string): Promise<boolean> {
  try {
    const { data, info } = await sharp(imagePath)
      .resize(100, 100)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Check for high contrast areas that might indicate genitals
    let highContrastRegions = 0;
    for (let i = 1; i < data.length - 1; i++) {
      const diff = Math.abs(data[i] - data[i - 1]);
      if (diff > 80) highContrastRegions++;
    }

    const contrastRatio = highContrastRegions / data.length;

    // Excessive high contrast + skin ratio might indicate explicit content
    return contrastRatio > 0.15;
  } catch {
    return false;
  }
}