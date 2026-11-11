/**
 * Profile photo rules (the API keeps at most 200 KB, png, jpeg or webp). The browser resizes the
 * picture before upload; this file is the pure part (sizes, quality steps, the "too big" error
 * words) and resizeAvatar() is the canvas part, which only runs in a browser.
 */
export const AVATAR_MAX_PX = 256;
export const AVATAR_MAX_BYTES = 200 * 1024;
/** Pictures bigger than this are refused without decoding them. */
export const AVATAR_INPUT_MAX_BYTES = 10 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";
const INPUT_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type AvatarError = "unsupported" | "too-big" | "unreadable";

export const AVATAR_ERRORS: Record<AvatarError, { title: string; body: string }> = {
  "too-big": {
    title: "That photo is too big",
    body: "Use a JPG, PNG or WebP image under 10 MB.",
  },
  unsupported: {
    title: "That file isn’t a photo we can use",
    body: "Use a JPG, PNG or WebP image.",
  },
  unreadable: {
    title: "We couldn’t read that photo",
    body: "Try a different image.",
  },
};

/** Checked before decoding: type and size of the file the learner picked. */
export function checkAvatarFile(file: { type: string; size: number }): AvatarError | null {
  if (!INPUT_TYPES.includes(file.type)) return "unsupported";
  if (file.size > AVATAR_INPUT_MAX_BYTES) return "too-big";
  return null;
}

/**
 * Square crop from the centre of the picture: where it starts, its side, and the size of the
 * output (the side, capped at AVATAR_MAX_PX).
 */
export function cropBox(width: number, height: number, max = AVATAR_MAX_PX) {
  const side = Math.min(width, height);
  return {
    sx: Math.floor((width - side) / 2),
    sy: Math.floor((height - side) / 2),
    side,
    out: Math.max(1, Math.min(max, side)),
  };
}

/** Encoder settings to try in order, until the result fits in AVATAR_MAX_BYTES. */
export const QUALITY_STEPS = [0.9, 0.8, 0.7, 0.55, 0.4] as const;
export const SIZE_STEPS = [1, 0.75, 0.5] as const;

/** The (size factor, quality) pairs to try, best first. */
export function encodeAttempts(): Array<{ scale: number; quality: number }> {
  return SIZE_STEPS.flatMap((scale) => QUALITY_STEPS.map((quality) => ({ scale, quality })));
}

export type ResizeResult = { ok: true; blob: Blob } | { ok: false; error: AvatarError };

/** Decodes the file, crops to a square, scales to at most 256 px and encodes under 200 KB. */
export async function resizeAvatar(file: File): Promise<ResizeResult> {
  const problem = checkAvatarFile(file);
  if (problem) return { ok: false, error: problem };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, error: "unreadable" };
  }
  try {
    const { sx, sy, side, out } = cropBox(bitmap.width, bitmap.height);
    for (const { scale, quality } of encodeAttempts()) {
      const size = Math.max(1, Math.round(out * scale));
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) return { ok: false, error: "unreadable" };
      context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      // A browser that cannot encode webp falls back to png: still fine if it fits.
      if (blob && blob.size <= AVATAR_MAX_BYTES) return { ok: true, blob };
    }
    return { ok: false, error: "too-big" };
  } finally {
    bitmap.close();
  }
}
