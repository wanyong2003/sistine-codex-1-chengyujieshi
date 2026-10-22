import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveSessionUser } from "@/lib/auth/session";
import { analyzeIdiom, normalizeIdiomInput } from "@/lib/idiom/analyze";
import {
  getQueryQuota,
  getVisitorIdentity,
  reserveQuery,
  type QueryIdentity,
} from "@/lib/idiom/quota";

type IdentityError = { ok: false; error: string; status: 401 | 403 };

async function resolveIdentity(req: NextRequest): Promise<QueryIdentity | IdentityError> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.session?.userId) {
    return getVisitorIdentity(req, null);
  }

  const access = await getActiveSessionUser(req.headers);
  if (!access.ok) {
    return access;
  }

  return getVisitorIdentity(req, access.user.id, access.user.emailVerified);
}

function isIdentityError(value: QueryIdentity | IdentityError): value is IdentityError {
  return "ok" in value;
}

function respond<T>(payload: T, identity: ReturnType<typeof getVisitorIdentity>, status = 200) {
  const response = NextResponse.json(payload, { status });
  if (identity.setVisitorCookie) {
    response.cookies.set("idiom_visitor_id", identity.visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return response;
}

export async function GET(req: NextRequest) {
  try {
    const identity = await resolveIdentity(req);
    if (isIdentityError(identity)) {
      return NextResponse.json({ error: identity.error }, { status: identity.status });
    }

    const quota = await getQueryQuota(identity);
    return respond({ quota }, identity);
  } catch (error) {
    console.error("Idiom quota error:", error);
    return NextResponse.json({ error: "暂时无法读取查询次数，请稍后重试。" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let identity: ReturnType<typeof getVisitorIdentity> | null = null;

  try {
    const resolvedIdentity = await resolveIdentity(req);
    if (isIdentityError(resolvedIdentity)) {
      return NextResponse.json({ error: resolvedIdentity.error }, { status: resolvedIdentity.status });
    }
    identity = resolvedIdentity;

    const body = (await req.json()) as { input?: unknown };
    const input = typeof body.input === "string" ? normalizeIdiomInput(body.input) : "";
    if (!input || input.length > 32) {
      return respond({ error: "请输入一个不超过 32 个字符的成语。" }, identity, 400);
    }

    const result = await analyzeIdiom(input);
    if (result.status !== "match") {
      return respond({ result }, identity);
    }

    if (!result.originConfirmed) {
      return respond({
        result: {
          ...result,
          origin: "出处暂时无法确认",
        },
        quota: await getQueryQuota(identity),
      }, identity);
    }

    const reservation = await reserveQuery(identity);
    if (!reservation) {
      return respond({
        error: identity.userId
          ? "今日免费次数已用完，当前没有可用的付费查询次数。"
          : "今日免费次数已用完，请登录后继续查询。",
        quota: await getQueryQuota(identity),
      }, identity, 402);
    }

    return respond({ result, quota: reservation }, identity);
  } catch (error) {
    console.error("Idiom API error:", error);
    if (identity) {
      return respond({ error: "解释服务暂时不可用，请稍后重试。" }, identity, 503);
    }
    return NextResponse.json({ error: "解释服务暂时不可用，请稍后重试。" }, { status: 503 });
  }
}
