/**
 * /api/guideline
 *  GET → { guideline }
 *  PUT → 저장  { guideline }
 * AI 분류 시 프롬프트에 주입되는 자연어 지침.
 */
import { auth } from "@/auth";
import { getGuideline, setGuideline } from "@/lib/settings";

async function requireUserEmail() {
  const session = await auth();
  return session?.user?.email || null;
}

export async function GET() {
  const userEmail = await requireUserEmail();
  if (!userEmail) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    return Response.json({ guideline: await getGuideline(userEmail) });
  } catch (err) {
    console.error("[/api/guideline GET]", err.message);
    return Response.json({ error: "지침을 불러오지 못했어요." }, { status: 502 });
  }
}

export async function PUT(request) {
  const userEmail = await requireUserEmail();
  if (!userEmail) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  try {
    await setGuideline(userEmail, String(body.guideline || ""));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[/api/guideline PUT]", err.message);
    return Response.json({ error: "지침을 저장하지 못했어요." }, { status: 502 });
  }
}
