"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { IMAP_PRESETS } from "@/lib/imap-presets";

/**
 * IMAP 직접 연결 로그인 폼.
 * 이메일 + 비밀번호(또는 앱 비밀번호)를 입력하면 서버가 IMAP 접속을 확인한다.
 * 주요 도메인(naver/daum/gmail/yonsei 등)은 서버 주소를 자동 채운다.
 */
export default function ImapLogin() {
  const [open, setOpen] = useState(false);
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
        "연결에 실패했어요. 이메일·비밀번호와 서버 주소를 확인해 주세요. " +
          "(2단계 인증을 쓰면 '앱 비밀번호'가 필요합니다)"
      );
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
        placeholder="비밀번호 (또는 앱 비밀번호)"
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
        비밀번호는 암호화해서 저장되며 메일 읽기·전송에만 쓰입니다. 네이버·Gmail은
        메일 설정에서 IMAP을 켜고 앱 비밀번호를 발급해야 할 수 있어요.
      </p>
    </form>
  );
}
