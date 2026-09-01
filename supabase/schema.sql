-- ─────────────────────────────────────────────────────────────
-- AI 이메일 비서 - 데이터베이스 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 "Run" 하세요.
-- 개인정보 원칙: 메일 제목·본문·미리보기는 저장하지 않는다.
--               분류/요약 같은 "가공된 구조화 데이터"만 저장.
-- ─────────────────────────────────────────────────────────────

-- 1) 메일 분석 결과 (한 번 분석하면 다시 안 함)
create table if not exists email_analysis (
  id               bigint generated always as identity primary key,
  user_email       text not null,                 -- 이 결과의 주인 (로그인 사용자)
  gmail_message_id text not null,                 -- Gmail 메시지 ID
  gmail_thread_id  text,                          -- Gmail 스레드 ID (답장 시 사용)
  from_addr        text not null default '',      -- 발신자 (목록 표시 + 규칙용 메타데이터)
  subject          text not null default '',      -- 제목 (목록 표시용 메타데이터)
  category         text not null,                 -- '개인' | '학교일' | '기타'
  category_reason  text not null default '',      -- 분류 이유 한 문장
  summary          jsonb not null default '{}'::jsonb,  -- {who, what, deadline, replyNeeded}
  analyzed_at      timestamptz not null default now(),
  unique (user_email, gmail_message_id)           -- 같은 메일 중복 저장 방지
);
-- 기존 테이블에 컬럼 추가 (이미 있으면 무시됨)
alter table email_analysis add column if not exists from_addr  text not null default '';
alter table email_analysis add column if not exists subject    text not null default '';
alter table email_analysis add column if not exists email_date timestamptz;
create index if not exists idx_email_analysis_user_date
  on email_analysis (user_email, email_date desc);

create index if not exists idx_email_analysis_user_time
  on email_analysis (user_email, analyzed_at desc);

-- 2) 증분 동기화 상태 (다음 단계에서 사용: "지난번 이후 새 메일만")
create table if not exists sync_state (
  user_email      text primary key,
  last_history_id text,                           -- Gmail historyId
  updated_at      timestamptz not null default now()
);

-- 2-b) 사용자 규칙 (구조 규칙)
create table if not exists rules (
  id          bigint generated always as identity primary key,
  user_email  text not null,
  match_type  text not null,   -- 'from_domain' | 'from_address' | 'subject_contains'
  pattern     text not null,
  category    text not null,   -- '개인' | '학교일' | '기타'
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_rules_user on rules (user_email, id);

-- 2-c) 사용자 설정 (AI 분류 지침 등)
create table if not exists user_settings (
  user_email         text primary key,
  classify_guideline text not null default '',
  updated_at         timestamptz not null default now()
);

-- 3) RLS 활성화 (정책은 두지 않음)
--    서버는 secret 키로 접근하므로 RLS를 우회한다.
--    혹시 URL+공개키가 유출돼도 데이터가 노출되지 않도록 기본 차단.
alter table email_analysis enable row level security;
alter table sync_state     enable row level security;
alter table rules          enable row level security;
alter table user_settings  enable row level security;
