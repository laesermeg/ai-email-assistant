import { createClient } from "@supabase/supabase-js";

/**
 * Supabase(데이터베이스) 연결 도우미. **서버에서만** 사용한다.
 * secret 키를 쓰므로 RLS(행 수준 보안)를 우회하는 관리자 권한이다 →
 * 절대 클라이언트(브라우저) 코드에서 import 하지 말 것.
 */

let cached;

export function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SECRET_KEY 가 설정되지 않았습니다 (.env.local 확인)."
    );
  }
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
