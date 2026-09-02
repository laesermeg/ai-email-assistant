/**
 * POST /api/draft
 * body: { emailId: string, instruction: string }
 * 지정한 메일의 본문 + 사용자 지시로 답장 초안을 만들어 돌려준다.
 * 아직 아무것도 보내지 않는다 (초안만 생성).
 */
import { auth } from "@/auth";
import * as mail from "@/lib/mail";
import { draftReply } from "@/lib/draft";

export const maxDuration = 60;

export async function POST(request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.error === "RefreshAccessTokenError" || !session.accessToken) {
    return Response.json(
      { error: "메일 연결이 만료됐어요. 다시 로그인해 주세요." },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const emailId = String(body.emailId || "").trim();
  const instruction = String(body.instruction || "").trim();
  if (!emailId || !instruction) {
    return Response.json(
      { error: "메일과 지시 내용을 모두 입력해 주세요." },
      { status: 400 }
    );
  }

  try {
    const email = await mail.getEmailWithBody(session, emailId);
    const draft = await draftReply(email, instruction);
    return Response.json({
      draft,
      subject: email.subject.startsWith("Re:")
        ? email.subject
        : `Re: ${email.subject}`,
    });
  } catch (err) {
    console.error("[/api/draft]", err.message);
    return Response.json(
      { error: "초안을 만들지 못했어요." },
      { status: 502 }
    );
  }
}
