import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";

/**
 * On-the-fly image optimizer for /uploads/**.
 *
 * Turns a request like  /uploads/blog-covers/cover.jpg?w=800&q=82
 * into a resized, high-quality WebP — generated once with sharp and then
 * cached to disk, so subsequent requests are served straight from cache.
 *
 * This is what lets the fully-static Next.js front-end use <Image> (via a
 * custom loader) while the actual optimization happens here, on the backend.
 *
 * Rules:
 * - Only acts when a `w` (width) query param is present and the target is an
 *   image we can process. Everything else (PDFs, documents, plain requests)
 *   falls through to express.static untouched.
 * - NEVER upscales (`withoutEnlargement: true`) — original quality is preserved.
 * - Path-traversal safe: the resolved file must stay inside /uploads.
 */

const PROCESSABLE = /\.(jpe?g|png|webp|gif)$/i;

const uploadsPath = path.join(process.cwd(), "uploads");
const cachePath = path.join(uploadsPath, ".image-cache");

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export default function imageResize(req: Request, res: Response, next: NextFunction) {
  // Only GET/HEAD with an explicit width request are handled here.
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.query.w === undefined) return next();

  // req.path is relative to the /uploads mount (e.g. /blog-covers/cover.jpg)
  let relPath: string;
  try {
    relPath = decodeURIComponent(req.path);
  } catch {
    return next();
  }

  if (!PROCESSABLE.test(relPath)) return next();

  const sourceFile = path.join(uploadsPath, relPath);

  // Path-traversal guard: resolved path must remain inside /uploads.
  const normalizedSource = path.normalize(sourceFile);
  if (!normalizedSource.startsWith(uploadsPath)) return next();
  if (!fs.existsSync(normalizedSource)) return next();

  const width = clamp(parseInt(String(req.query.w), 10) || 0, 16, 2048);
  if (!width) return next();
  const quality = clamp(parseInt(String(req.query.q), 10) || 82, 40, 95);

  // Cache key includes the source mtime so edited images bust the cache.
  let mtime = 0;
  try {
    mtime = Math.floor(fs.statSync(normalizedSource).mtimeMs);
  } catch {
    /* ignore */
  }
  const hash = crypto
    .createHash("md5")
    .update(`${normalizedSource}|${width}|${quality}|${mtime}`)
    .digest("hex");
  const cacheFile = path.join(cachePath, `${hash}.webp`);

  const sendFile = (file: string) => {
    res.type("image/webp");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(file);
  };

  // Cache hit — serve immediately.
  if (fs.existsSync(cacheFile)) {
    return sendFile(cacheFile);
  }

  // Cache miss — generate, store, serve.
  fs.mkdirSync(cachePath, { recursive: true });
  sharp(normalizedSource)
    .rotate() // respect EXIF orientation
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer()
    .then((buffer) => {
      fs.writeFile(cacheFile, buffer, () => {
        /* cache write is best-effort */
      });
      res.type("image/webp");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(buffer);
    })
    .catch(() => {
      // On any processing error, fall back to the original static file.
      next();
    });
}
