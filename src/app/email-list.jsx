"use client";

import { useState } from "react";
import EmailItem from "./email-item";

/** 화면에 보여줄 순서: 개인 → 학교일 → 기타 → 미분류 */
const CATEGORY_ORDER = { 개인: 0, 학교일: 1, 기타: 2 };
function orderOf(category) {
  return CATEGORY_ORDER[category] ?? 3;
}

/**
 * "최근 메일 불러오기" 버튼 + 분류·요약된 메일 목록.
 * 실제 메일 조회·분석은 서버(/api/emails)가 하고, 여기서는 결과만 표시한다.
 */
export default function EmailList() {
  const [emails, setEmails] = useState(null);
  const [analyzed, setAnalyzed] = useState(true);
  const [stats, setStats] = useState(null); // { newlyAnalyzed, fromCache }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/emails");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청에 실패했어요.");

      const sorted = [...data.emails].sort(
        (a, b) => orderOf(a.category) - orderOf(b.category)
      );
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

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={load}
        disabled={loading}
        className="self-start border border-foreground px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
      >
        {loading ? "불러오는 중…" : "최근 메일 불러오기"}
      </button>

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

      {emails && emails.length === 0 ? (
        <p className="text-sm text-muted">받은 메일이 없습니다.</p>
      ) : null}

      {emails && emails.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {emails.map((m) => (
            <EmailItem key={m.id} email={m} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
