"use client";

import { useState } from "react";

/**
 * "최근 메일 불러오기" 버튼 + 결과 목록.
 * 버튼 클릭이라는 사용자 동작이 필요해서 클라이언트 컴포넌트로 만든다.
 * 실제 메일 조회는 서버(/api/emails)가 하고, 여기서는 결과만 표시한다.
 */
export default function EmailList() {
  const [emails, setEmails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/emails");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청에 실패했어요.");
      setEmails(data.emails);
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

      {emails && emails.length === 0 ? (
        <p className="text-sm text-muted">받은 메일이 없습니다.</p>
      ) : null}

      {emails && emails.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {emails.map((m) => (
            <li key={m.id} className="py-3">
              <p className="truncate text-sm font-medium">
                {m.subject || "(제목 없음)"}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">{m.from}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{m.snippet}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
