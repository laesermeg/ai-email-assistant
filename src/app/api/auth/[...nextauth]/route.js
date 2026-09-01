/**
 * 로그인/로그아웃/콜백 등 인증 관련 모든 요청이 도착하는 주소.
 *   /api/auth/signin, /api/auth/callback/google, /api/auth/session ...
 * 실제 처리 로직은 src/auth.js 의 handlers 가 전부 담당하므로 여기선 연결만 한다.
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
