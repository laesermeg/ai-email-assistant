/**
 * GET /api/emails
 * 로그인한 사용자의 받은편지함에서 최근 메일을 가져와, AI 분류 + 요약을 붙여 돌려준다.
 * 메일 원문은 저장하지 않는다 (요청 시점에 Gmail 에서 가져와 그대로 전달).
 */
import { auth } from "@/auth";
import { getRecentEmails } from "@/lib/gmail";
import { analyzeEmails } from "@/lib/analyze";

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

  // 1) 메일 가져오기 (실패하면 여기서 끝)
  let emails;
  try {
    emails = await getRecentEmails(session.accessToken, 10);
  } catch (err) {
    console.error("[/api/emails] gmail", err.message);
    return Response.json(
      { error: "메일을 가져오지 못했어요." },
      { status: 502 }
    );
  }

  // 2) AI 분류 + 요약 (실패해도 메일 목록은 그대로 보여준다)
  let analysis = null;
  try {
    analysis = await analyzeEmails(emails);
  } catch (err) {
    console.error("[/api/emails] analyze", err.message);
  }

  const byId = new Map((analysis || []).map((a) => [a.id, a]));
  const enriched = emails.map((m) => {
    const a = byId.get(m.id);
    return {
      ...m,
      category: a?.category ?? null,
      categoryReason: a?.reason ?? "",
      summary: a?.summary ?? null,
    };
  });

  return Response.json({
    emails: enriched,
    analyzed: Boolean(analysis),
  });
}
