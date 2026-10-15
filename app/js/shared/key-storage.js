// Remembers the session key in localStorage when the user ticks "Remember key".
// Storage can be unavailable (private mode, blocked site data), so every call fails quietly.

const STORAGE_KEY = 'liberate-pocket:key';

export function loadSavedKey() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveKey(key) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {}
}

export function forgetSavedKey() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
