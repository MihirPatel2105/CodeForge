export function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    if (fallback !== null && typeof fallback !== typeof parsed) return fallback;
    return parsed as T;
  } catch { return fallback; }
}
export function writeLocal(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export const API_TEMPLATES = [
  { name: "Task manager", prompt: "Build a CRUD API for tasks with title (required string), description (optional string), completed (boolean, default false), and due_date (optional datetime). Support create, list, get by ID, update, and delete. Reject empty titles and return 404 for missing tasks." },
  { name: "Book library", prompt: "Build a CRUD API for books with title and author (required strings), year (integer), and genres (list of strings). Support create, list, get by ID, update, and delete. Reject empty titles and return 404 for missing books." },
  { name: "Inventory", prompt: "Build a CRUD API for products with name (required string), price (non-negative float), quantity (non-negative integer), and category (string). Support create, list, get by ID, update, and delete. Reject negative prices or quantities and return 404 for missing products." },
];
