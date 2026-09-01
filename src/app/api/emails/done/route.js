/**
 * POST /api/emails/done
 * body: { emailId: string, done: boolean }
 * 메일의 "확인 완료" 표시를 켜고 끈다.
 */
import { auth } from "@/auth";
import { setDone } from "@/lib/analysis-store";

export async function POST(request) {
  const session = await auth();
  const userEmail = session?.user?.email;
  if (!userEmail) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const emailId = String(body.emailId || "").trim();
  if (!emailId) {
    return Response.json({ error: "emailId 가 필요해요." }, { status: 400 });
  }

  try {
    await setDone(userEmail, emailId, body.done === true);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[/api/emails/done]", err.message);
    return Response.json({ error: "상태를 저장하지 못했어요." }, { status: 502 });
  }
}
