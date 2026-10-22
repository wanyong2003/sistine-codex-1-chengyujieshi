import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditLedger, queryUsage, user as userTable } from "@/lib/db/schema";

type QueryTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const ANONYMOUS_DAILY_LIMIT = 3;
export const UNVERIFIED_DAILY_LIMIT = 3;
export const VERIFIED_DAILY_LIMIT = 10;

export type QueryIdentity = {
  userId: string | null;
  emailVerified: boolean;
  scopeKey: string;
  anonymousScopeKey: string;
  visitorId: string;
  setVisitorCookie: boolean;
};

export type QueryQuota = {
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  subscriptionQueries: number;
  oneTimeQueries: number;
};

export type QueryReservation = QueryQuota & {
  source: "free" | "subscription" | "one_time";
};

export function getBeijingDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getVisitorIdentity(request: Request, userId: string | null, emailVerified = false): QueryIdentity {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const existingVisitorId = cookieHeader.match(/(?:^|;\s*)idiom_visitor_id=([^;]+)/)?.[1] ?? null;
  const visitorId = existingVisitorId || randomUUID();
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedIp || request.headers.get("x-real-ip") || "unknown";
  const secret = process.env.BETTER_AUTH_SECRET || "idiom-quota-local-secret";
  const anonymousKey = createHash("sha256")
    .update(`${visitorId}:${ip}:${secret}`)
    .digest("hex");

  return {
    userId,
    emailVerified,
    scopeKey: userId ? `user:${userId}` : `anon:${anonymousKey}`,
    anonymousScopeKey: `anon:${anonymousKey}`,
    visitorId,
    setVisitorCookie: !existingVisitorId,
  };
}

function getDailyLimit(identity: QueryIdentity) {
  if (!identity.userId) return ANONYMOUS_DAILY_LIMIT;
  return identity.emailVerified ? VERIFIED_DAILY_LIMIT : UNVERIFIED_DAILY_LIMIT;
}

async function mergeAnonymousUsage(tx: QueryTransaction, identity: QueryIdentity, usageDate: string) {
  if (!identity.userId || !identity.scopeKey.startsWith("user:")) return;

  const anonymousRows = await tx
    .select()
    .from(queryUsage)
    .where(and(eq(queryUsage.scopeKey, identity.anonymousScopeKey), eq(queryUsage.usageDate, usageDate)))
    .for("update");

  if (anonymousRows.length === 0) return;

  const userRows = await tx
    .select()
    .from(queryUsage)
    .where(and(eq(queryUsage.scopeKey, identity.scopeKey), eq(queryUsage.usageDate, usageDate)))
    .for("update");

  if (userRows.length === 0) {
    await tx.insert(queryUsage).values({
      id: randomUUID(),
      scopeKey: identity.scopeKey,
      usageDate,
      successfulCount: anonymousRows[0].successfulCount,
    });
  } else {
    await tx
      .update(queryUsage)
      .set({
        successfulCount: sql`${queryUsage.successfulCount} + ${anonymousRows[0].successfulCount}`,
        updatedAt: new Date(),
      })
      .where(eq(queryUsage.id, userRows[0].id));
  }

  await tx.delete(queryUsage).where(eq(queryUsage.id, anonymousRows[0].id));
}

async function lockOrCreateUsageRow(tx: QueryTransaction, scopeKey: string, usageDate: string) {
  let rows = await tx
    .select()
    .from(queryUsage)
    .where(and(eq(queryUsage.scopeKey, scopeKey), eq(queryUsage.usageDate, usageDate)))
    .for("update");

  if (rows.length === 0) {
    await tx
      .insert(queryUsage)
      .values({ id: randomUUID(), scopeKey, usageDate, successfulCount: 0 })
      .onConflictDoNothing();
    rows = await tx
      .select()
      .from(queryUsage)
      .where(and(eq(queryUsage.scopeKey, scopeKey), eq(queryUsage.usageDate, usageDate)))
      .for("update");
  }

  return rows[0];
}

