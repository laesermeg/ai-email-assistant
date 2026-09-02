/**
 * Microsoft Graph API 로 Outlook 메일을 읽고 보낸다 (서버에서만 사용).
 * gmail.js 와 같은 함수 이름·시그니처를 제공해서 mail.js 디스패처가 바꿔 쓸 수 있게 한다.
 *
 * Graph 문서: https://learn.microsoft.com/graph/api/resources/message
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

function authHeaders(accessToken, extra = {}) {
  return { Authorization: `Bearer ${accessToken}`, ...extra };
}

/** Graph 의 from 객체({emailAddress:{name,address}})를 "이름 <주소>" 문자열로 */
function formatFrom(fromObj) {
  const ea = fromObj?.emailAddress || {};
  if (ea.name && ea.address) return `${ea.name} <${ea.address}>`;
  return ea.address || ea.name || "";
}

/** 받은편지함에서 최근 메일의 id·대화(스레드)id 목록 */
export async function listRecentMessageIds(accessToken, max = 30) {
  const url =
    `${GRAPH}/me/mailFolders/inbox/messages` +
    `?$top=${max}&$select=id,conversationId&$orderby=receivedDateTime desc`;
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    throw new Error(`메일 목록 요청 실패 (HTTP ${res.status})`);
  }
  const data = await res.json();
  return (data.value || []).map((m) => ({
    id: m.id,
    threadId: m.conversationId,
  }));
}

/** 주어진 메일 id 들의 헤더 + 미리보기 */
export async function getMessagesMetadata(accessToken, ids) {
  if (!ids || ids.length === 0) return [];
  return Promise.all(
    ids.map(async (id) => {
      const url =
        `${GRAPH}/me/messages/${encodeURIComponent(id)}` +
        `?$select=id,conversationId,from,subject,receivedDateTime,bodyPreview`;
      const res = await fetch(url, { headers: authHeaders(accessToken) });
      if (!res.ok) {
        throw new Error(`메일 상세 요청 실패 (HTTP ${res.status})`);
      }
      const m = await res.json();
      return {
        id: m.id,
        threadId: m.conversationId,
        from: formatFrom(m.from),
        subject: m.subject || "",
        date: m.receivedDateTime || "",
        snippet: m.bodyPreview || "",
      };
    })
  );
}

/** 메일 한 개를 본문까지 (답장 작성·전송용) */
export async function getEmailWithBody(accessToken, id, maxBodyChars = 4000) {
  const url =
    `${GRAPH}/me/messages/${encodeURIComponent(id)}` +
    `?$select=id,conversationId,from,toRecipients,subject,receivedDateTime,internetMessageId,body`;
  const res = await fetch(url, {
    // 본문을 HTML 대신 평문으로 받기
    headers: authHeaders(accessToken, {
      Prefer: 'outlook.body-content-type="text"',
    }),
  });
  if (!res.ok) {
    throw new Error(`메일 본문 요청 실패 (HTTP ${res.status})`);
  }
  const m = await res.json();
  let body = m.body?.content || m.bodyPreview || "";
  if (body.length > maxBodyChars) {
    body = body.slice(0, maxBodyChars) + "\n…(이하 생략)";
  }
  return {
    id: m.id,
    threadId: m.conversationId,
    from: formatFrom(m.from),
    replyTo: m.from?.emailAddress?.address || "",
    to: (m.toRecipients || []).map((r) => r.emailAddress?.address).join(", "),
    subject: m.subject || "",
    date: m.receivedDateTime || "",
    messageId: m.internetMessageId || "",
    body,
  };
}

/**
 * 답장 전송. Graph 의 createReply(초안 생성) → 본문 교체 → 전송 순서.
 * @param {string} accessToken
 * @param {{orig, subject, bodyText}} args  orig = getEmailWithBody() 결과
 */
export async function sendReply(accessToken, { orig, subject, bodyText }) {
  // 1) 답장 초안 생성 (제목·수신자·스레드 자동 설정)
  const createRes = await fetch(
    `${GRAPH}/me/messages/${encodeURIComponent(orig.id)}/createReply`,
    { method: "POST", headers: authHeaders(accessToken) }
  );
  if (!createRes.ok) {
    throw new Error(`답장 초안 생성 실패 (HTTP ${createRes.status})`);
  }
  const draft = await createRes.json();

  // 2) 초안의 제목·본문을 우리가 만든 것으로 교체 (인용문 제거)
  const patchRes = await fetch(
    `${GRAPH}/me/messages/${encodeURIComponent(draft.id)}`,
    {
      method: "PATCH",
      headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        subject: subject || draft.subject,
        body: { contentType: "Text", content: bodyText },
      }),
    }
  );
  if (!patchRes.ok) {
    throw new Error(`답장 내용 수정 실패 (HTTP ${patchRes.status})`);
  }

  // 3) 전송
  const sendRes = await fetch(
    `${GRAPH}/me/messages/${encodeURIComponent(draft.id)}/send`,
    { method: "POST", headers: authHeaders(accessToken) }
  );
  if (!sendRes.ok) {
    throw new Error(`메일 전송 실패 (HTTP ${sendRes.status})`);
  }
  return { ok: true };
}
