// Шифрование пароля приложения от почты. Ключ — переменная окружения MAIL_SECRET_KEY, только на сервере.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const k = process.env.MAIL_SECRET_KEY;
  if (!k || k.length < 16) throw new Error("MAIL_SECRET_KEY is not set");
  return createHash("sha256").update(k).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(packed: string): string {
  const [iv, tag, data] = packed.split(".");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
