/**
 * GET /api/email-body?id=<메일 id>
 * 메일 한 개의 본문(평문)을 돌려준다. 저장하지 않고 그때그때 가져온다.
 */
import { auth } from "@/auth";
import * as mail from "@/lib/mail";

export const maxDuration = 60;

export async function GET(request) {
  const session = await auth();
  if (!session?.accessToken) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.error === "RefreshAccessTokenError") {
    return Response.json(
      { error: "메일 연결이 만료됐어요. 다시 로그인해 주세요." },
      { status: 401 }
    );
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id 가 필요해요." }, { status: 400 });
  }

  try {
    const email = await mail.getEmailWithBody(session, id);
    return Response.json({
      from: email.from,
      subject: email.subject,
      date: email.date,
      body: email.body,
    });
  } catch (err) {
    console.error("[/api/email-body]", err.message);
    return Response.json({ error: "본문을 가져오지 못했어요." }, { status: 502 });
  }
}
