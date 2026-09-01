/**
 * /api/rules
 *  GET    → 내 규칙 목록
 *  POST   → 규칙 추가  { matchType, pattern, category }
 *  DELETE → 규칙 삭제  ?id=123
 */
import { auth } from "@/auth";
import {
  getAllRules,
  addRule,
  deleteRule,
  MATCH_TYPES,
} from "@/lib/rules";

const CATEGORIES = ["개인", "학교일", "기타"];

async function requireUserEmail() {
  const session = await auth();
  return session?.user?.email || null;
}

export async function GET() {
  const userEmail = await requireUserEmail();
  if (!userEmail) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const rules = await getAllRules(userEmail);
    return Response.json({ rules });
  } catch (err) {
    console.error("[/api/rules GET]", err.message);
    return Response.json({ error: "규칙을 불러오지 못했어요." }, { status: 502 });
  }
}

export async function POST(request) {
  const userEmail = await requireUserEmail();
  if (!userEmail) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const matchType = String(body.matchType || "");
  const pattern = String(body.pattern || "").trim();
  const category = String(body.category || "");

  if (
    !MATCH_TYPES.includes(matchType) ||
    !pattern ||
    !CATEGORIES.includes(category)
  ) {
    return Response.json(
      { error: "입력값을 확인해 주세요." },
      { status: 400 }
    );
  }

  try {
    const rule = await addRule(userEmail, { matchType, pattern, category });
    return Response.json({ rule });
  } catch (err) {
    console.error("[/api/rules POST]", err.message);
    return Response.json({ error: "규칙을 추가하지 못했어요." }, { status: 502 });
  }
}

export async function DELETE(request) {
  const userEmail = await requireUserEmail();
  if (!userEmail) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) {
    return Response.json({ error: "id 가 필요해요." }, { status: 400 });
  }

  try {
    await deleteRule(userEmail, id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[/api/rules DELETE]", err.message);
    return Response.json({ error: "규칙을 삭제하지 못했어요." }, { status: 502 });
  }
}
