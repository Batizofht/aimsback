import sharp from "sharp";

/**
 * Image validation - checks for human faces and similar images
 * Uses sharp (already installed) - no new dependencies
 */

interface ImageHash {
  ahash: string;
  dhash: string;
}

/**
 * Check multiple images for faces and similarity
 */
export async function validateImages(
  imagePaths: string[]
): Promise<{ valid: boolean; reason?: string }> {
  try {
    // 1. Check each image has a face
    for (let i = 0; i < imagePaths.length; i++) {
      const hasFace = await detectFace(imagePaths[i]);
      if (!hasFace) {
        return {
          valid: false,
          reason: `Photo ${i + 1} does not show a clear face. Please upload photos of yourself.`
        };
      }
    }

    // 2. Check for similar images (if 2+ images)
    if (imagePaths.length > 1) {
      const hashes: ImageHash[] = [];
      
      for (const path of imagePaths) {
        const hash = await generateImageHash(path);
        hashes.push(hash);
      }

      // Compare all pairs
      for (let i = 0; i < hashes.length; i++) {
        for (let j = i + 1; j < hashes.length; j++) {
          const similarity = calculateSimilarity(hashes[i], hashes[j]);
          
          if (similarity > 0.85) {
            return {
              valid: false,
              reason: `Photos ${i + 1} and ${j + 1} look too similar. Please upload different photos.`
            };
          }
        }
      }
    }

    return { valid: true };
  } catch (error) {
    console.log("Validation error:", error);
    return { valid: true }; // Fail open on error
  }
}

/**
 * Check single image for face
 */
export async function validateSingleImage(
  imagePath: string
): Promise<{ valid: boolean; reason?: string }> {
  const result = await validateImages([imagePath]);
  return result;
}

/**
 * Detect if image contains a human face
 * Uses same proven logic as imageModeration.ts
 */
async function detectFace(imagePath: string): Promise<boolean> {
  try {
    const { data, info } = await sharp(imagePath)
      .resize(300, 300, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Face region: top 40% of image (where faces typically are)
    const faceRegionEnd = Math.floor(info.height * 0.4);
    const faceRegionPixels = info.width * faceRegionEnd;

    let facePixels = 0;
    let totalSkinPixels = 0;
    
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * 3;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        if (isSkinTone(r, g, b)) {
          totalSkinPixels++;
          if (y < faceRegionEnd) {
            facePixels++;
          }
        }
      }
    }

    const totalPixels = info.width * info.height;
    const faceRatio = facePixels / faceRegionPixels;
    const totalSkinRatio = totalSkinPixels / totalPixels;

    // Face detection thresholds
    // hasFace: detectable skin in face region (>2% allows full-body shots with visible face)
    // Sky/wall/object photos have 0% skin, real face photos have at least 2-10%
    const hasFace = faceRatio > 0.02 && facePixels > 80; // At least 2% and 80 skin pixels
    const hasReasonableSkin = totalSkinRatio > 0.03 && totalSkinRatio < 0.80; // Wider range for various poses
    
    // RELAXED: Only check for obvious non-photos (uniform colors = sky/wall/blank)
    // Text overlays and split images allowed - human review will catch issues
    const isUniform = await isUniformColor(imagePath);
    
    // DEBUG LOGGING
    console.log("Validation check:", {
      faceRatio: faceRatio.toFixed(4),
      facePixels,
      totalSkinRatio: totalSkinRatio.toFixed(4),
      hasFace,
      hasReasonableSkin,
      isUniform,
      passed: hasFace && hasReasonableSkin && !isUniform
    });
    
    // Only block: no face detected OR uniform background (sky/wall/object)
    return hasFace && hasReasonableSkin && !isUniform;
  } catch (error) {
    console.log("Face detection error:", error);
    return true; // Fail open
  }
}

/**
 * Check if image is mostly uniform color (sky, wall, etc.)
 */
async function isUniformColor(imagePath: string): Promise<boolean> {
  try {
    const { data, info } = await sharp(imagePath)
      .resize(50, 50)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bins = new Map<string, number>();
    
    for (let i = 0; i < data.length; i += 3) {
      const r = Math.floor(data[i] / 40) * 40;
      const g = Math.floor(data[i + 1] / 40) * 40;
      const b = Math.floor(data[i + 2] / 40) * 40;
      const key = `${r},${g},${b}`;
      bins.set(key, (bins.get(key) || 0) + 1);
    }

    const maxCount = Math.max(...bins.values());
    const dominance = maxCount / (info.width * info.height);
    
    // Reject if >90% is one color (very strict - only pure sky/wall/blank)
    // Portraits with dark backgrounds should pass
    return dominance > 0.90;
  } catch {
    return false;
  }
}

/**
 * Detect text overlay in images (screenshots, memes with text)
 * Looks for sharp horizontal/vertical edges typical of text
 */
async function detectTextOverlay(imagePath: string): Promise<boolean> {
  try {
    const { data, info } = await sharp(imagePath)
      .resize(100, 100)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    
    let sharpHorizontalEdges = 0;
    let sharpVerticalEdges = 0;
    
    // Check for sharp edges (typical of text)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const pixel = data[idx];
        
        // Horizontal edge check (sharp change left-right)
        const left = data[idx - 1];
        const right = data[idx + 1];
        const hDiff = Math.abs(left - right);
        
        // Vertical edge check (sharp change up-down)
        const up = data[(y - 1) * width + x];
        const down = data[(y + 1) * width + x];
        const vDiff = Math.abs(up - down);
        
        // Text typically has very sharp edges (>60 difference in grayscale)
        if (hDiff > 60) sharpHorizontalEdges++;
        if (vDiff > 60) sharpVerticalEdges++;
      }
    }
    
    const totalPixels = width * height;
    const hEdgeRatio = sharpHorizontalEdges / totalPixels;
    const vEdgeRatio = sharpVerticalEdges / totalPixels;
    
    // Text typically has lots of sharp horizontal edges (thin horizontal text lines)
    // and moderate vertical edges (vertical strokes in letters)
    // RELAXED: Only catch obvious screenshots/memes, not photo details
    const hasTextPattern = hEdgeRatio > 0.1 && vEdgeRatio > 0.05;
    
    return hasTextPattern;
  } catch {
    return false;
  }
}

