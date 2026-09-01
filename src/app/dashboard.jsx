"use client";

import { useState } from "react";
import EmailList from "./email-list";
import RulesPanel from "./rules-panel";

/**
 * 로그인 후 메인 화면.
 * 기본은 메일 목록. "키워드 설정 · AI 지침"은 오른쪽 위 링크로 열고 닫는다 (설정 성격).
 */
export default function Dashboard({ userEmail }) {
  const [view, setView] = useState("mail");

  if (view === "settings") {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setView("mail")}
          className="self-start text-sm text-muted underline underline-offset-4 transition-colors hover:text-foreground"
        >
          ← 메일로
        </button>
        <h2 className="text-lg font-semibold tracking-tight">키워드 설정 · AI 지침</h2>
        <RulesPanel />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          onClick={() => setView("settings")}
          className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-foreground"
        >
          키워드 설정 · AI 지침
        </button>
      </div>
      <EmailList userEmail={userEmail} />
    </div>
  );
}
