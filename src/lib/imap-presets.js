/**
 * 주요 메일 공급자의 IMAP/SMTP 서버 주소.
 * 도메인이 여기 있으면 사용자가 서버 주소를 입력할 필요가 없다.
 */
export const IMAP_PRESETS = {
  "naver.com": {
    imapHost: "imap.naver.com",
    imapPort: 993,
    smtpHost: "smtp.naver.com",
    smtpPort: 587,
  },
  "daum.net": {
    imapHost: "imap.daum.net",
    imapPort: 993,
    smtpHost: "smtp.daum.net",
    smtpPort: 465,
  },
  "hanmail.net": {
    imapHost: "imap.daum.net",
    imapPort: 993,
    smtpHost: "smtp.daum.net",
    smtpPort: 465,
  },
  "kakao.com": {
    imapHost: "imap.kakao.com",
    imapPort: 993,
    smtpHost: "smtp.kakao.com",
    smtpPort: 465,
  },
  "gmail.com": {
    imapHost: "imap.gmail.com",
    imapPort: 993,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
  },
  // 연세대 @yonsei.ac.kr 은 구글 Workspace
  "yonsei.ac.kr": {
    imapHost: "imap.gmail.com",
    imapPort: 993,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
  },
  "uio.no": {
    imapHost: "imap.uio.no",
    imapPort: 993,
    smtpHost: "smtp.uio.no",
    smtpPort: 465,
  },
  "outlook.com": {
    imapHost: "outlook.office365.com",
    imapPort: 993,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
  },
};

/** 이메일 주소에서 도메인을 보고 프리셋을 찾는다. 없으면 null. */
export function presetForEmail(email) {
  const domain = String(email || "")
    .split("@")[1]
    ?.toLowerCase();
  return (domain && IMAP_PRESETS[domain]) || null;
}
