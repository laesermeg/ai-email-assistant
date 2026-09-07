import { getDb } from "./db";
import { encryptSecret, decryptSecret } from "./crypto";

/**
 * IMAP 직접 연결 사용자의 접속 정보(서버 주소 + 암호화된 비밀번호)를 DB에 보관한다.
 * 비밀번호는 항상 암호화 상태로 저장하고, 읽을 때만 복호화한다. (서버에서만)
 */

/** 저장/갱신 */
export async function saveMailCredentials(userEmail, {
  imapHost,
  imapPort,
  smtpHost,
  smtpPort,
  password,
}) {
  const db = getDb();
  const { error } = await db.from("mail_credentials").upsert(
    {
      user_email: userEmail,
      imap_host: imapHost,
      imap_port: imapPort,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      enc_password: encryptSecret(password),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_email" }
  );
  if (error) throw new Error("메일 접속정보 저장 실패: " + error.message);
}

/**
 * 접속 정보를 복호화해서 반환. 없으면 null.
 * @returns {Promise<{email,imapHost,imapPort,smtpHost,smtpPort,password}|null>}
 */
export async function getMailCredentials(userEmail) {
  const db = getDb();
  const { data, error } = await db
    .from("mail_credentials")
    .select("imap_host, imap_port, smtp_host, smtp_port, enc_password")
    .eq("user_email", userEmail)
    .maybeSingle();
  if (error) throw new Error("메일 접속정보 조회 실패: " + error.message);
  if (!data) return null;
  return {
    email: userEmail,
    imapHost: data.imap_host,
    imapPort: data.imap_port,
    smtpHost: data.smtp_host,
    smtpPort: data.smtp_port,
    password: decryptSecret(data.enc_password),
  };
}
