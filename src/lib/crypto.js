import crypto from "node:crypto";

/**
 * 사용자 메일 비밀번호를 저장하기 전에 암호화한다 (AES-256-GCM).
 * 키는 서버 환경변수 IMAP_ENC_KEY (32바이트 base64). 절대 클라이언트로 나가지 않는다.
 */

function key() {
  const b64 = process.env.IMAP_ENC_KEY;
  if (!b64) throw new Error("IMAP_ENC_KEY 가 설정되지 않았습니다.");
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) throw new Error("IMAP_ENC_KEY 는 32바이트여야 합니다.");
  return buf;
}

/** 평문 → base64(iv|tag|ciphertext) */
export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([
    cipher.update(String(plain), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** base64(iv|tag|ciphertext) → 평문 */
export function decryptSecret(b64) {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}
