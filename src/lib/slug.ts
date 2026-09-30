import { customAlphabet } from "nanoid";

// Uppercase letters + digits, avoids ambiguous chars (0/O, 1/I) for readable QR/URLs.
const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generate = customAlphabet(alphabet, 7);

/** Generates a short public slug for an event, e.g. "K7X9QRT" used in /e/K7X9QRT */
export function generateEventSlug(): string {
  return generate();
}