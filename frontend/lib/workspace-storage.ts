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
  { name: "Contact directory", prompt: "Build a CRUD API for contacts with name (required string), email (required valid email address), phone (optional string), and company (optional string). Support create, list, get by ID, update, and delete. Reject empty names or invalid email addresses and return 404 for missing contacts." },
  { name: "Expense tracker", prompt: "Build a CRUD API for expenses with description (required string), amount (positive float), category (required string), and incurred_on (date). Support create, list, get by ID, update, and delete. Reject empty descriptions or categories and amounts less than or equal to zero. Return 404 for missing expenses." },
  { name: "Notes", prompt: "Build a CRUD API for notes with title (required string), content (required string), tags (list of strings, default empty), and pinned (boolean, default false). Support create, list, get by ID, update, and delete. Reject empty titles or content and return 404 for missing notes." },
  { name: "Event calendar", prompt: "Build a CRUD API for events with title (required string), starts_at (required datetime), location (optional string), and description (optional string). Support create, list, get by ID, update, and delete. Reject empty titles or invalid datetimes and return 404 for missing events." },
  { name: "Support tickets", prompt: "Build a CRUD API for support tickets with subject (required string), description (required string), status (one of open, in_progress, closed; default open), and priority (one of low, medium, high; default medium). Support create, list, get by ID, update, and delete. Reject empty subjects or descriptions and unsupported statuses or priorities. Return 404 for missing tickets." },
  { name: "Job applications", prompt: "Build a CRUD API for job applications with company (required string), role (required string), status (one of applied, interviewing, offered, rejected; default applied), applied_on (date), and notes (optional string). Support create, list, get by ID, update, and delete. Reject empty company or role names and unsupported statuses. Return 404 for missing applications." },
  { name: "Recipe collection", prompt: "Build a CRUD API for recipes with name (required string), ingredients (non-empty list of non-empty strings), instructions (required string), and prep_minutes (non-negative integer). Support create, list, get by ID, update, and delete. Reject empty names, ingredients, or instructions and negative preparation times. Return 404 for missing recipes." },
  { name: "Habit tracker", prompt: "Build a CRUD API for habits with name (required string), frequency (one of daily, weekly; default daily), active (boolean, default true), and notes (optional string). Support create, list, get by ID, update, and delete. Reject empty names or unsupported frequencies and return 404 for missing habits." },
  { name: "Course catalog", prompt: "Build a CRUD API for courses with title (required string), description (optional string), instructor (required string), and duration_hours (positive integer). Support create, list, get by ID, update, and delete. Reject empty titles or instructor names and durations less than or equal to zero. Return 404 for missing courses." },
];
