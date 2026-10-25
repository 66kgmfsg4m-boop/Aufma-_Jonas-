export const LIBRARY_CHANGED = "aufmass:changed";

export function notifyLibraryChanged() {
  window.dispatchEvent(new Event(LIBRARY_CHANGED));
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Die Anfrage ist fehlgeschlagen.");
  }
  return data as T;
}
