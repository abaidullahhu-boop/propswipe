/**
 * Infer S3 object keys from the public video URL shape produced by this app after FFmpeg + upload.
 * Used when the upload API did not return videoKey/thumbnailKey (older server) so admin preview can still proxy.
 */
export function inferPropertyMediaKeysFromVideoUrl(videoUrl: string): {
  videoKey: string;
  thumbnailKey: string;
} | null {
  try {
    const u = new URL(videoUrl.trim());
    const path = u.pathname.replace(/^\/+/, "");
    if (!path.startsWith("properties/videos/") || !/-processed\.mp4$/i.test(path)) {
      return null;
    }
    const file = path.slice("properties/videos/".length);
    const base = file.replace(/-processed\.mp4$/i, "");
    if (!base) return null;
    return {
      videoKey: path,
      thumbnailKey: `properties/thumbnails/${base}-thumb.jpg`,
    };
  } catch {
    return null;
  }
}
