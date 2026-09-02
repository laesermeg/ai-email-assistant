import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/**
 * 구글에게 요청할 권한(scope) — "필요한 최소한만" 원칙.
 *  - openid / userinfo.email / userinfo.profile : 누가 로그인했는지
 *  - gmail.readonly : 받은 메일 읽기 / gmail.send : 답장 보내기
 */
const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

/** Microsoft(Graph)에게 요청할 권한 — Mail.Read(읽기), Mail.Send(보내기), offline_access(갱신용) */
const MS_SCOPES =
  "openid profile email offline_access User.Read Mail.Read Mail.Send";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MS_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

/** 구글 refresh token 으로 access token 갱신 */
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
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      refreshToken: data.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

/** Microsoft refresh token 으로 access token 갱신 */
async function refreshMicrosoftAccessToken(token) {
  try {
    const res = await fetch(MS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
        client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
        scope: MS_SCOPES,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      refreshToken: data.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

/** 프로필 사진(base64)까지 JWT에 넣으면 쿠키가 커지므로 최소 정보만 남긴다. */
function minimalMsProfile(profile) {
  return {
    id: profile.sub,
    name: profile.name,
    email: profile.email ?? profile.preferred_username,
    image: null,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      // issuer 미지정 → common (개인·회사·학교 계정 모두 허용)
      authorization: { params: { scope: MS_SCOPES } },
      profile: minimalMsProfile,
    }),
  ],

  callbacks: {
    /**
     * jwt(): 세션 토큰(암호화 쿠키)을 만들거나 갱신할 때마다 호출.
     *  1) 최초 로그인: account 에 공급자 토큰이 담겨 옴 → 쿠키에 저장 (공급자 이름도)
     *  2) 이후: access token 유효하면 그대로, 만료면 공급자별로 자동 갱신
     */
    async jwt({ token, account }) {
      if (account) {
        token.provider = account.provider; // "google" | "microsoft-entra-id"
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }

      if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 60_000) {
        return token;
      }
      if (!token.refreshToken) return token;

      return token.provider === "microsoft-entra-id"
        ? refreshMicrosoftAccessToken(token)
        : refreshGoogleAccessToken(token);
    },

    /**
     * session(): 서버 코드에서 메일 API 를 호출하려면 accessToken + provider 가 필요.
     * (MVP 한정으로 클라이언트까지 전달됨. 추후 서버 전용으로 옮길 예정)
     */
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      session.provider = token.provider || "google";
      return session;
    },
  },
});
