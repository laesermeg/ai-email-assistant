/**
 * 메일 API 작업을 수행할 수 있는 세션인지 확인한다.
 *  - OAuth(구글/MS): 유효한 accessToken 이 있고 갱신 실패 상태가 아님
 *  - IMAP: 로그인된 이메일만 있으면 됨 (자격증명은 DB에서 조회)
 */
export function mailReady(session) {
  if (!session?.user?.email) return false;
  if (session.provider === "imap") return true;
  return (
    Boolean(session.accessToken) &&
    session.error !== "RefreshAccessTokenError"
  );
}
