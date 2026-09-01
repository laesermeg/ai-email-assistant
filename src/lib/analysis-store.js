import { getDb } from "./db";

/**
 * 저장된 분석 결과를 조회한다.
 * @param {string} userEmail
 * @param {string[]} messageIds
 * @returns {Promise<Map<string, {category, reason, summary, from, subject}>>}
 */
export async function getStoredAnalyses(userEmail, messageIds) {
  if (!messageIds || messageIds.length === 0) return new Map();

  const db = getDb();
  const { data, error } = await db
    .from("email_analysis")
    .select(
      "gmail_message_id, category, category_reason, summary, from_addr, subject, email_date, done"
    )
    .eq("user_email", userEmail)
    .in("gmail_message_id", messageIds);

  if (error) throw new Error("분석 결과 조회 실패: " + error.message);

  const map = new Map();
  for (const r of data || []) {
    map.set(r.gmail_message_id, {
      category: r.category,
      reason: r.category_reason || "",
      summary: r.summary || {},
      from: r.from_addr || "",
      subject: r.subject || "",
      emailDate: r.email_date || null,
      done: r.done === true,
    });
  }
  return map;
}

/**
 * 분석 결과를 저장(upsert)한다. 같은 (user, 메일)은 갱신된다.
 * @param {string} userEmail
 * @param {Array<{id, threadId, from, subject, emailDate, category, reason, summary}>} analyses
 */
export async function saveAnalyses(userEmail, analyses) {
  if (!analyses || analyses.length === 0) return;

  const db = getDb();
  const rows = analyses.map((a) => ({
    user_email: userEmail,
    gmail_message_id: a.id,
    gmail_thread_id: a.threadId || null,
    from_addr: a.from || "",
    subject: a.subject || "",
    email_date: a.emailDate || null,
    category: a.category,
    category_reason: a.reason || "",
    summary: a.summary || {},
  }));

  const { error } = await db
    .from("email_analysis")
    .upsert(rows, { onConflict: "user_email,gmail_message_id" });

  if (error) throw new Error("분석 결과 저장 실패: " + error.message);
}

/** 메일 하나의 "확인 완료" 상태를 바꾼다. */
export async function setDone(userEmail, messageId, done) {
  const db = getDb();
  const { error } = await db
    .from("email_analysis")
    .update({ done: !!done })
    .eq("user_email", userEmail)
    .eq("gmail_message_id", messageId);
  if (error) throw new Error("상태 저장 실패: " + error.message);
}
