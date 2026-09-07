/**
 * IMAP/SMTP 로 메일을 읽고 보낸다 (서버에서만 사용).
 * gmail.js / graph.js 와 같은 함수 이름을 제공하되, 첫 인자는 accessToken 대신
 * 복호화된 접속정보 creds = { email, password, imapHost, imapPort, smtpHost, smtpPort } 이다.
 */
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import { mapLimit } from "./util";

const MAX_BODY_CHARS = 4000;

/** HTML 을 대충 평문으로 */
function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fmtAddr(a) {
  if (!a) return "";
  return a.name ? `${a.name} <${a.address}>` : a.address || "";
}

/** IMAP 클라이언트를 열고 INBOX 잠금 후 콜백 실행, 끝나면 정리 */
async function withInbox(creds, fn) {
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapPort === 993,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
    // 자체서명 인증서 대응 여지 (대학 서버 등). 기본은 검증 유지.
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      return await fn(client);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

/** 접속·로그인만 확인 (자격증명 검증용) */
export async function verifyImap(creds) {
  try {
    await withInbox(creds, async () => true);
    return true;
  } catch {
    return false;
  }
}

/** 최근 메일 UID 목록 (최신순) */
export async function listRecentMessageIds(creds, max = 30) {
  return withInbox(creds, async (client) => {
    const status = await client.status("INBOX", { messages: true });
    const total = status.messages || 0;
    if (total === 0) return [];
    const start = Math.max(1, total - max + 1);
    const out = [];
    for await (const msg of client.fetch(`${start}:${total}`, { uid: true })) {
      out.push({ id: String(msg.uid), threadId: String(msg.uid) });
    }
    return out.reverse(); // 최신이 앞으로
  });
}

/** UID 들의 헤더(보낸사람/제목/날짜) — 미리보기(snippet)는 비움 */
export async function getMessagesMetadata(creds, ids) {
  if (!ids || ids.length === 0) return [];
  return withInbox(creds, async (client) => {
    const byId = new Map();
    for await (const msg of client.fetch(
      ids.join(","),
      { uid: true, envelope: true },
      { uid: true }
    )) {
      const env = msg.envelope || {};
      byId.set(String(msg.uid), {
        id: String(msg.uid),
        threadId: String(msg.uid),
        from: fmtAddr(env.from?.[0]),
        subject: env.subject || "",
        date: env.date ? new Date(env.date).toISOString() : "",
        snippet: "",
      });
    }
    return ids
      .map((id) => byId.get(String(id)))
      .filter(Boolean);
  });
}

/** UID 한 개의 본문까지 */
export async function getEmailWithBody(creds, id) {
  return withInbox(creds, async (client) => {
    const msg = await client.fetchOne(
      String(id),
      { uid: true, envelope: true, source: true },
      { uid: true }
    );
    if (!msg || !msg.source) throw new Error("메일을 찾지 못했어요.");
    const parsed = await simpleParser(msg.source);
    const env = msg.envelope || {};

    let body =
      parsed.text || (parsed.html ? stripHtml(parsed.html) : "") || "";
    if (body.length > MAX_BODY_CHARS) {
      body = body.slice(0, MAX_BODY_CHARS) + "\n…(이하 생략)";
    }

    const references = Array.isArray(parsed.references)
      ? parsed.references.join(" ")
      : parsed.references || "";

    return {
      id: String(id),
      threadId: String(id),
      from: fmtAddr(env.from?.[0]),
      replyTo:
        parsed.replyTo?.value?.[0]?.address ||
        parsed.from?.value?.[0]?.address ||
        env.from?.[0]?.address ||
        "",
      to: parsed.to?.text || "",
      subject: env.subject || parsed.subject || "",
      date: env.date ? new Date(env.date).toISOString() : "",
      messageId: parsed.messageId || "",
      references,
      body,
    };
  });
}

/** SMTP 로 답장 전송 */
export async function sendReply(creds, { orig, subject, bodyText }) {
  const transporter = nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: creds.smtpPort === 465, // 465 = implicit TLS, 587 = STARTTLS
    auth: { user: creds.email, pass: creds.password },
  });

  const subj =
    subject ||
    (orig.subject.startsWith("Re:") ? orig.subject : `Re: ${orig.subject}`);
  const refs = [orig.references, orig.messageId].filter(Boolean).join(" ");

  await transporter.sendMail({
    from: creds.email,
    to: orig.replyTo,
    subject: subj,
    text: bodyText,
    inReplyTo: orig.messageId || undefined,
    references: refs || undefined,
  });
  return { ok: true };
}
