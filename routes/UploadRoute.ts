import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "blog-covers");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `blog-cover-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (jpeg, jpg, png, webp, gif)"));
    }
  },
});

router.post("/cover", (req: Request, res: Response) => {
  upload.single("image")(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      const imageUrl = `/uploads/blog-covers/${req.file.filename}`;
      res.json({ url: imageUrl });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
});

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "documents");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `document-${uniqueSuffix}${ext}`);
  },
});

const fileUpload = multer({
  storage: fileStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and document files are allowed (pdf, doc, docx)"));
    }
  },
});

router.post("/file", (req: Request, res: Response) => {
  fileUpload.single("file")(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      const fileUrl = `/uploads/documents/${req.file.filename}`;
      res.json({ url: fileUrl });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
});

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "media");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `media-${uniqueSuffix}${ext}`);
  },
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|m4a|wav|ogg|aac|mp4|mov|m4v|webm|mpeg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      cb(null, true);
    } else {
      cb(new Error("Only audio and video files are allowed (mp3, m4a, wav, ogg, aac, mp4, mov, webm)"));
    }
  },
});

router.post("/media", (req: Request, res: Response) => {
  mediaUpload.single("media")(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      const mediaUrl = `/uploads/media/${req.file.filename}`;
      res.json({ url: mediaUrl });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
});

export default router;