/**
 * Detect split images (half photo, half solid color/background)
 * Looks for clear dividing lines where one side is uniform
 */
async function detectSplitImage(imagePath: string): Promise<boolean> {
  try {
    const { data, info } = await sharp(imagePath)
      .resize(100, 100)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    
    // Check for vertical split (left half vs right half)
    const midX = Math.floor(width / 2);
    
    let leftVariance = 0;
    let rightVariance = 0;
    let leftPixels = 0;
    let rightPixels = 0;
    
    // Calculate color variance for left and right halves
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Simple brightness as proxy
        const brightness = (r + g + b) / 3;
        
        if (x < midX) {
          leftVariance += brightness;
          leftPixels++;
        } else {
          rightVariance += brightness;
          rightPixels++;
        }
      }
    }
    
    const leftAvg = leftVariance / leftPixels;
    const rightAvg = rightVariance / rightPixels;
    
    // Calculate variance (how much colors vary) in each half
    let leftDiffSum = 0;
    let rightDiffSum = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        
        if (x < midX) {
          leftDiffSum += Math.abs(brightness - leftAvg);
        } else {
          rightDiffSum += Math.abs(brightness - rightAvg);
        }
      }
    }
    
    const leftVarianceFinal = leftDiffSum / leftPixels;
    const rightVarianceFinal = rightDiffSum / rightPixels;
    
    // Split image pattern: one side has low variance (uniform/solid), other has high variance (photo)
    const oneSideUniform = (leftVarianceFinal < 15 && rightVarianceFinal > 30) || 
                           (rightVarianceFinal < 15 && leftVarianceFinal > 30);
    
    // Also check horizontal split (top vs bottom)
    const midY = Math.floor(height / 2);
    let topVariance = 0;
    let bottomVariance = 0;
    let topPixels = 0;
    let bottomPixels = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        
        if (y < midY) {
          topVariance += brightness;
          topPixels++;
        } else {
          bottomVariance += brightness;
          bottomPixels++;
        }
      }
    }
    
    const topAvg = topVariance / topPixels;
    const bottomAvg = bottomVariance / bottomPixels;
    
    let topDiffSum = 0;
    let bottomDiffSum = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        
        if (y < midY) {
          topDiffSum += Math.abs(brightness - topAvg);
        } else {
          bottomDiffSum += Math.abs(brightness - bottomAvg);
        }
      }
    }
    
    const topVarianceFinal = topDiffSum / topPixels;
    const bottomVarianceFinal = bottomDiffSum / bottomPixels;
    
    const horizontalSplit = (topVarianceFinal < 15 && bottomVarianceFinal > 30) || 
                          (bottomVarianceFinal < 15 && topVarianceFinal > 30);
    
    return oneSideUniform || horizontalSplit;
  } catch {
    return false;
  }
}

/**
 * Skin tone detection - same as imageModeration.ts
 */
function isSkinTone(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // More refined skin detection (matching imageModeration.ts)
  const basicSkin =
    r > 50 && g > 30 && b > 15 &&
    r > g && r > b &&
    Math.abs(r - g) > 8;

  const notTooDark = max > 60;
  const notTooBright = max < 245;
  const saturationOk = delta < 110 && delta > 5;

  return basicSkin && notTooDark && notTooBright && saturationOk;
}

/**
 * Generate perceptual hash for similarity comparison
 */
async function generateImageHash(imagePath: string): Promise<ImageHash> {
  try {
    const { data } = await sharp(imagePath)
      .resize(16, 16, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Average hash
    const avg = (data as Buffer).reduce((a: number, b: number) => a + b, 0) / data.length;
    const ahash = Array.from(data).map((p: number) => p > avg ? '1' : '0').join('');

    // Difference hash (horizontal)
    const dataArray = Array.from(data as Buffer);
    let dhash = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 15; x++) {
        const left = dataArray[y * 16 + x];
        const right = dataArray[y * 16 + x + 1];
        dhash += left > right ? '1' : '0';
      }
    }

    return { ahash, dhash };
  } catch {
    // Random hash on error (won't match anything)
    return {
      ahash: Math.random().toString(2).slice(2, 258),
      dhash: Math.random().toString(2).slice(2, 226)
    };
  }
}

/**
 * Calculate similarity between two hashes (0-1)
 */
function calculateSimilarity(h1: ImageHash, h2: ImageHash): number {
  let aMatch = 0;
  for (let i = 0; i < h1.ahash.length && i < h2.ahash.length; i++) {
    if (h1.ahash[i] === h2.ahash[i]) aMatch++;
  }
  
  let dMatch = 0;
  for (let i = 0; i < h1.dhash.length && i < h2.dhash.length; i++) {
    if (h1.dhash[i] === h2.dhash[i]) dMatch++;
  }

  return (aMatch / 256) * 0.6 + (dMatch / 240) * 0.4;
}
