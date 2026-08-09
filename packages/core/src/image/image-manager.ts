import type {
  ImageCompressionOptions,
  ImageDimensions,
  ImageUploadResult,
  ImageValidationOptions,
  ImageValidationResult,
} from "./types";

// =============================================================================
// Constants
// =============================================================================

/** Default max file size: 5MB */
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Default compression quality */
const DEFAULT_COMPRESSION_QUALITY = 0.8;

/** Default max dimensions */
const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_MAX_HEIGHT = 1080;

/** Minimum image dimension */
const MIN_IMAGE_DIMENSION = 50;

// =============================================================================
// Validation utilities
// =============================================================================

/**
 * Validates whether the given MIME type is a supported image type.
 *
 * @param mimeType - MIME type string to check
 * @param allowedTypes - Exact MIME types to accept; omit to accept any image
 * @returns true if the MIME type is a supported image format
 *
 * @example
 * ```typescript
 * isValidMimeType("image/jpeg"); // true
 * isValidMimeType("application/pdf"); // false
 * isValidMimeType("image/gif", ["image/png"]); // false
 * ```
 */
export function isValidMimeType(mimeType: string, allowedTypes?: readonly string[]): boolean {
  if (allowedTypes && allowedTypes.length > 0) {
    return allowedTypes.includes(mimeType);
  }
  return mimeType.startsWith("image/");
}

/**
 * Checks whether a file is within the given size limit.
 *
 * @param file - The file to check
 * @param maxSizeBytes - Maximum allowed size in bytes
 * @returns true if the file is within the size limit
 *
 * @example
 * ```typescript
 * isWithinSizeLimit(file, 5 * 1024 * 1024); // true if file <= 5MB
 * ```
 */
export function isWithinSizeLimit(file: File, maxSizeBytes: number): boolean {
  return file.size <= maxSizeBytes;
}

/**
 * Validates an image file for type and size constraints.
 *
 * @param file - The file to validate
 * @param options - Optional validation options
 * @returns ImageValidationResult with valid flag and optional error message
 *
 * @example
 * ```typescript
 * const result = validateImage(file, { maxSize: 5 * 1024 * 1024 });
 * if (!result.valid) console.error(result.error);
 * ```
 */
export function validateImage(
  file: File,
  options: ImageValidationOptions = {}
): ImageValidationResult {
  const maxSize = options.maxSize ?? DEFAULT_MAX_FILE_SIZE;

  if (!isValidMimeType(file.type, options.allowedTypes)) {
    return { valid: false, error: "File must be an image" };
  }

  if (!isWithinSizeLimit(file, maxSize)) {
    const maxSizeMB = maxSize / 1024 / 1024;
    return {
      valid: false,
      error: `Image is too large (max ${maxSizeMB}MB)`,
    };
  }

  return { valid: true };
}

// =============================================================================
// Dimension helpers
// =============================================================================

/**
 * Calculates scaled dimensions that fit within maxWidth/maxHeight while
 * preserving the original aspect ratio.
 */
function calculateScaledDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: width * ratio,
    height: height * ratio,
  };
}

/**
 * Enforces minimum dimension constraints.
 *
 * Used for an explicit resize, where each axis is its own instruction.
 */
function clampDimension(value: number): number {
  return Math.max(MIN_IMAGE_DIMENSION, value);
}

/**
 * Lifts a box up to the minimum dimension without changing its shape, and
 * without breaching the caller's maximum.
 *
 * Clamping each axis on its own is what distorts: a 16x8 favicon came out
 * 50x50, twice as tall as it should be, because both axes hit the floor
 * independently and the ratio between them was lost.
 *
 * @param width - Width after `calculateScaledDimensions`, so already inside the box
 * @param height - Height after `calculateScaledDimensions`
 * @param maxWidth - The caller's width limit, which the lift may not exceed
 * @param maxHeight - The caller's height limit
 */
function scaleToMinimum(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const smallest = Math.min(width, height);

  // A browser that cannot measure the image reports 0 on an axis — Firefox does
  // it for an SVG that declares no width, height or viewBox. MIN / 0 is
  // Infinity, 0 * Infinity is NaN, and a NaN canvas dimension becomes 0, so
  // toBlob returns null and the whole compression rejects. There is no shape to
  // preserve in a box with no area, so the square minimum is the answer.
  if (!Number.isFinite(smallest) || smallest <= 0) {
    return { width: MIN_IMAGE_DIMENSION, height: MIN_IMAGE_DIMENSION };
  }

  if (smallest >= MIN_IMAGE_DIMENSION) {
    return { width: Math.round(width), height: Math.round(height) };
  }

  const scale = MIN_IMAGE_DIMENSION / smallest;
  const lifted = { width: Math.round(width * scale), height: Math.round(height * scale) };

  // An extreme aspect ratio cannot satisfy both bounds at once. This runs after
  // `calculateScaledDimensions`, so the box already fits the maximum; lifting a
  // 1200x2 spacer to a 50px floor would take it to 30000x50 — roughly a 6 MB
  // canvas plus its base64, and a `width: 30000` written onto the node. The
  // caller's maximum wins, and the source is returned as it came rather than
  // distorted onto one axis.
  if (lifted.width > maxWidth || lifted.height > maxHeight) {
    return { width: Math.round(width), height: Math.round(height) };
  }

  return lifted;
}

