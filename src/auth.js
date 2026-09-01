import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * 구글에게 요청할 권한(scope) 목록 — "필요한 최소한만" 원칙.
 *  - openid / userinfo.email / userinfo.profile : 누가 로그인했는지 알기 위함
 *  - gmail.readonly : 받은 메일 읽기
 *  - gmail.send     : 답장 보내기
 */
const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * refresh token(장기 출입증)으로 새 access token(단기 출입증)을 발급받는다.
 * access token 은 보통 1시간이면 만료되므로, 만료 시 이 함수로 조용히 갱신한다.
 */
async function refreshGoogleAccessToken(token) {
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID,
        client_secret: process.env.AUTH_GOOGLE_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;

    return {
      ...token,
      accessToken: data.access_token,
      // data.expires_in 은 "몇 초 후 만료" → 절대 시각(Unix 초)으로 변환
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      // 구글이 새 refresh token 을 주면 교체, 안 주면 기존 것 유지
      refreshToken: data.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    // 갱신 실패(예: 사용자가 권한 철회) → 다시 로그인 필요 표시
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline", // refresh token 을 받기 위함
          prompt: "consent", // 매번 동의 → refresh token 확실히 수령
        },
      },
    }),
  ],

  callbacks: {
    /**
     * jwt(): 우리 앱의 세션 토큰(암호화된 쿠키)을 만들거나 갱신할 때마다 호출됨.
     *  1) 최초 로그인: account 에 구글 토큰이 담겨 옴 → 쿠키에 저장
     *  2) 이후: access token 이 아직 유효하면 그대로, 만료됐으면 자동 갱신
     */
    async jwt({ token, account }) {
      // 1) 최초 로그인
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at; // Unix 초
        return token;
      }

      // 2) 아직 만료 1분 이상 남았으면 그대로 사용
      if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 60_000) {
        return token;
      }

      // 3) 만료됨 → 갱신 시도 (refresh token 이 있을 때만)
      if (!token.refreshToken) return token;
      return refreshGoogleAccessToken(token);
    },

    /**
     * session(): auth() 나 세션 조회 시 반환되는 객체를 만들 때 호출됨.
     * 서버(라우트 핸들러)에서 Gmail 을 호출하려면 accessToken 이 필요하므로 넘긴다.
     * (MVP 단계 한정. DB 도입 후에는 토큰을 서버에만 보관하도록 변경 예정)
     */
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error; // "RefreshAccessTokenError" 면 재로그인 필요
      session.hasGmailAccess = Boolean(token.accessToken);
      session.hasRefreshToken = Boolean(token.refreshToken);
      return session;
    },
  },
});
