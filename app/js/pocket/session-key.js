// Session keys are 16 characters of A–Z and 0–9.

export const SESSION_KEY_LENGTH = 16;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateSessionKey() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(SESSION_KEY_LENGTH));
  return [...randomBytes].map(byte => ALPHABET[byte % ALPHABET.length]).join('');
}
