import { createHash, randomBytes } from "node:crypto";

// only the hash of this ever reaches the database
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newId(): string {
  return randomBytes(9).toString("base64url");
}

export function looksLikeToken(t: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(t);
}
