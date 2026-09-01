import { getDb } from "./db";

/** 규칙 매칭 종류 */
export const MATCH_TYPES = ["from_domain", "from_address", "subject_contains"];

/** 화면 표시용 이름 */
export const MATCH_TYPE_LABEL = {
  from_domain: "발신자 도메인",
  from_address: "발신자 주소",
  subject_contains: "제목에 단어 포함",
};

/** 활성화된 규칙만 (메일 분류에 사용) */
export async function getRules(userEmail) {
  const db = getDb();
  const { data, error } = await db
    .from("rules")
    .select("id, match_type, pattern, category")
    .eq("user_email", userEmail)
    .eq("enabled", true)
    .order("id", { ascending: true });
  if (error) throw new Error("규칙 조회 실패: " + error.message);
  return data || [];
}

/** 전체 규칙 (관리 화면용) */
export async function getAllRules(userEmail) {
  const db = getDb();
  const { data, error } = await db
    .from("rules")
    .select("id, match_type, pattern, category, enabled, created_at")
    .eq("user_email", userEmail)
    .order("id", { ascending: true });
  if (error) throw new Error("규칙 조회 실패: " + error.message);
  return data || [];
}

export async function addRule(userEmail, { matchType, pattern, category }) {
  const db = getDb();
  const { data, error } = await db
    .from("rules")
    .insert({
      user_email: userEmail,
      match_type: matchType,
      pattern: pattern.replace(/^@/, "").trim(), // 도메인 앞의 @ 는 떼서 저장
      category,
    })
    .select("id, match_type, pattern, category, enabled, created_at")
    .single();
  if (error) throw new Error("규칙 추가 실패: " + error.message);
  return data;
}

export async function deleteRule(userEmail, id) {
  const db = getDb();
  const { error } = await db
    .from("rules")
    .delete()
    .eq("user_email", userEmail)
    .eq("id", id);
  if (error) throw new Error("규칙 삭제 실패: " + error.message);
}

/**
 * 규칙들을 메일 하나에 적용한다.
 * 첫 번째로 맞는 규칙의 결과를 반환, 없으면 null.
 * @param {Array} rules  getRules() 결과
 * @param {{from, subject}} email
 * @returns {{category, ruleId} | null}
 */
export function applyRules(rules, email) {
  const fromRaw = (email.from || "").toLowerCase();
  const subject = (email.subject || "").toLowerCase();

  const addrMatch = fromRaw.match(/<([^>]+)>/);
  const addr = (addrMatch ? addrMatch[1] : fromRaw).trim();
  const domain = addr.includes("@") ? addr.split("@")[1] : "";

  for (const r of rules) {
    const p = (r.pattern || "").toLowerCase().trim();
    if (!p) continue;

    if (
      r.match_type === "from_domain" &&
      domain &&
      (domain === p || domain.endsWith("." + p))
    ) {
      return { category: r.category, ruleId: r.id };
    }
    if (r.match_type === "from_address" && addr && addr === p) {
      return { category: r.category, ruleId: r.id };
    }
    if (r.match_type === "subject_contains" && p && subject.includes(p)) {
      return { category: r.category, ruleId: r.id };
    }
  }
  return null;
}
