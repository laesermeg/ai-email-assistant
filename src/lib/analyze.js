import { askForJson } from "./ai";
import { mapLimit } from "./util";

/** 허용되는 분류 값 */
export const CATEGORIES = ["개인", "업무", "기타"];

/** 요약이 비었을 때 채워 넣을 기본값 */
const EMPTY_SUMMARY = {
  who: "",
  what: "",
  deadline: "",
  replyNeeded: false,
};

const SYSTEM_PROMPT = `당신은 대학 교수의 이메일을 정리하는 비서입니다.
각 메일에 대해 (1) 분류와 (2) 요약을 하세요.

[분류] 아래 중 하나로:
- "개인": 가족·친구·지인 등 사적인 연락. 업무와 무관한 개인 용무.
- "업무": 소속 기관(학교)의 학생 지도, 행정처·교직원 업무, 동료 교수와의 협업 등
  "우리 조직 안에서 처리해야 하는 일".
- "기타": 학회·저널의 심사위원 위촉·논문 심사 요청, 학회 초청, 강연 요청,
  뉴스레터, 광고, 자동발송 알림, 외부 기관의 협업 제안 등.
  → 이런 메일은 답장이 필요하더라도 반드시 "기타"로 분류하세요.

애매하면 "업무"가 아니라 "기타"로 두세요. "업무"는 소속 기관 내부 일에만 씁니다.

[요약] 아래 항목을 채우세요:
- who: 보낸 사람이 누구인지 짧게 (예: "지도학생 김민수", "학과 조교", "김철수 교수")
- what: 메일의 핵심 용건 한 문장. 교수가 해야 할 일이 있으면 이 문장에 포함하세요.
- deadline: 마감·기한·중요 날짜 (예: "3월 15일", 없으면 "")
- replyNeeded: 답장이 필요하면 true, 아니면 false

정보가 부족하면 추측하지 말고 빈 문자열이나 false 로 두세요.
반드시 아래 JSON 형식으로만 답하세요. 다른 문장을 붙이지 마세요.

{"results":[{"id":"<메일 id>","category":"개인","reason":"<한 문장 이유>","summary":{"who":"","what":"","deadline":"","replyNeeded":false}}]}`;

/** 한 번의 AI 호출로 처리할 메일 수 (너무 많으면 응답 JSON이 깨지기 쉬움) */
const CHUNK_SIZE = 6;

/** 사용자 지침이 있으면 시스템 프롬프트 뒤에 덧붙인다. */
function buildSystem(guideline) {
  const g = (guideline || "").trim();
  if (!g) return SYSTEM_PROMPT;
  return (
    SYSTEM_PROMPT +
    `\n\n[사용자 지침 — 분류 시 아래를 우선 반영하세요]\n${g}`
  );
}

/**
 * 메일 묶음 하나를 분류 + 요약한다. JSON 파싱 실패 시 1회 재시도.
 * @param {Array<{id,from,subject,snippet}>} emails
 * @param {string} guideline
 * @returns {Promise<Array<{id, category, reason, summary}>>}
 */
async function analyzeChunk(emails, guideline) {
  const list = emails
    .map(
      (m, i) =>
        `${i + 1}. id=${m.id}\n` +
        `   보낸사람: ${m.from}\n` +
        `   제목: ${m.subject}\n` +
        `   미리보기: ${m.snippet}`
    )
    .join("\n\n");

  const params = {
    system: buildSystem(guideline),
    user: `다음 ${emails.length}개의 메일을 분류하고 요약하세요.\n\n${list}`,
    maxTokens: 4096,
  };

  let data;
  try {
    data = await askForJson(params);
  } catch {
    // 모델이 가끔 깨진 JSON을 뱉음 → 한 번만 다시 시도
    data = await askForJson(params);
  }

  const byId = new Map((data.results || []).map((r) => [String(r.id), r]));

  return emails.map((m) => {
    const r = byId.get(String(m.id));
    const category = CATEGORIES.includes(r?.category) ? r.category : "기타";
    const s = r?.summary || {};
    return {
      id: m.id,
      category,
      reason: r?.reason || "",
      summary: {
        who: s.who || "",
        what: s.what || "",
        deadline: s.deadline || "",
        replyNeeded: s.replyNeeded === true,
      },
    };
  });
}

/** 동시에 진행할 AI 호출 수 (무료 티어 분당 한도 대비 여유) */
const CONCURRENCY = 3;

/**
 * 메일 목록을 분류 + 요약한다.
 * CHUNK_SIZE 개씩 나눠, 동시 CONCURRENCY 개까지 병렬로 처리한다.
 * AI에는 발신자 / 제목 / 한 줄 미리보기만 보낸다 (본문·원문은 보내지 않음).
 *
 * @param {Array<{id,from,subject,snippet}>} emails
 * @param {string} [guideline]  사용자 자연어 분류 지침 (선택)
 * @returns {Promise<Array<{id, category, reason, summary}>>} 원본과 같은 순서
 */
export async function analyzeEmails(emails, guideline = "") {
  if (!emails || emails.length === 0) return [];

  const chunks = [];
  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    chunks.push(emails.slice(i, i + CHUNK_SIZE));
  }

  const results = await mapLimit(chunks, CONCURRENCY, (c) =>
    analyzeChunk(c, guideline)
  );
  return results.flat();
}
