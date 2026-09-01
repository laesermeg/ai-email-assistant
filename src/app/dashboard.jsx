"use client";

import { useState } from "react";
import EmailList from "./email-list";
import RulesPanel from "./rules-panel";

const TABS = [
  { id: "mail", label: "메일" },
  { id: "rules", label: "규칙" },
];

/** 로그인 후 메인 화면. [메일] / [규칙] 탭 전환. */
export default function Dashboard() {
  const [tab, setTab] = useState("mail");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
              (tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "mail" ? <EmailList /> : <RulesPanel />}
    </div>
  );
}
