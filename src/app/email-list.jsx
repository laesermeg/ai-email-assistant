"use client";

import { useEffect, useMemo, useState } from "react";
import EmailItem from "./email-item";

/** 화면에 보여줄 순서: 개인 → 업무 → 기타 → 미분류 */
const CATEGORY_ORDER = { 개인: 0, 업무: 1, 기타: 2 };
function orderOf(category) {
  return CATEGORY_ORDER[category] ?? 3;
}

/** 탭 목록 */
const FILTERS = [
  { id: "all", label: "전체" },
  { id: "업무", label: "업무" },
  { id: "개인", label: "개인" },
  { id: "기타", label: "기타" },
];

/** 분석 개수 선택지 */
const COUNT_OPTIONS = [30, 50, 100, 200];

function readSavedCount() {
  try {
    const v = Number(localStorage.getItem("aiemail:count"));
    return COUNT_OPTIONS.includes(v) ? v : 30;
  } catch {
    return 30;
  }
}

/**
 * "메일 불러오기" 버튼 + 분류·요약된 메일 목록 + 분류별 탭.
 * 실제 메일 조회·분석은 서버(/api/emails)가 하고, 여기서는 결과만 표시한다.
 */
export default function EmailList() {
  const [emails, setEmails] = useState(null);
  const [analyzed, setAnalyzed] = useState(true);
  const [stats, setStats] = useState(null); // { newlyAnalyzed, fromCache }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [count, setCount] = useState(30);
  const [showDone, setShowDone] = useState(false);

  // 어떤 메일의 "확인 완료" 상태가 바뀌면 목록에도 반영
  function handleToggleDone(id, done) {
    setEmails((list) =>
      (list || []).map((m) => (m.id === id ? { ...m, done } : m))
    );
  }

  useEffect(() => {
    setCount(readSavedCount());
  }, []);

  function changeCount(n) {
    setCount(n);
    try {
      localStorage.setItem("aiemail:count", String(n));
    } catch {
      /* 무시 */
    }
  }

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ count: String(count) });
      if (refresh) qs.set("refresh", "1");
      const res = await fetch(`/api/emails?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청에 실패했어요.");

      // 분류(개인→업무→기타) 우선, 같은 분류 안에서는 받은 날짜 최신순
      const sorted = [...data.emails].sort((a, b) => {
        const byCat = orderOf(a.category) - orderOf(b.category);
        if (byCat !== 0) return byCat;
        const ta = a.date ? Date.parse(a.date) : 0;
        const tb = b.date ? Date.parse(b.date) : 0;
        return tb - ta;
      });
      setEmails(sorted);
      setAnalyzed(data.analyzed);
      setStats({
        newlyAnalyzed: data.newlyAnalyzed ?? 0,
        fromCache: data.fromCache ?? 0,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // 분류별 개수 (확인 완료 제외 = 아직 처리할 메일 수)
  const counts = useMemo(() => {
    const c = { all: 0, 개인: 0, 업무: 0, 기타: 0 };
    for (const m of emails || []) {
      if (m.done) continue;
      c.all += 1;
      if (c[m.category] !== undefined) c[m.category] += 1;
    }
    return c;
  }, [emails]);

  const doneCount = useMemo(
    () => (emails || []).filter((m) => m.done).length,
    [emails]
  );

  const shown = useMemo(() => {
    if (!emails) return [];
    let list = filter === "all" ? emails : emails.filter((m) => m.category === filter);
    if (!showDone) list = list.filter((m) => !m.done);
    // 완료한 메일은 아래로
    return [...list].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  }, [emails, filter, showDone]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <span>최근</span>
          <select
            value={count}
            onChange={(e) => changeCount(Number(e.target.value))}
            disabled={loading}
            className="border border-border bg-transparent px-2 py-2 outline-none focus:border-foreground disabled:opacity-40"
          >
            {COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>개의 메일을 불러옵니다.</span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="border border-foreground px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            {loading ? "불러오는 중…" : "메일 불러오기"}
          </button>
          {emails ? (
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="border border-border px-4 py-2 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-40"
            >
              키워드 지침 동기화
            </button>
          ) : null}
        </div>
      </div>

      {count >= 100 ? (
        <p className="text-xs text-muted">
          처음 {count}개를 분석할 땐 몇 분 걸릴 수 있어요. 한 번 분석하면 다음부턴
          빠릅니다.
        </p>
      ) : null}

      {error ? <p className="text-sm text-muted">오류: {error}</p> : null}

      {emails && !analyzed ? (
        <p className="text-xs text-muted">
          AI 분석에 실패해서 분류·요약 없이 표시합니다.
        </p>
      ) : null}

      {emails && stats ? (
        <p className="text-xs text-muted">
          {stats.newlyAnalyzed > 0
            ? `새로 분석 ${stats.newlyAnalyzed}개 · 저장된 결과 ${stats.fromCache}개`
            : `전부 저장된 결과 사용 (${stats.fromCache}개) · AI 호출 없음`}
        </p>
      ) : null}

      {/* 분류 탭 + 완료 표시 토글 */}
      {emails ? (
        <div className="flex items-center gap-1 border-b border-border">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={
                "-mb-px border-b-2 px-3 py-2 text-sm transition-colors " +
                (filter === f.id
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted hover:text-foreground")
              }
            >
              {f.label}
              <span className="ml-1 text-xs text-muted">{counts[f.id]}</span>
            </button>
          ))}
          {doneCount > 0 ? (
            <button
              onClick={() => setShowDone((v) => !v)}
              className="ml-auto shrink-0 px-2 py-2 text-xs text-muted underline underline-offset-2 transition-colors hover:text-foreground"
            >
              {showDone ? "완료 숨기기" : `완료 ${doneCount}개 표시`}
            </button>
          ) : null}
        </div>
      ) : null}

      {emails && emails.length === 0 ? (
        <p className="text-sm text-muted">받은 메일이 없습니다.</p>
      ) : null}

      {emails && emails.length > 0 && shown.length === 0 ? (
        <p className="text-sm text-muted">
          {filter === "all" && !showDone
            ? "모두 확인 완료했어요."
            : "이 분류에 해당하는 메일이 없어요."}
        </p>
      ) : null}

      {shown.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {shown.map((m) => (
            <EmailItem key={m.id} email={m} onToggleDone={handleToggleDone} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
