const STORAGE_PREFIX = "custom-references-v1";

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getCustomReferencesKey = (userId) =>
  `${STORAGE_PREFIX}:${userId || "guest"}`;

export const normalizeReferenceTarget = (value) => {
  const input = String(value || "").trim();
  if (!input) return "";

  if (/^https?:\/\//i.test(input)) return input;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(input)) return `https://${input}`;

  return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
};

export const loadCustomReferences = (userId) => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getCustomReferencesKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveCustomReferences = (userId, references) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(getCustomReferencesKey(userId), JSON.stringify(references));
};

export const createCustomReference = (title, target) => ({
  id: createId(),
  title: title.trim(),
  target: normalizeReferenceTarget(target),
  note: "",
  createdAt: new Date().toISOString(),
});
