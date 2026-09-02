"use client";

import { useState } from "react";

/** 요약에 내용이 하나라도 있는지 */
function hasSummary(s) {
  return s && (s.who || s.what || s.deadline || s.replyNeeded);
}

/** 받은 날짜를 짧게 (오늘/어제/M.D). */
function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const days = Math.floor((now - d) / 86400000);
  if (days <= 0 && now.getDate() === d.getDate()) return "오늘";
  if (days <= 1) return "어제";
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

/** 요약 한 줄 (라벨 + 값) */
function Row({ label, children }) {
  return (
    <div className="flex gap-2 py-0.5">
      <dt className="w-9 shrink-0 text-muted">{label}</dt>
      <dd className="flex-1">{children}</dd>
    </div>
  );
}

/**
 * 메일 한 개 = 제목 + 요약 + 답장 초안/전송 영역.
 *
 * 흐름:
 *  1) 용건 입력 → "초안 생성" → 서버(/api/draft)가 초안 작성
 *  2) 받는사람·제목·본문을 미리보기 (본문·제목은 수정 가능)
 *  3) "보내기" → 확인창 승인 → 서버(/api/send)가 Gmail 로 전송
 */
export default function EmailItem({
  email,
  userEmail,
  provider = "google",
  onToggleDone,
}) {
  const m = email;
  const s = m.summary;
  const isOther = m.category === "기타";
  const done = m.done === true;

  // 원본 메일을 웹메일에서 여는 링크 (공급자별)
  const mailUrl =
    provider === "microsoft-entra-id"
      ? `https://outlook.office.com/mail/deeplink/read/${encodeURIComponent(
          m.id
        )}`
      : `https://mail.google.com/mail/` +
        (userEmail ? `?authuser=${encodeURIComponent(userEmail)}` : `u/0/`) +
        `#all/${m.threadId || m.id}`;

  // 제목 클릭 = 본문 펼쳐 보기
  const [expanded, setExpanded] = useState(false);
  const [fullBody, setFullBody] = useState(null);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [bodyError, setBodyError] = useState("");

  async function loadBody() {
    if (fullBody || bodyLoading) return;
    setBodyLoading(true);
    setBodyError("");
    try {
      const res = await fetch(`/api/email-body?id=${encodeURIComponent(m.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "본문을 불러오지 못했어요.");
      setFullBody(data.body || "(본문 없음)");
    } catch (e) {
      setBodyError(e.message);
    } finally {
      setBodyLoading(false);
    }
  }

  function toggleExpand() {
    setExpanded((v) => {
      const next = !v;
      if (next) loadBody();
      return next;
    });
  }

  const [togglingDone, setTogglingDone] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [subject, setSubject] = useState("");
  const [draft, setDraft] = useState(null); // 생성된 초안 (수정 가능)
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  async function generate() {
    if (!instruction.trim()) return;
    setDrafting(true);
    setDraftError("");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: m.id, instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "초안 생성에 실패했어요.");
      setDraft(data.draft);
      setSubject(data.subject || `Re: ${m.subject}`);
      setSent(false);
      setSendError("");
    } catch (e) {
      setDraftError(e.message);
    } finally {
      setDrafting(false);
    }
  }

  async function toggleDone() {
    const next = !done;
    setTogglingDone(true);
    try {
      const res = await fetch("/api/emails/done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: m.id, done: next }),
      });
      if (!res.ok) throw new Error();
      onToggleDone?.(m.id, next);
    } catch {
      /* 실패 시 상태 유지 */
    } finally {
      setTogglingDone(false);
    }
  }

  async function send() {
    if (!draft.trim()) return;
    const ok = window.confirm(
      `${m.from}\n에게 아래 제목으로 답장을 보냅니다.\n\n제목: ${subject}\n\n보낼까요?`
    );
    if (!ok) return;

    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: m.id, subject, body: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "전송에 실패했어요.");
      setSent(true);
    } catch (e) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <li className={(isOther || done ? "opacity-45 " : "") + "py-4"}>
      {/* 제목 줄 */}
      <div className="flex items-baseline gap-2">
        <input
          type="checkbox"
          checked={done}
          onChange={toggleDone}
          disabled={togglingDone}
          title={done ? "확인 완료됨 (클릭하면 해제)" : "확인 완료로 표시"}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-black disabled:opacity-40 dark:accent-white"
        />
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted">
          {m.category || "미분류"}
        </span>
        <button
          type="button"
          onClick={toggleExpand}
          title="클릭하면 메일 내용을 펼칩니다"
          className={
            "truncate text-left text-sm font-medium underline-offset-2 hover:underline " +
            (done ? "line-through" : "")
          }
        >
          {m.subject || "(제목 없음)"}
        </button>
        {s?.replyNeeded && !done ? (
          <span className="shrink-0 border border-foreground px-1.5 py-0.5 text-[10px] font-semibold">
            답장 필요
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
        <span className="truncate">{m.from}</span>
        {shortDate(m.date) ? (
          <span className="shrink-0">· {shortDate(m.date)}</span>
        ) : null}
      </p>

      {/* 요약 (누가/용건/날짜). 용건 옆에 "펼치기" */}
      {!isOther && hasSummary(s) ? (
        <dl className="mt-2 border-l border-border pl-3 text-xs">
          {s.who ? <Row label="누가">{s.who}</Row> : null}
          {s.what ? (
            <div className="flex gap-2 py-0.5">
              <dt className="w-9 shrink-0 text-muted">용건</dt>
              <dd className="flex-1">
                {s.what}
                <button
                  type="button"
                  onClick={toggleExpand}
                  className="ml-2 text-muted underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  {expanded ? "접기" : "펼치기"}
                </button>
              </dd>
            </div>
          ) : null}
          {s.deadline ? <Row label="날짜">{s.deadline}</Row> : null}
        </dl>
      ) : m.categoryReason || m.snippet ? (
        <p className="mt-1 line-clamp-2 text-xs text-muted">
          {m.categoryReason || m.snippet}
        </p>
      ) : null}

      {/* 요약(용건)이 없을 때만 펼치기/접기를 별도 줄로 */}
      {!(!isOther && s?.what) ? (
        <button
          type="button"
          onClick={toggleExpand}
          className="mt-1.5 block text-xs text-muted underline underline-offset-2 transition-colors hover:text-foreground"
        >
          {expanded ? "접기" : "펼치기"}
        </button>
      ) : null}

      {/* 펼친 본문 */}
      {expanded ? (
        <div className="mt-2 flex flex-col gap-2 border border-border p-3">
          {bodyLoading ? (
            <p className="text-xs text-muted">불러오는 중…</p>
          ) : bodyError ? (
            <p className="text-xs text-muted">오류: {bodyError}</p>
          ) : (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed">
              {fullBody}
            </pre>
          )}
          <a
            href={mailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-xs text-muted underline underline-offset-2 transition-colors hover:text-foreground"
          >
            메일에서 열기 →
          </a>
        </div>
      ) : null}

      {/* 답장 초안/전송 영역 (기타·완료 제외) */}
      {!isOther && !done ? (
        <div className="mt-3 flex flex-col gap-2">
          {/* 1) 용건 입력 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") generate();
              }}
              placeholder="어떻게 답할지 간단히 적어주세요 (예: 정중히 거절 / 금요일 2시 어때요 / 영어로 수락)"
              className="flex-1 border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-foreground"
            />
            <button
              onClick={generate}
              disabled={drafting || !instruction.trim()}
              className="shrink-0 border border-foreground px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
            >
              {drafting
                ? "작성 중…"
                : draft !== null
                  ? "다시 작성"
                  : "AI 답장 생성"}
            </button>
          </div>
          {draftError ? (
            <p className="text-xs text-muted">오류: {draftError}</p>
          ) : null}

          {/* 2) 미리보기 + 3) 전송 */}
          {draft !== null ? (
            <div className="flex flex-col gap-2 border border-border p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-12 shrink-0 text-muted">받는사람</span>
                <span className="truncate">{m.from}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-12 shrink-0 text-muted">제목</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sent}
                  className="flex-1 border border-border bg-transparent px-2 py-1 outline-none focus:border-foreground disabled:opacity-60"
                />
              </div>

              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={sent}
                rows={Math.min(16, Math.max(5, draft.split("\n").length + 1))}
                className="w-full resize-y border border-border bg-transparent p-2.5 text-xs leading-relaxed outline-none focus:border-foreground disabled:opacity-60"
              />

              {sent ? (
                <p className="text-xs font-medium">메일이 전송되었습니다.</p>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    className="border border-foreground bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                  >
                    {sending ? "보내는 중…" : "보내기"}
                  </button>
                  <span className="text-[11px] text-muted">
                    확인창에서 승인해야 실제로 전송됩니다.
                  </span>
                </div>
              )}
              {sendError ? (
                <p className="text-xs text-muted">오류: {sendError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
