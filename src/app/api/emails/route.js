/**
 * GET /api/emails
 * 최근 메일 목록에 AI 분류 + 요약을 붙여 돌려준다.
 *
 * 속도/비용 최적화:
 *  - Gmail 에서는 "최근 메일 ID 목록"만 받는다 (호출 1번).
 *  - 이미 분석해 DB에 저장된 메일 → 제목·발신자·분류·요약을 전부 DB에서 사용
 *    (Gmail 상세도, AI도 호출하지 않음).
 *  - 처음 보는 메일만 → Gmail 상세(헤더+미리보기) + AI 분석 → DB 저장.
 *
 * 저장하는 것: 발신자·제목(메타데이터) + 분류/요약(가공 데이터).
 * 저장하지 않는 것: 메일 본문·미리보기(snippet).
 */
import { auth } from "@/auth";
import { listRecentMessageIds, getMessagesMetadata } from "@/lib/gmail";
import { analyzeEmails } from "@/lib/analyze";
import { getStoredAnalyses, saveAnalyses } from "@/lib/analysis-store";

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
  const userEmail = session.user?.email;
  if (!userEmail) {
    return Response.json({ error: "사용자 정보를 읽지 못했어요." }, { status: 401 });
  }

  // 1) 최근 메일 ID 목록 (가벼운 호출 1번)
  let list;
  try {
    list = await listRecentMessageIds(session.accessToken, 10);
  } catch (err) {
    console.error("[/api/emails] gmail list", err.message);
    return Response.json({ error: "메일 목록을 가져오지 못했어요." }, { status: 502 });
  }
  const ids = list.map((l) => l.id);
  const threadById = new Map(list.map((l) => [l.id, l.threadId]));

  // 2) DB에 이미 있는 분석 결과 조회
  let stored = new Map();
  try {
    stored = await getStoredAnalyses(userEmail, ids);
  } catch (err) {
    console.error("[/api/emails] db read", err.message);
  }

  // 3) 처음 보는 메일만 Gmail 상세 + AI 분석 + 저장
  const newIds = ids.filter((id) => !stored.has(id));
  let analyzedOk = true;
  if (newIds.length > 0) {
    let newMeta;
    try {
      newMeta = await getMessagesMetadata(session.accessToken, newIds);
    } catch (err) {
      console.error("[/api/emails] gmail meta", err.message);
      return Response.json(
        { error: "메일 정보를 가져오지 못했어요." },
        { status: 502 }
      );
    }

    try {
      const fresh = await analyzeEmails(newMeta);
      const freshById = new Map(fresh.map((f) => [f.id, f]));

      const rows = newMeta.map((m) => {
        const f = freshById.get(m.id) || {};
        return {
          id: m.id,
          threadId: threadById.get(m.id),
          from: m.from,
          subject: m.subject,
          category: f.category || "기타",
          reason: f.reason || "",
          summary: f.summary || {},
        };
      });

      try {
        await saveAnalyses(userEmail, rows);
      } catch (err) {
        console.error("[/api/emails] db save", err.message);
      }

      for (const r of rows) {
        stored.set(r.id, {
          category: r.category,
          reason: r.reason,
          summary: r.summary,
          from: r.from,
          subject: r.subject,
        });
      }
    } catch (err) {
      console.error("[/api/emails] analyze", err.message);
      analyzedOk = false;
      // 분석 실패해도 제목·발신자는 보여준다
      for (const m of newMeta) {
        stored.set(m.id, {
          category: null,
          reason: "",
          summary: null,
          from: m.from,
          subject: m.subject,
        });
      }
    }
  }

  // 4) 목록 순서대로 합치기
  const emails = list.map((l) => {
    const a = stored.get(l.id) || {};
    return {
      id: l.id,
      threadId: l.threadId,
      from: a.from || "",
      subject: a.subject || "",
      snippet: "",
      category: a.category ?? null,
      categoryReason: a.reason ?? "",
      summary: a.summary ?? null,
    };
  });

  return Response.json({
    emails,
    analyzed: analyzedOk,
    newlyAnalyzed: newIds.length,
    fromCache: ids.length - newIds.length,
  });
}
