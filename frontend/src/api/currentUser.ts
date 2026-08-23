const STORAGE_KEY = "mm_user_id";

export function getCurrentUserId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setCurrentUserId(id: string) {
  localStorage.setItem(STORAGE_KEY, id);
}
