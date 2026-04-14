const raw = (import.meta.env.VITE_API_URL || "").trim();
const base = raw.endsWith("/") ? raw.slice(0, -1) : raw;

export function apiUrl(path) {
  if (!path.startsWith("/")) {
    throw new Error(`Path must start with '/': ${path}`);
  }
  return base ? `${base}${path}` : path;
}
