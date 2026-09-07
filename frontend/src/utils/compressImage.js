import piexif from "piexifjs";

const MAX_DIMENSION = 1280;
const QUALITY = 0.75;

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// The server flags a submission when a photo's own capture date doesn't match the claimed
// submission date — canvas re-encoding (below) strips all EXIF, which would silently kill that
// check. Read just the original capture-date tags before compressing, from the original file
// (not the resized one — cheap, since JPEG EXIF lives in the first few KB regardless of size).
function readCaptureDateTag(file) {
  return fileToDataURL(file)
    .then((dataUrl) => {
      const exif = piexif.load(dataUrl);
      return exif.Exif?.[piexif.ExifIFD.DateTimeOriginal] || exif.Exif?.[piexif.ExifIFD.DateTimeDigitized] || null;
    })
    .catch(() => null); // not a JPEG, or no EXIF at all — nothing to carry over
}

// Vercel Functions hard-cap the whole request body at 4.5MB and reset the connection (no
// clean error) past that — raw phone-camera photos are routinely 3-8MB each, so every photo
// is downscaled/re-encoded to JPEG client-side before it's ever added to the upload.
function resizeToBlob(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Image compression failed"))),
        "image/jpeg",
        QUALITY,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

export async function compressImage(file) {
  const [captureDate, blob] = await Promise.all([readCaptureDateTag(file), resizeToBlob(file)]);
  const name = file.name.replace(/\.\w+$/, ".jpg");
  if (!captureDate) return new File([blob], name, { type: "image/jpeg" });

  // Re-inject just the capture-date tag into the freshly compressed JPEG.
  const dataUrl = await fileToDataURL(new File([blob], name, { type: "image/jpeg" }));
  const exifBytes = piexif.dump({
    "0th": {},
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: captureDate,
      [piexif.ExifIFD.DateTimeDigitized]: captureDate,
    },
    GPS: {},
    "1st": {},
    thumbnail: null,
  });
  const withExif = piexif.insert(exifBytes, dataUrl);
  const finalBlob = await fetch(withExif).then((r) => r.blob());
  return new File([finalBlob], name, { type: "image/jpeg" });
}
