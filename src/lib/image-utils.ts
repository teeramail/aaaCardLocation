/**
 * Client-side image conversion to WebP with max size constraint.
 * Uses Canvas API - no external dependencies needed.
 */

const MAX_SIZE_BYTES = 100 * 1024; // 100 KB
const MAX_DIMENSION = 1200;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/webp",
      quality
    );
  });
}

/**
 * Convert any image (File or Blob) to WebP format that is less than 100KB.
 * Progressively reduces quality and dimensions until the target is met.
 */
export async function convertToWebp(source: File | Blob): Promise<{ blob: Blob; dataUrl: string }> {
  const url = URL.createObjectURL(source);

  try {
    const img = await loadImage(url);

    const canvas = document.createElement("canvas");
    let width = img.naturalWidth;
    let height = img.naturalHeight;

    // Scale down if larger than max dimension
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, width, height);

    // Try decreasing quality until under 100KB
    let quality = 0.82;
    let blob = await canvasToWebpBlob(canvas, quality);

    while (blob && blob.size > MAX_SIZE_BYTES && quality > 0.1) {
      quality -= 0.1;
      blob = await canvasToWebpBlob(canvas, quality);
    }

    // If still too large, scale dimensions down further
    if (blob && blob.size > MAX_SIZE_BYTES) {
      let scale = 0.8;
      while (blob && blob.size > MAX_SIZE_BYTES && scale > 0.2) {
        const sw = Math.round(width * scale);
        const sh = Math.round(height * scale);
        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(img, 0, 0, sw, sh);
        blob = await canvasToWebpBlob(canvas, 0.7);
        scale -= 0.1;
      }
    }

    if (!blob) {
      throw new Error("Failed to convert image to WebP.");
    }

    const dataUrl = canvas.toDataURL("image/webp", quality);

    return { blob, dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Convert a Blob to a base64 string (without data URL prefix).
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove "data:...;base64," prefix
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
