/**
 * 메일 공급자 디스패처.
 * session.provider 값에 따라 Gmail(gmail.js) 또는 Outlook(graph.js) 함수를 호출한다.
 * 두 모듈은 같은 함수 이름·시그니처를 제공한다.
 */
import * as gmail from "./gmail";
import * as graph from "./graph";

function impl(provider) {
  return provider === "microsoft-entra-id" ? graph : gmail;
}

export function listRecentMessageIds(session, max) {
  return impl(session.provider).listRecentMessageIds(session.accessToken, max);
}

export function getMessagesMetadata(session, ids) {
  return impl(session.provider).getMessagesMetadata(session.accessToken, ids);
}

export function getEmailWithBody(session, id) {
  return impl(session.provider).getEmailWithBody(session.accessToken, id);
}

export function sendReply(session, args) {
  return impl(session.provider).sendReply(session.accessToken, args);
}
