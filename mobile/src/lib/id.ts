import * as Crypto from "expo-crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Url-safe random id from a cryptographically secure source. */
export function randomId(length = 24): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(length));
  let id = "";
  for (const byte of bytes) id += ALPHABET[byte & 63];
  return id;
}
