import multer from "multer";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// In-memory buffers only — files are uploaded straight to Cloudinary, never written to local disk.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(new Error("Unsupported image type"));
    cb(null, true);
  },
});
