import { NextRequest, NextResponse } from "next/server";
import { isPackKey, isSubscriptionKey, oneTimePacks, subscriptionPlans } from "@/constants/billing";
import { createCheckoutSession } from "@/lib/payments/creem";
import { getActiveSessionUser } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/error-utils";
import { db } from "@/lib/db";
import { subscription as subscriptionTable } from "@/lib/db/schema";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

type Body = {
  kind: "subscription" | "one_time";
  key: string; // plan or pack key
  agreedToTerms?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { kind, key, agreedToTerms } = body;

    if (agreedToTerms !== true) {
      return NextResponse.json(
        { error: "Please agree to the terms, privacy policy, and refund policy." },
        { status: 400 },
      );
    }

    // Get user from Better Auth session (do not trust client userId)
    const access = await getActiveSessionUser(req.headers);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const userId = access.user.id;

    if (!access.user.emailVerified) {
      return NextResponse.json(
        { error: "Please verify your email before purchasing." },
        { status: 403 },
      );
    }

    if (kind === "subscription") {
      const activeSubscriptions = await db
        .select({ id: subscriptionTable.id })
        .from(subscriptionTable)
        .where(
          and(
            eq(subscriptionTable.userId, userId),
            inArray(subscriptionTable.status, ["active", "trialing", "canceled"]),
            or(
              isNull(subscriptionTable.currentPeriodEnd),
              gt(subscriptionTable.currentPeriodEnd, new Date()),
            ),
          ),
        )
        .limit(1);

      if (activeSubscriptions.length > 0) {
        return NextResponse.json(
          { error: "You already have an active subscription." },
          { status: 409 },
        );
      }
    }

    let creemPriceId: string | undefined;
    // Add success=1 so client has a stable success signal on return
    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?success=1`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing`;

    if (kind === "subscription") {
      if (!isSubscriptionKey(key)) {
        return NextResponse.json({ error: "Invalid subscription key" }, { status: 400 });
      }
      const plan = subscriptionPlans[key];
      creemPriceId = plan.creemPriceId;
    } else if (kind === "one_time") {
      if (!isPackKey(key)) {
        return NextResponse.json({ error: "Invalid pack key" }, { status: 400 });
      }
      const pack = oneTimePacks[key];
      creemPriceId = pack.creemPriceId;
    } else {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }

    const { url } = await createCheckoutSession({
      userId,
      key,
      kind,
      successUrl,
      cancelUrl,
      creemPriceId,
    });

    return NextResponse.json({ url });
  } catch (error: unknown) {
    console.error("Creem checkout error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Server error") },
      { status: 500 }
    );
  }
}
