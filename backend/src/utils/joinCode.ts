import { customAlphabet } from "nanoid";

// Deliberately excludes 0/O, 1/I/L and similar look-alikes since people will
// be typing this in by hand on a phone keyboard.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generate = customAlphabet(ALPHABET, 6);

export function generateJoinCode(): string {
  return generate();
}