// =============================================================================
// Compression
// =============================================================================

/**
 * Compresses an image file using the browser Canvas API.
 *
 * Reads the file using a Blob URL, draws it on a canvas at the target
 * dimensions, then encodes back to a base64 data URL.
 *
 * No Angular Zone.js or DI dependencies — pure Web API usage.
 *
 * @param file - The image file to compress
 * @param options - Optional compression options (quality, maxWidth, maxHeight)
 * @returns Promise resolving to an ImageUploadResult with the compressed base64 src
 *
 * @example
 * ```typescript
 * const result = await compressImage(file, { quality: 0.8, maxWidth: 1920 });
 * editor.chain().focus().setResizableImage({ src: result.src }).run();
 * ```
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<ImageUploadResult> {
  const quality = options.quality ?? DEFAULT_COMPRESSION_QUALITY;
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_HEIGHT;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      const { width, height } = calculateScaledDimensions(
        img.width,
        img.height,
        maxWidth,
        maxHeight
      );

      const canvasSize = scaleToMinimum(width, height, maxWidth, maxHeight);
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression error"));
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            if (base64) {
              resolve({
                src: base64,
                name: file.name,
                size: blob.size,
                type: file.type,
                width: Math.round(canvas.width),
                height: Math.round(canvas.height),
                originalSize: file.size,
              });
            } else {
              reject(new Error("Compression error"));
            }
          };
          reader.onerror = () => reject(new Error("Failed to read compressed image"));
          reader.readAsDataURL(blob);
        },
        file.type,
        quality
      );

      // Cleanup Blob URL
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Error loading image"));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Reads an image file as a base64 data URL without re-encoding it.
 *
 * The counterpart to `compressImage` for `ImageUploadConfig.compressImages:
 * false` — the canvas round-trip in `compressImage` always re-encodes and
 * downscales, which destroys the original bytes even when the consumer asked
 * for them untouched.
 *
 * @param file - The image file to read
 * @returns Promise resolving to an ImageUploadResult carrying the original bytes
 *
 * @example
 * ```typescript
 * const result = await readImageFile(file);
 * editor.chain().focus().setResizableImage({ src: result.src }).run();
 * ```
 */
export async function readImageFile(file: File): Promise<ImageUploadResult> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result;
      if (typeof base64 === "string") {
        resolve(base64);
      } else {
        reject(new Error("Failed to read image"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

  const { width, height } = await getNaturalImageDimensions(src);

  return {
    src,
    name: file.name,
    size: file.size,
    type: file.type,
    width,
    height,
    originalSize: file.size,
  };
}

// =============================================================================
// Dimension utilities
// =============================================================================

/**
 * Loads an image from a URL and returns its natural dimensions.
 *
 * @param src - Image URL or base64 data URL
 * @returns Promise resolving to { width, height }
 *
 * @example
 * ```typescript
 * const dims = await getNaturalImageDimensions(src);
 * console.log(`${dims.width}×${dims.height}`);
 * ```
 */
export function getNaturalImageDimensions(src: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    img.src = src;
  });
}

/**
 * Calculates new dimensions when resizing, optionally preserving aspect ratio.
 *
 * @param currentWidth - Current image width
 * @param currentHeight - Current image height
 * @param options - Resize options
 * @returns New width and height values
 *
 * @example
 * ```typescript
 * const dims = calculateResizeDimensions(800, 600, { width: 400, maintainAspectRatio: true });
 * // { width: 400, height: 300 }
 * ```
 */
export function calculateResizeDimensions(
  currentWidth: number,
  currentHeight: number,
  options: { width?: number; height?: number; maintainAspectRatio?: boolean }
): { width?: number; height?: number } {
  let newWidth = options.width;
  let newHeight = options.height;

  if (options.maintainAspectRatio !== false && currentWidth && currentHeight) {
    const aspectRatio = currentWidth / currentHeight;

    if (newWidth && !newHeight) {
      newHeight = Math.round(newWidth / aspectRatio);
    } else if (newHeight && !newWidth) {
      newWidth = Math.round(newHeight * aspectRatio);
    }
  }

  if (newWidth) newWidth = clampDimension(newWidth);
  if (newHeight) newHeight = clampDimension(newHeight);

  return { width: newWidth, height: newHeight };
}
