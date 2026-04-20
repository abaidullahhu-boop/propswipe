/** When S3 uploads are enabled, listings must store absolute https URLs (S3/CloudFront), not app-relative paths. */

/** Reject temp disk paths and relative URLs — they break in the browser (e.g. /uploads/processed/... after cleanup). */
export function validatePublicMediaUrl(field: "videoUrl" | "thumbnailUrl", url: string): string | undefined {
  const v = String(url ?? "").trim();
  if (v === "") {
    return field === "videoUrl" ? "videoUrl is required." : undefined;
  }
  if (v.startsWith("/")) {
    return `${field} cannot be a site-relative path (e.g. /uploads/...). Use the full https URL returned after upload (S3).`;
  }
  if (!/^https?:\/\//i.test(v)) {
    return `${field} must be an absolute URL starting with https:// or http://.`;
  }
  if (/\/uploads\//i.test(v) || /\\uploads\\/i.test(v)) {
    return `${field} must not point at the app /uploads folder; use the public object URL (S3/CloudFront).`;
  }
  return undefined;
}

export function validateHttpsMediaForS3(
  isS3Enabled: boolean,
  videoUrl: string,
  thumbnailUrl?: string | null
): string | undefined {
  if (!isS3Enabled) return undefined;
  const v = String(videoUrl ?? "").trim();
  if (!v.startsWith("https://")) {
    return "videoUrl must be a full https URL (upload the video in admin so it is stored on S3).";
  }
  const t = thumbnailUrl == null ? "" : String(thumbnailUrl).trim();
  if (t !== "" && !t.startsWith("https://")) {
    return "thumbnailUrl must be a full https URL or empty.";
  }
  return undefined;
}

export function validateHttpsMediaPatchForS3(
  isS3Enabled: boolean,
  updates: { videoUrl?: unknown; thumbnailUrl?: unknown }
): string | undefined {
  if (!isS3Enabled) return undefined;
  if (updates.videoUrl !== undefined) {
    const v = String(updates.videoUrl ?? "").trim();
    if (v !== "" && !v.startsWith("https://")) {
      return "videoUrl must be a full https URL (e.g. from S3).";
    }
  }
  if (updates.thumbnailUrl !== undefined && updates.thumbnailUrl !== null) {
    const t = String(updates.thumbnailUrl).trim();
    if (t !== "" && !t.startsWith("https://")) {
      return "thumbnailUrl must be a full https URL or empty.";
    }
  }
  return undefined;
}
