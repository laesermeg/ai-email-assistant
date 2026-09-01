import { auth, signIn, signOut } from "@/auth";
import Dashboard from "./dashboard";

/**
 * 첫 화면 (미니멀 흑백 스타일).
 * 서버 컴포넌트: auth() 로 로그인 상태를 서버에서 바로 읽는다.
 * 로그인/로그아웃은 서버 액션(form action)으로 처리 → 클라이언트 코드 불필요.
 */
export default async function Home() {
  const session = await auth();
  const user = session?.user;
  const needsReLogin = user && session.error === "RefreshAccessTokenError";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* 상단 바 */}
      <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">
          AI 이메일 비서
        </span>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden truncate text-muted sm:inline">
              {user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="text-muted underline underline-offset-4 transition-colors hover:text-foreground"
              >
                로그아웃
              </button>
            </form>
          </div>
        ) : null}
      </header>

      {/* 본문 */}
      <main
        className={
          user
            ? "flex flex-1 justify-center px-6 py-10"
            : "flex flex-1 items-center px-6 py-16"
        }
      >
        <div className={user ? "w-full max-w-xl" : "mx-auto w-full max-w-sm"}>
          {user ? (
            needsReLogin ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted">
                  Gmail 연결이 만료됐어요. 다시 로그인해 주세요.
                </p>
                <form
                  action={async () => {
                    "use server";
                    await signIn("google");
                  }}
                >
                  <button
                    type="submit"
                    className="border border-foreground bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
                  >
                    다시 로그인
                  </button>
                </form>
              </div>
            ) : (
              <Dashboard />
            )
          ) : (
            <div className="flex flex-col gap-8">
              <div>
                <h1 className="text-2xl font-semibold leading-snug tracking-tight">
                  받은 메일을
                  <br />
                  대신 정리해 드릴게요
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  교수·연구자를 위한 이메일 비서. 개인 메일과 학교 업무 메일을
                  가려내고, 요약하고, 답장 초안까지 만들어 드립니다.
                </p>
              </div>

              <form
                action={async () => {
                  "use server";
                  await signIn("google");
                }}
              >
                <button
                  type="submit"
                  className="w-full border border-foreground bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
                >
                  구글로 로그인
                </button>
              </form>

              <p className="text-xs leading-relaxed text-muted">
                로그인 시 Gmail 읽기·보내기 권한을 요청합니다. 메일 원문은
                저장하지 않으며, 필요한 최소한의 정보만 사용합니다.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* 하단 */}
      <footer className="border-t border-border px-6 py-4 text-xs text-muted">
        MVP · 로컬 개발 버전
      </footer>
    </div>
  );
}
