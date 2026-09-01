import { askForText } from "./ai";

const SYSTEM_PROMPT = `당신은 대학 교수의 이메일 답장 초안을 작성하는 비서입니다.
아래 [받은 메일]에 대한 답장을, 교수가 준 [지시]에 맞춰 한국어로 작성하세요.

규칙:
- 정중한 존댓말. 한국 이메일 관례대로 (간단한 인사 → 본문 → 맺음말).
- 교수 본인이 보내는 것처럼 1인칭으로 씁니다.
- 지시가 짧아도 받은 메일 맥락에 맞게 자연스럽게 풀어 씁니다.
- 지시에 없는 사실(구체적 날짜·장소·금액 등)은 지어내지 말고,
  꼭 필요하면 [ ] 로 빈칸을 남겨 교수가 채우게 하세요.
- 서명(이름·소속)은 넣지 마세요. 교수가 직접 추가합니다.
- 답장 본문 텍스트만 출력하세요. 제목이나 설명은 붙이지 마세요.`;

/**
 * 받은 메일 + 사용자 지시로 답장 초안을 만든다.
 * @param {{from,subject,body}} email  받은 메일 (본문 포함)
 * @param {string} instruction         사용자가 입력한 대략적인 용건/지시
 * @returns {Promise<string>} 답장 본문 초안
 */
export async function draftReply(email, instruction) {
  const user =
    `[받은 메일]\n` +
    `보낸사람: ${email.from}\n` +
    `제목: ${email.subject}\n` +
    `내용:\n${email.body}\n\n` +
    `[지시]\n${instruction}`;

  return askForText({
    system: SYSTEM_PROMPT,
    user,
    maxTokens: 1200,
  });
}
