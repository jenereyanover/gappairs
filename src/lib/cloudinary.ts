// Cloudinary image storage (unsigned client-side uploads via an upload preset).
// No server secret is needed; the cloud name + preset are public, like Firebase
// web config. Admin-only access is enforced by the UI gate + Firestore rules.

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const cloudinaryEnabled = Boolean(CLOUD && PRESET);

export interface UploadedImage {
  url: string;
  publicId: string;
}

/** Upload one image file to Cloudinary; returns its URL + public id. */
export async function uploadToCloudinary(file: File): Promise<UploadedImage> {
  if (!cloudinaryEnabled) throw new Error("Cloudinary is not configured");
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", PRESET as string);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let msg = "Upload failed";
    try {
      const e = await res.json();
      msg = e?.error?.message || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = await res.json();
  return { url: data.secure_url as string, publicId: data.public_id as string };
}

/** A tile "face" is an image when it's a URL; emojis are plain strings. */
export function isImageFace(value: string): boolean {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

/** Rewrite a Cloudinary URL to a small, optimized square thumbnail. */
export function cldThumb(url: string, size = 240): string {
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${size},h_${size},c_fill/`);
}
