/**
 * Compresses an image file to a Base64 string suitable for Firestore storage.
 * Max dimensions: 800x800, JPEG quality: 0.5, target size: ~150KB
 */
export function compressImage(file: File | Blob, maxSize = 800, quality = 0.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if larger than maxSize
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try to get it under ~200KB by reducing quality iteratively
        let currentQuality = quality;
        let result = canvas.toDataURL("image/jpeg", currentQuality);

        // If still too large, reduce quality further
        while (result.length > 250000 && currentQuality > 0.1) {
          currentQuality -= 0.1;
          result = canvas.toDataURL("image/jpeg", currentQuality);
        }

        resolve(result);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a File to a Base64 data URL string.
 * For non-image files (PDFs, docs, etc.)
 * Max size: ~500KB after encoding
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 500 * 1024) {
      reject(new Error("File too large. Maximum size is 500KB."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/**
 * Formats a file size in bytes to a human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
