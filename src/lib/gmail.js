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