export async function reserveQuery(identity: QueryIdentity): Promise<QueryReservation | null> {
  const usageDate = getBeijingDate();
  const dailyLimit = getDailyLimit(identity);

  return db.transaction(async tx => {
    await mergeAnonymousUsage(tx, identity, usageDate);
    const usage = await lockOrCreateUsageRow(tx, identity.scopeKey, usageDate);
    const dailyUsed = usage?.successfulCount ?? 0;

    if (dailyUsed < dailyLimit) {
      await tx
        .update(queryUsage)
        .set({ successfulCount: dailyUsed + 1, updatedAt: new Date() })
        .where(eq(queryUsage.id, usage.id));

      return {
        source: "free",
        dailyLimit,
        dailyUsed: dailyUsed + 1,
        dailyRemaining: Math.max(0, dailyLimit - dailyUsed - 1),
        subscriptionQueries: 0,
        oneTimeQueries: 0,
      };
    }

    if (!identity.userId) return null;

    const users = await tx
      .select({
        subscriptionQueries: userTable.subscriptionQueries,
        oneTimeQueries: userTable.credits,
      })
      .from(userTable)
      .where(eq(userTable.id, identity.userId))
      .for("update");
    const currentUser = users[0];
    if (!currentUser) return null;

    const source = currentUser.subscriptionQueries > 0
      ? "subscription"
      : currentUser.oneTimeQueries > 0
        ? "one_time"
        : null;
    if (!source) return null;

    await tx
      .update(userTable)
      .set(
        source === "subscription"
          ? { subscriptionQueries: sql`${userTable.subscriptionQueries} - 1` }
          : { credits: sql`${userTable.credits} - 1` },
      )
      .where(eq(userTable.id, identity.userId));

    await tx.update(queryUsage)
      .set({ successfulCount: dailyUsed + 1, updatedAt: new Date() })
      .where(eq(queryUsage.id, usage.id));

    await tx.insert(creditLedger).values({
      id: randomUUID(),
      userId: identity.userId,
      delta: -1,
      reason: "idiom_query",
    });

    return {
      source,
      dailyLimit,
      dailyUsed: dailyUsed + 1,
      dailyRemaining: 0,
      subscriptionQueries: Math.max(0, currentUser.subscriptionQueries - (source === "subscription" ? 1 : 0)),
      oneTimeQueries: Math.max(0, currentUser.oneTimeQueries - (source === "one_time" ? 1 : 0)),
    };
  });
}

export async function getQueryQuota(identity: QueryIdentity): Promise<QueryQuota> {
  const usageDate = getBeijingDate();
  const dailyLimit = getDailyLimit(identity);

  return db.transaction(async tx => {
    await mergeAnonymousUsage(tx, identity, usageDate);
    const usage = await tx
      .select({ successfulCount: queryUsage.successfulCount })
      .from(queryUsage)
      .where(and(eq(queryUsage.scopeKey, identity.scopeKey), eq(queryUsage.usageDate, usageDate)))
      .limit(1);

    if (!identity.userId) {
      return {
        dailyLimit,
        dailyUsed: usage[0]?.successfulCount ?? 0,
        dailyRemaining: Math.max(0, dailyLimit - (usage[0]?.successfulCount ?? 0)),
        subscriptionQueries: 0,
        oneTimeQueries: 0,
      };
    }

    const users = await tx
      .select({
        subscriptionQueries: userTable.subscriptionQueries,
        oneTimeQueries: userTable.credits,
      })
      .from(userTable)
      .where(eq(userTable.id, identity.userId))
      .limit(1);

    const dailyUsed = usage[0]?.successfulCount ?? 0;
    return {
      dailyLimit,
      dailyUsed,
      dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
      subscriptionQueries: users[0]?.subscriptionQueries ?? 0,
      oneTimeQueries: users[0]?.oneTimeQueries ?? 0,
    };
  });
}
