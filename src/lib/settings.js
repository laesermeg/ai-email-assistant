import { getDb } from "./db";

/** 사용자의 AI 분류 지침(자연어)을 읽는다. 없으면 "" */
export async function getGuideline(userEmail) {
  const db = getDb();
  const { data, error } = await db
    .from("user_settings")
    .select("classify_guideline")
    .eq("user_email", userEmail)
    .maybeSingle();
  if (error) throw new Error("지침 조회 실패: " + error.message);
  return data?.classify_guideline || "";
}

/** 사용자의 AI 분류 지침을 저장(upsert)한다. */
export async function setGuideline(userEmail, guideline) {
  const db = getDb();
  const { error } = await db.from("user_settings").upsert(
    {
      user_email: userEmail,
      classify_guideline: (guideline || "").slice(0, 2000), // 과도한 길이 방지
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_email" }
  );
  if (error) throw new Error("지침 저장 실패: " + error.message);
}
