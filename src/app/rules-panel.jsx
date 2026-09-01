"use client";

import { useEffect, useState } from "react";

const MATCH_TYPES = [
  { value: "from_domain", label: "발신자 도메인", ph: "예: univ.ac.kr" },
  { value: "from_address", label: "발신자 주소", ph: "예: mom@naver.com" },
  { value: "subject_contains", label: "제목에 단어 포함", ph: "예: 뉴스레터" },
];
const CATEGORIES = ["개인", "학교일", "기타"];

/**
 * 규칙 관리 화면.
 * 규칙에 걸린 메일은 AI를 거치지 않고 즉시 분류된다 (요약은 하지 않음).
 */
export default function RulesPanel() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [matchType, setMatchType] = useState("from_domain");
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState("학교일");
  const [saving, setSaving] = useState(false);

  // AI 분류 지침 (자연어)
  const [guideline, setGuideline] = useState("");
  const [guidelineSaving, setGuidelineSaving] = useState(false);
  const [guidelineSaved, setGuidelineSaved] = useState(false);

  async function loadRules() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rules");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "불러오기 실패");
      setRules(data.rules);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadGuideline() {
    try {
      const res = await fetch("/api/guideline");
      const data = await res.json();
      if (res.ok) setGuideline(data.guideline || "");
    } catch {
      /* 무시 */
    }
  }

  async function saveGuideline() {
    setGuidelineSaving(true);
    setGuidelineSaved(false);
    setError("");
    try {
      const res = await fetch("/api/guideline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guideline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      setGuidelineSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuidelineSaving(false);
    }
  }

  useEffect(() => {
    loadRules();
    loadGuideline();
  }, []);

  async function addRule(e) {
    e.preventDefault();
    if (!pattern.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchType, pattern, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "추가 실패");
      setPattern("");
      loadRules();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(id) {
    try {
      const res = await fetch(`/api/rules?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "삭제 실패");
      setRules((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  const labelOf = (v) => MATCH_TYPES.find((t) => t.value === v)?.label || v;
  const currentPh =
    MATCH_TYPES.find((t) => t.value === matchType)?.ph || "";

  return (
    <div className="flex flex-col gap-6">
      {/* AI 분류 지침 (자연어) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">AI 분류 지침</h3>
          <span className="text-[11px] text-muted">
            애매한 판단을 자연어로. AI가 분류할 때 참고합니다.
          </span>
        </div>
        <textarea
          value={guideline}
          onChange={(e) => {
            setGuideline(e.target.value);
            setGuidelineSaved(false);
          }}
          rows={4}
          placeholder={
            "예)\n- 학회·저널에서 오는 심사·투고 관련 메일은 기타로\n- @kaist.ac.kr 에서 오면 대체로 학교일\n- 광고·홍보 문구가 있으면 기타"
          }
          className="w-full resize-y border border-border bg-transparent p-2.5 text-xs leading-relaxed outline-none focus:border-foreground"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={saveGuideline}
            disabled={guidelineSaving}
            className="border border-foreground px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            {guidelineSaving ? "저장 중…" : "지침 저장"}
          </button>
          {guidelineSaved ? (
            <span className="text-[11px] text-muted">
              저장됨 · [메일] 탭에서 “규칙 반영해 다시 분석” 하면 적용돼요
            </span>
          ) : null}
        </div>
      </div>

      <div className="h-px bg-border" />

      <p className="text-xs text-muted">
        아래 <b>구조 규칙</b>은 AI 없이 즉시·확정 분류돼요 (요약은 생략).
        위에서부터 먼저 맞는 규칙이 적용됩니다.
      </p>

      {/* 규칙 추가 */}
      <form onSubmit={addRule} className="flex flex-col gap-2 border border-border p-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={matchType}
            onChange={(e) => setMatchType(e.target.value)}
            className="border border-border bg-transparent px-2 py-1.5 text-xs outline-none focus:border-foreground"
          >
            {MATCH_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={currentPh}
            className="min-w-[10rem] flex-1 border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-foreground"
          />

          <span className="self-center text-xs text-muted">→</span>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-border bg-transparent px-2 py-1.5 text-xs outline-none focus:border-foreground"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={saving || !pattern.trim()}
            className="border border-foreground bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {saving ? "추가 중…" : "추가"}
          </button>
        </div>
      </form>

      {error ? <p className="text-xs text-muted">오류: {error}</p> : null}

      {/* 규칙 목록 */}
      {loading ? (
        <p className="text-sm text-muted">불러오는 중…</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted">아직 규칙이 없어요.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border text-xs">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-2.5">
              <span className="shrink-0 text-muted">{labelOf(r.match_type)}</span>
              <span className="font-medium">{r.pattern}</span>
              <span className="text-muted">→ {r.category}</span>
              <button
                onClick={() => removeRule(r.id)}
                className="ml-auto shrink-0 text-muted underline underline-offset-2 hover:text-foreground"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
