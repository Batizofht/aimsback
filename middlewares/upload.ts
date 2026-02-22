import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "uploads/other";
    
    // Profile pictures
    if (file.fieldname === "profile") folder = "uploads/profiles";
    // Slider images
    if (file.fieldname === "slider" || file.fieldname === "im1" || file.fieldname === "im2" || file.fieldname === "im3" || file.fieldname === "im4") folder = "uploads/slider";
    // Message images
    if (file.fieldname === "messageImage") folder = "uploads/messageimage";
    // Audio messages
    if (file.fieldname === "audio" || file.fieldname === "messageAudio") folder = "uploads/audio";
    // Profile images
    if (file.fieldname === "profileImage") folder = "uploads/Images";

    // Ensure folder exists
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs and common audio types
    const allowed = /jpeg|png|jpg|webp|gif|pdf|mp3|m4a|wav|webp|ogg|mpeg|aac/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);

    if (extname || mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images, audio and PDFs are allowed."));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});


export default upload;

