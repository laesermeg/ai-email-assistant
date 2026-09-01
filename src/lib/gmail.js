/**
 * Gmail API 호출 도우미 (서버에서만 사용).
 * 공식 라이브러리 없이 fetch 로 직접 호출한다.
 *
 * Gmail REST API 문서: https://developers.google.com/gmail/api/reference/rest
 */

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

function authHeader(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

/** 헤더 배열([{name, value}, ...])에서 원하는 헤더 값을 꺼낸다. */
function pickHeader(headers, name) {
  const found = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return found ? found.value : "";
}

/**
 * 받은편지함(INBOX)에서 최근 메일 요약 목록을 가져온다.
 * @param {string} accessToken  구글 access token
 * @param {number} max          가져올 개수 (기본 10)
 * @returns {Promise<Array<{id,threadId,from,subject,date,snippet}>>}
 */
export async function getRecentEmails(accessToken, max = 10) {
  // 1) 최근 메일 ID 목록 요청
  const listRes = await fetch(
    `${GMAIL_API}/messages?maxResults=${max}&labelIds=INBOX`,
    { headers: authHeader(accessToken) }
  );
  if (!listRes.ok) {
    throw new Error(`메일 목록 요청 실패 (HTTP ${listRes.status})`);
  }
  const listData = await listRes.json();
  const ids = (listData.messages || []).map((m) => m.id);

  // 2) 각 메일의 헤더(보낸사람/제목/날짜) + 미리보기(snippet)만 요청
  //    format=metadata 로 본문 전체는 받지 않는다 (최소 수집 원칙)
  const emails = await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(
        `${GMAIL_API}/messages/${id}` +
          `?format=metadata` +
          `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: authHeader(accessToken) }
      );
      if (!res.ok) {
        throw new Error(`메일 상세 요청 실패 (HTTP ${res.status})`);
      }
      const msg = await res.json();
      const headers = msg.payload?.headers || [];
      return {
        id: msg.id,
        threadId: msg.threadId,
        from: pickHeader(headers, "From"),
        subject: pickHeader(headers, "Subject"),
        date: pickHeader(headers, "Date"),
        snippet: msg.snippet || "",
      };
    })
  );

  return emails;
}

/** base64url 문자열을 일반 텍스트로 디코드한다. */
function decodeBase64Url(data) {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Gmail 메시지 payload 트리에서 text/plain 본문을 찾아 반환한다.
 * 없으면 text/html 을 찾아 태그를 대충 제거한 텍스트를 반환한다.
 */
function extractBody(payload) {
  if (!payload) return "";

  // 단일 파트
  if (payload.body?.data && payload.mimeType?.startsWith("text/")) {
    const text = decodeBase64Url(payload.body.data);
    return payload.mimeType === "text/html" ? stripHtml(text) : text;
  }

  // 여러 파트: text/plain 우선, 없으면 text/html, 그것도 없으면 하위 파트 재귀
  const parts = payload.parts || [];
  const plain = parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
  if (plain) return decodeBase64Url(plain.body.data);

  const html = parts.find((p) => p.mimeType === "text/html" && p.body?.data);
  if (html) return stripHtml(decodeBase64Url(html.body.data));

  for (const p of parts) {
    const nested = extractBody(p);
    if (nested) return nested;
  }
  return "";
}

/** HTML 태그를 대충 제거해 읽을 수 있는 텍스트로 만든다. */
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

/** "홍길동 <hong@x.com>" 에서 순수 주소 "hong@x.com" 만 뽑는다. */
export function extractAddress(fromHeader) {
  const m = (fromHeader || "").match(/<([^>]+)>/);
  return (m ? m[1] : fromHeader || "").trim();
}

/**
 * 메일 한 개의 본문까지 포함해 가져온다 (답장 초안 작성·전송용).
 * @param {string} accessToken
 * @param {string} id
 * @param {number} maxBodyChars  본문 최대 길이 (기본 4000자, 초과분은 자름)
 * @returns {Promise<{id,threadId,from,to,subject,date,body,messageId,references,replyTo}>}
 */
export async function getEmailWithBody(accessToken, id, maxBodyChars = 4000) {
  const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
    headers: authHeader(accessToken),
  });
  if (!res.ok) {
    throw new Error(`메일 본문 요청 실패 (HTTP ${res.status})`);
  }
  const msg = await res.json();
  const headers = msg.payload?.headers || [];
  let body = extractBody(msg.payload) || msg.snippet || "";
  if (body.length > maxBodyChars) {
    body = body.slice(0, maxBodyChars) + "\n…(이하 생략)";
  }

  const from = pickHeader(headers, "From");
  return {
    id: msg.id,
    threadId: msg.threadId,
    from,
    to: pickHeader(headers, "To"),
    subject: pickHeader(headers, "Subject"),
    date: pickHeader(headers, "Date"),
    body,
    messageId: pickHeader(headers, "Message-ID"),
    references: pickHeader(headers, "References"),
    replyTo: extractAddress(pickHeader(headers, "Reply-To") || from),
  };
}

/** 비ASCII 헤더 값을 RFC 2047 방식(=?UTF-8?B?...?=)으로 인코딩한다. */
function encodeHeader(value) {
  const isAscii = /^[\x00-\x7F]*$/.test(value);
  if (isAscii) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

/**
 * 답장용 RFC 2822 메시지를 만들어 Gmail 이 요구하는 base64url 로 인코딩한다.
 * From 헤더는 넣지 않는다 (Gmail 이 로그인한 사용자 주소로 자동 설정).
 */
export function buildRawReply({ to, subject, inReplyTo, references, bodyText }) {
  const headers = [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);

  // 본문을 base64 로 인코딩하고 76자마다 줄바꿈 (메일 규격)
  const encodedBody =
    Buffer.from(bodyText, "utf-8")
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") || "";

  const mime = headers.join("\r\n") + "\r\n\r\n" + encodedBody;

  return Buffer.from(mime, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Gmail 로 메일을 전송한다.
 * @param {string} accessToken
 * @param {{raw: string, threadId?: string}} params  raw = buildRawReply() 결과
 */
export async function sendMessage(accessToken, { raw, threadId }) {
  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: { ...authHeader(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
  });
  if (!res.ok) {
    throw new Error(`메일 전송 실패 (HTTP ${res.status})`);
  }
  return res.json();
}
