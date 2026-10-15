import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "./config";

function key(): Buffer {
  const raw = config().SECRET_KEY;
  if (!raw) throw new Error("SECRET_KEY is not set");
  const k = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("SECRET_KEY must be 32 bytes (64 hex characters or base64)");
  return k;
}

/** AES-256-GCM: "iv.tag.ciphertext", base64url. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(sealed: string): string {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

/** A random token with a readable prefix, e.g. "bm_3fK...". */
export function newToken(prefix = "bm"): string {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
