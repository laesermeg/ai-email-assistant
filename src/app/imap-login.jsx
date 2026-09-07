"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { IMAP_PRESETS } from "@/lib/imap-presets";

/** 도메인별 연결 방법 안내 */
const GUIDES = {
  "naver.com": {
    title: "네이버 메일 연결 방법",
    steps: [
      "PC에서 네이버 메일 → 왼쪽 아래 '환경설정' → 'POP3/IMAP 설정' 탭",
      "'IMAP/SMTP 사용'을 '사용함'으로 바꾸고 저장",
      "여기 비밀번호 칸에 네이버 로그인 비밀번호를 그대로 입력",
      "2단계 인증을 켜 둔 경우에만: 네이버 '내정보 > 보안설정 > 애플리케이션 비밀번호'에서 발급받아 그 값을 입력",
    ],
  },
  "daum.net": {
    title: "다음(한메일) 연결 방법",
    steps: [
      "다음 메일 → 환경설정 → 'IMAP/POP3' → IMAP 사용 설정",
      "비밀번호 칸에 다음 로그인 비밀번호 입력",
      "카카오계정 2단계 인증을 켠 경우: '카카오계정 > 보안 > 앱 비밀번호'에서 발급",
    ],
  },
  "kakao.com": {
    title: "카카오메일 연결 방법",
    steps: [
      "카카오메일 → 환경설정에서 IMAP 사용 설정",
      "카카오계정 2단계 인증을 켠 경우 '앱 비밀번호'가 필요합니다",
    ],
  },
  "gmail.com": {
    title: "Gmail은 위의 'Google (Gmail)로 로그인'을 쓰세요",
    steps: [
      "Gmail은 2022년부터 비밀번호 방식 IMAP을 막았어요.",
      "위쪽 'Google (Gmail)로 로그인' 버튼이 더 안전하고 간단합니다.",
      "꼭 IMAP으로 해야 하면: Google 계정에 2단계 인증을 켜고 '앱 비밀번호'를 발급해야 합니다.",
    ],
  },
  "yonsei.ac.kr": {
    title: "연세대(@yonsei.ac.kr)는 'Google로 로그인'을 먼저 시도하세요",
    steps: [
      "@yonsei.ac.kr 메일은 구글 기반이에요. 위 'Google (Gmail)로 로그인'이 우선입니다.",
      "막히면 IMAP: Google 계정 2단계 인증 + 앱 비밀번호가 필요합니다 (학교 정책상 막혀 있을 수 있어요).",
    ],
  },
};

const DEFAULT_GUIDE = {
  title: "일반 메일 연결 방법",
  steps: [
    "메일 서비스 설정에서 'IMAP' 사용을 켜세요 (대부분 기본은 꺼져 있어요).",
    "여기에는 이메일 주소와 로그인 비밀번호를 입력합니다.",
    "2단계 인증을 쓰면 '앱 비밀번호'를 발급받아 입력하세요.",
    "학교·회사 자체 메일이면 IMAP/SMTP 서버 주소를 IT 담당자에게 물어보세요.",
  ],
};

/**
 * IMAP 직접 연결 로그인 폼 + 도메인별 설정 안내.
 */
export default function ImapLogin() {
  const [open, setOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const domain = (email.split("@")[1] || "").toLowerCase();
  const preset = IMAP_PRESETS[domain];
  const needManual = email.includes("@") && !preset;
  const guide = GUIDES[domain] || DEFAULT_GUIDE;

  async function submit(e) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError("");
    const res = await signIn("imap", {
      email,
      password,
      imapHost: preset?.imapHost || imapHost,
      imapPort: String(preset?.imapPort || imapPort),
      smtpHost: preset?.smtpHost || smtpHost,
      smtpPort: String(preset?.smtpPort || smtpPort),
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setError(
        "연결에 실패했어요. 아래 '설정 방법'을 확인하고 이메일·비밀번호와 서버 주소를 다시 살펴봐 주세요."
      );
      setShowGuide(true);
    } else {
      window.location.href = "/";
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border border-border px-5 py-3 text-sm text-muted transition-colors hover:text-foreground"
      >
        메일 주소로 직접 연결 (IMAP)
      </button>
    );
  }

  const inputCls =
    "border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-foreground";

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 border border-border p-3"
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="이메일 주소"
        className={inputCls}
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="비밀번호 (2단계 인증 시 앱 비밀번호)"
        className={inputCls}
      />

      {needManual ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            value={imapHost}
            onChange={(e) => setImapHost(e.target.value)}
            placeholder="IMAP 서버 (예: imap.xxx)"
            className={inputCls}
          />
          <input
            value={imapPort}
            onChange={(e) => setImapPort(e.target.value)}
            placeholder="IMAP 포트 (993)"
            className={inputCls}
          />
          <input
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
            placeholder="SMTP 서버 (예: smtp.xxx)"
            className={inputCls}
          />
          <input
            value={smtpPort}
            onChange={(e) => setSmtpPort(e.target.value)}
            placeholder="SMTP 포트 (465/587)"
            className={inputCls}
          />
        </div>
      ) : preset ? (
        <p className="text-[11px] text-muted">
          {domain} 서버 자동 설정: {preset.imapHost} · {preset.smtpHost}
        </p>
      ) : null}

      {error ? <p className="text-xs text-muted">{error}</p> : null}

      {/* 설정 방법 안내 */}
      <button
        type="button"
        onClick={() => setShowGuide((v) => !v)}
        className="self-start text-[11px] text-muted underline underline-offset-2 hover:text-foreground"
      >
        {showGuide ? "설정 방법 접기" : "설정 방법 보기"}
      </button>
      {showGuide ? (
        <div className="border-l border-border pl-3 text-[11px] leading-relaxed text-muted">
          <p className="font-medium text-foreground">{guide.title}</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            {guide.steps.map((st, i) => (
              <li key={i}>{st}</li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="border border-foreground bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {busy ? "연결 중…" : "연결"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted underline underline-offset-2 hover:text-foreground"
        >
          취소
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted">
        비밀번호는 암호화해서 저장되며 메일 읽기·전송에만 쓰입니다.
      </p>
    </form>
  );
}
