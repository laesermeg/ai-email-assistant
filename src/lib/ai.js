import OpenAI from "openai";

/**
 * AI 공급자 래퍼.
 * 어떤 AI를 쓸지는 .env.local 의 값으로만 결정된다 → 공급자 교체 시 이 파일은 안 건드려도 됨.
 *
 *   AI_API_KEY   : 발급받은 키
 *   AI_BASE_URL  : OpenAI 호환 엔드포인트 주소
 *   AI_MODEL     : 모델 이름 (예: gemini-2.0-flash, qwen-flash)
 *
 * Gemini, Qwen, 로컬(Ollama) 모두 "OpenAI 호환" 방식을 지원하므로 openai 패키지 하나로 처리한다.
 */

let cachedClient;

function getClient() {
  if (!process.env.AI_API_KEY) {
    throw new Error("AI_API_KEY 가 설정되지 않았습니다 (.env.local 확인).");
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL || undefined,
      timeout: 30_000, // 30초 넘게 안 걸리도록 (느린 응답은 실패 처리)
      maxRetries: 1,
    });
  }
  return cachedClient;
}

/**
 * AI에게 JSON 형태의 답을 요청한다.
 * @param {{system: string, user: string, maxTokens?: number}} params
 * @returns {Promise<any>} 파싱된 JSON 객체
 */
export async function askForJson({ system, user, maxTokens = 1024 }) {
  const client = getClient();
  const model = process.env.AI_MODEL || "gemini-flash-lite-latest";

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: maxTokens,
  });

  const raw = res.choices?.[0]?.message?.content ?? "";
  return parseJsonLoose(raw);
}

/**
 * AI에게 일반 텍스트 답을 요청한다 (답장 초안 등).
 * @param {{system: string, user: string, maxTokens?: number}} params
 * @returns {Promise<string>}
 */
export async function askForText({ system, user, maxTokens = 1024 }) {
  const client = getClient();
  const model = process.env.AI_MODEL || "gemini-flash-lite-latest";

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.4,
    max_tokens: maxTokens,
  });

  return (res.choices?.[0]?.message?.content ?? "").trim();
}

/** 앞뒤에 ```json 같은 장식이 붙어 있어도 JSON 부분만 뽑아 파싱한다. */
function parseJsonLoose(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("AI 응답을 JSON 으로 해석하지 못했습니다.");
  }
}
