import type { Property } from "@shared/schema";

const RECENTLY_VIEWED_KEY = "psr_recently_viewed_v1";
const DOWNLOADED_KEY = "psr_downloaded_v1";

type StoredProperty = Property & { viewedAt?: string };

export function addRecentlyViewed(property: Property) {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const existing: StoredProperty[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((p) => p.id !== property.id);
    const next: StoredProperty[] = [
      { ...property, viewedAt: new Date().toISOString() },
      ...filtered,
    ].slice(0, 30);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function getRecentlyViewed(): StoredProperty[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return raw ? (JSON.parse(raw) as StoredProperty[]) : [];
  } catch {
    return [];
  }
}

export function getDownloadedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DOWNLOADED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function setDownloadedId(id: string, enabled: boolean) {
  const ids = getDownloadedIds();
  if (enabled) {
    ids.add(id);
  } else {
    ids.delete(id);
  }
  localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(Array.from(ids)));
}

export async function cacheMedia(urls: string[]) {
  if (!("caches" in window)) return;
  const cache = await caches.open("propswipe-media-v1");
  await Promise.all(
    urls.filter(Boolean).map(async (url) => {
      const req = new Request(url, { mode: "no-cors" as RequestMode });
      const response = await fetch(req);
      await cache.put(req, response);
    })
  );
}

export { RECENTLY_VIEWED_KEY, DOWNLOADED_KEY };

