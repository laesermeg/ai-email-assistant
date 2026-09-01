/**
 * GET /api/emails
 * 로그인한 사용자의 받은편지함에서 최근 메일 요약 목록을 돌려준다.
 * 메일은 저장하지 않고, 요청 시점에 Gmail 에서 가져와 그대로 전달만 한다.
 */
import { auth } from "@/auth";
import { getRecentEmails } from "@/lib/gmail";

export async function GET() {
  const session = await auth();

  if (!session) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.error === "RefreshAccessTokenError" || !session.accessToken) {
    return Response.json(
      { error: "Gmail 연결이 만료됐어요. 다시 로그인해 주세요." },
      { status: 401 }
    );
  }

  try {
    const emails = await getRecentEmails(session.accessToken, 10);
    return Response.json({ emails });
  } catch (err) {
    // 로그에는 메일 내용·토큰이 남지 않도록 짧은 메시지만 기록
    console.error("[/api/emails]", err.message);
    return Response.json(
      { error: "메일을 가져오지 못했어요." },
      { status: 502 }
    );
  }
}
