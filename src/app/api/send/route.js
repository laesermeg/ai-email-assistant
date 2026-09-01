/**
 * POST /api/send
 * body: { emailId: string, subject: string, body: string }
 * 지정한 메일에 대한 답장을 사용자가 최종 확인한 내용 그대로 Gmail 로 전송한다.
 * 받는사람·스레드 정보는 클라이언트를 믿지 않고 서버가 원본 메일에서 다시 읽는다.
 */
import { auth } from "@/auth";
import { getEmailWithBody, buildRawReply, sendMessage } from "@/lib/gmail";

export async function POST(request) {
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

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const emailId = String(payload.emailId || "").trim();
  const body = String(payload.body || "").trim();
  const subjectOverride = String(payload.subject || "").trim();
  if (!emailId || !body) {
    return Response.json(
      { error: "보낼 내용이 비어 있어요." },
      { status: 400 }
    );
  }

  try {
    const orig = await getEmailWithBody(session.accessToken, emailId);

    const subject =
      subjectOverride ||
      (orig.subject.startsWith("Re:") ? orig.subject : `Re: ${orig.subject}`);

    const raw = buildRawReply({
      to: orig.replyTo,
      subject,
      inReplyTo: orig.messageId,
      references: [orig.references, orig.messageId].filter(Boolean).join(" "),
      bodyText: body,
    });

    await sendMessage(session.accessToken, { raw, threadId: orig.threadId });

    return Response.json({ ok: true, to: orig.replyTo });
  } catch (err) {
    console.error("[/api/send]", err.message);
    return Response.json({ error: "메일을 보내지 못했어요." }, { status: 502 });
  }
}
