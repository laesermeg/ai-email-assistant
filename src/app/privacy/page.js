export const metadata = {
  title: "개인정보처리방침 · AI 이메일 비서",
};

/** 섹션 */
function S({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-1">
        <a
          href="/"
          className="text-xs text-muted underline underline-offset-4 hover:text-foreground"
        >
          ← AI 이메일 비서
        </a>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          개인정보처리방침
        </h1>
        <p className="text-xs text-muted">최종 업데이트: 2026-09-07</p>
      </header>

      <p className="text-sm leading-relaxed text-muted">
        AI 이메일 비서(&ldquo;서비스&rdquo;)는 교수·연구자가 받은 메일을 빠르게
        확인하도록 돕는 도구입니다. 서비스는 메일 <b>원문을 장기 저장하지 않고</b>,
        분류·요약 등 가공된 결과와 최소한의 메타데이터만 보관합니다.
      </p>

      <S title="1. 수집·처리하는 정보">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>계정 정보</b>: 로그인한 이메일 주소, 표시 이름. (Google / Microsoft
            로그인 시 해당 제공자가 전달하는 값)
          </li>
          <li>
            <b>메일 접근 토큰</b>: Google·Microsoft OAuth 접근/갱신 토큰. 암호화된
            세션 쿠키에 보관하며 메일을 읽고 보내는 데만 사용합니다.
          </li>
          <li>
            <b>IMAP 직접 연결 시</b>: 사용자가 입력한 메일 비밀번호(또는 앱
            비밀번호)와 IMAP/SMTP 서버 주소. 비밀번호는 <b>AES-256-GCM으로
            암호화</b>하여 데이터베이스에 저장하고, 메일 접속에만 복호화합니다.
          </li>
          <li>
            <b>메일 메타데이터</b>: 최근 받은 메일의 보낸사람, 제목, 받은 날짜,
            메일 식별자.
          </li>
          <li>
            <b>가공 결과</b>: AI가 만든 분류(개인/업무/기타), 분류 이유, 요약(누가·
            용건·날짜·답장 필요 여부), 사용자가 지정한 키워드 규칙과 분류 지침,
            &ldquo;확인 완료&rdquo; 표시.
          </li>
        </ul>
        <p>
          <b>저장하지 않는 것</b>: 메일 본문, 첨부파일, 미리보기(snippet). 본문은
          요약 초안 생성이나 &ldquo;펼쳐 보기&rdquo; 시 그 순간에만 불러와
          사용하며 저장하지 않습니다.
        </p>
      </S>

      <S title="2. 이용 목적">
        <ul className="list-disc space-y-1 pl-5">
          <li>받은 메일을 개인 / 업무 / 기타로 분류하고 요약</li>
          <li>사용자의 짧은 지시로 답장 초안 작성</li>
          <li>사용자가 미리보기로 확인하고 승인한 답장을 전송</li>
          <li>한 번 처리한 메일을 다시 처리하지 않도록 결과 저장</li>
        </ul>
      </S>

      <S title="3. 처리 위탁 (하위 처리자)">
        <p>서비스 운영을 위해 아래 업체에 데이터 처리를 위탁합니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Google LLC</b> — Gmail API / Google 로그인 (사용자가 Google 계정을
            연결한 경우)
          </li>
          <li>
            <b>Microsoft Corporation</b> — Microsoft Graph API / 로그인 (사용자가
            Microsoft 계정을 연결한 경우)
          </li>
          <li>
            <b>AI 처리 제공자</b> — 메일의 <b>보낸사람·제목·짧은 미리보기만</b>
            전송하여 분류·요약을 수행합니다. 현재 Google Gemini API를 사용하며,
            제공자는 변경될 수 있습니다. 답장 초안 작성 시에는 해당 메일 본문이
            전송됩니다.
          </li>
          <li>
            <b>Supabase Inc.</b> — 가공 결과·설정·암호화된 자격증명 저장(데이터베이스
            호스팅)
          </li>
          <li>
            <b>Vercel Inc.</b> — 애플리케이션 호스팅
          </li>
        </ul>
        <p>
          위 목적 외에 개인정보를 제3자에게 판매하거나 광고 목적으로 제공하지
          않습니다.
        </p>
      </S>

      <S title="4. 보관 및 파기">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            가공 결과·설정은 사용자가 삭제하거나 계정 연결을 해제할 때까지
            보관합니다.
          </li>
          <li>
            메일 본문·첨부파일은 저장하지 않으므로 별도 파기 대상이 없습니다.
          </li>
          <li>
            계정 연결 해제(로그아웃 후 재연결 안 함) 또는 삭제 요청 시 해당
            사용자의 저장 데이터(메타데이터, 가공 결과, 암호화된 자격증명)를
            삭제합니다.
          </li>
        </ul>
      </S>

      <S title="5. 이용자의 권리">
        <p>
          사용자는 언제든지 계정 연결을 해제할 수 있으며, 저장된 데이터의 열람·
          삭제를 요청할 수 있습니다. 요청은 아래 연락처로 보내주세요.
        </p>
      </S>

      <S title="6. 보안">
        <ul className="list-disc space-y-1 pl-5">
          <li>모든 통신은 HTTPS로 암호화됩니다.</li>
          <li>
            IMAP 비밀번호는 서버 전용 키로 AES-256-GCM 암호화하여 저장하며, 키는
            애플리케이션 코드·클라이언트에 노출되지 않습니다.
          </li>
          <li>서버 로그에 메일 본문이나 비밀번호를 기록하지 않습니다.</li>
          <li>
            AI 제공자에는 분류·요약에 필요한 최소한의 정보(보낸사람·제목·미리보기,
            초안 작성 시 해당 본문)만 전송합니다.
          </li>
        </ul>
      </S>

      <S title="7. 문의">
        <p>
          개인정보 처리에 관한 문의·열람·삭제 요청:{" "}
          <a
            href="mailto:nius8521@gmail.com"
            className="underline underline-offset-2 hover:text-foreground"
          >
            nius8521@gmail.com
          </a>
        </p>
      </S>

      <footer className="border-t border-border pt-4 text-xs text-muted">
        본 방침은 서비스 변경에 따라 갱신될 수 있으며, 중요한 변경은 서비스 내에
        고지합니다.
      </footer>
    </div>
  );
}
