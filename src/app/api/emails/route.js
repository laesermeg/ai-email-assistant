/**
 * GET /api/emails
 * 최근 메일 목록에 AI 분류 + 요약을 붙여 돌려준다.
 *
 * 속도/비용 최적화:
 *  - Gmail 에서는 "최근 메일 ID 목록"만 받는다 (호출 1번).
 *  - 이미 분석해 DB에 저장된 메일 → 제목·발신자·분류·요약을 전부 DB에서 사용
 *    (Gmail 상세도, AI도 호출하지 않음).
 *  - 처음 보는 메일만 → Gmail 상세(헤더+미리보기) + 규칙 → AI 분석 → DB 저장.
 *
 * 저장하는 것: 발신자·제목·받은날짜(메타데이터) + 분류/요약(가공 데이터).
 * 저장하지 않는 것: 메일 본문·미리보기(snippet).
 */
import { auth } from "@/auth";
import * as mail from "@/lib/mail";
import { analyzeEmails } from "@/lib/analyze";
import { getStoredAnalyses, saveAnalyses } from "@/lib/analysis-store";
import { getRules, applyRules } from "@/lib/rules";
import { getGuideline } from "@/lib/settings";

// 메일이 많으면 처리가 오래 걸릴 수 있으므로 함수 실행 시간을 넉넉히 (Vercel 최대 60초)
export const maxDuration = 60;

/** 표시할 최근 메일 개수 (기본값과 허용 범위) */
const DEFAULT_COUNT = 30;
const MIN_COUNT = 10;
const MAX_COUNT = 200;

/** 메일 Date 헤더 문자열 → ISO 문자열 (파싱 실패 시 null) */
function toIso(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export async function GET(request) {
  const session = await auth();
  const params = new URL(request.url).searchParams;
  // ?refresh=1 → 저장된 결과를 무시하고 최근 메일을 규칙+AI로 다시 분석
  const refresh = params.get("refresh") === "1";
  // ?count=N → 표시/분석할 최근 메일 개수 (범위 밖이면 기본값)
  const count = Math.min(
    MAX_COUNT,
    Math.max(MIN_COUNT, Number(params.get("count")) || DEFAULT_COUNT)
  );

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
    list = await mail.listRecentMessageIds(session, count);
  } catch (err) {
    console.error("[/api/emails] gmail list", err.message);
    return Response.json(
      {
        error:
          "메일 목록을 가져오지 못했어요. 위에서 개수를 줄여 다시 시도해 보세요.",
      },
      { status: 502 }
    );
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

  // 3) 처음 보는 메일만 (refresh 면 전체) Gmail 상세 + 규칙/AI 분석 + 저장
  const newIds = refresh ? ids : ids.filter((id) => !stored.has(id));
  let analyzedOk = true;
  if (newIds.length > 0) {
    let newMeta;
    try {
      newMeta = await mail.getMessagesMetadata(session, newIds);
    } catch (err) {
      console.error("[/api/emails] gmail meta", err.message);
      return Response.json(
        {
          error:
            "메일 정보를 가져오지 못했어요. 위에서 개수를 줄여 다시 시도해 보세요.",
        },
        { status: 502 }
      );
    }

    // 3-a) 규칙(도메인/주소/제목 단어) 먼저 적용 → 맞으면 AI 스킵
    let rules = [];
    try {
      rules = await getRules(userEmail);
    } catch (err) {
      console.error("[/api/emails] rules", err.message);
    }

    const ruleRows = [];
    const needAi = [];
    for (const m of newMeta) {
      const hit = rules.length ? applyRules(rules, m) : null;
      if (hit) {
        ruleRows.push({
          id: m.id,
          threadId: threadById.get(m.id),
          from: m.from,
          subject: m.subject,
          emailDate: toIso(m.date),
          category: hit.category,
          reason: "규칙으로 자동 분류",
          summary: {}, // 규칙 분류는 요약하지 않음
        });
      } else {
        needAi.push(m);
      }
    }

    // 사용자 자연어 지침 (분류 프롬프트에 주입)
    let guideline = "";
    try {
      guideline = await getGuideline(userEmail);
    } catch (err) {
      console.error("[/api/emails] guideline", err.message);
    }

    try {
      // 3-b) 규칙에 안 걸린 것만 AI
      const fresh = needAi.length
        ? await analyzeEmails(needAi, guideline)
        : [];
      const freshById = new Map(fresh.map((f) => [f.id, f]));

      const aiRows = needAi.map((m) => {
        const f = freshById.get(m.id) || {};
        return {
          id: m.id,
          threadId: threadById.get(m.id),
          from: m.from,
          subject: m.subject,
          emailDate: toIso(m.date),
          category: f.category || "기타",
          reason: f.reason || "",
          summary: f.summary || {},
        };
      });

      const rows = [...ruleRows, ...aiRows];

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
          emailDate: r.emailDate,
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
          emailDate: toIso(m.date),
        });
      }
    }
  }

  // 4) 합치기 + 받은 날짜 최신순 정렬
  const emails = list
    .map((l) => {
      const a = stored.get(l.id) || {};
      return {
        id: l.id,
        threadId: l.threadId,
        from: a.from || "",
        subject: a.subject || "",
        snippet: "",
        date: a.emailDate || null,
        category: a.category ?? null,
        categoryReason: a.reason ?? "",
        summary: a.summary ?? null,
        done: a.done === true,
      };
    })
    .sort((x, y) => {
      const tx = x.date ? Date.parse(x.date) : 0;
      const ty = y.date ? Date.parse(y.date) : 0;
      return ty - tx;
    });

  return Response.json({
    emails,
    provider: session.provider,
    analyzed: analyzedOk,
    newlyAnalyzed: newIds.length,
    fromCache: ids.length - newIds.length,
  });
}
