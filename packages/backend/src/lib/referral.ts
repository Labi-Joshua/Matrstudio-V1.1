// Crockford base32 (no I, L, O, U): 8 chars = 40 bits, collisions are caught by the UNIQUE index.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateReferralCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
}
