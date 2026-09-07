/**
 * 메일 공급자 디스패처.
 * session.provider 에 따라 Gmail / Outlook(Graph) / IMAP 중 알맞은 모듈을 호출한다.
 * 세 모듈은 같은 함수 이름을 제공한다 (첫 인자만 다름: accessToken 또는 creds).
 */
import * as gmail from "./gmail";
import * as graph from "./graph";
import * as imap from "./imap";
import { getMailCredentials } from "./mail-credentials";

/** 세션에서 (구현 모듈, 첫 인자)를 결정한다. */
async function resolve(session) {
  if (session?.provider === "imap") {
    const creds = await getMailCredentials(session.user?.email);
    if (!creds) {
      throw new Error("메일 접속정보가 없어요. 다시 연결해 주세요.");
    }
    return { impl: imap, arg: creds };
  }
  if (session?.provider === "microsoft-entra-id") {
    return { impl: graph, arg: session.accessToken };
  }
  return { impl: gmail, arg: session.accessToken };
}

export async function listRecentMessageIds(session, max) {
  const { impl, arg } = await resolve(session);
  return impl.listRecentMessageIds(arg, max);
}

export async function getMessagesMetadata(session, ids) {
  const { impl, arg } = await resolve(session);
  return impl.getMessagesMetadata(arg, ids);
}

export async function getEmailWithBody(session, id) {
  const { impl, arg } = await resolve(session);
  return impl.getEmailWithBody(arg, id);
}

export async function sendReply(session, args) {
  const { impl, arg } = await resolve(session);
  return impl.sendReply(arg, args);
}
