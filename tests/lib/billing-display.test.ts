import {
  DEFAULT_ONE_TIME_PACK_KEY,
  getDefaultOneTimePack,
  getSubscriptionPlanDisplays,
  MARKETING_SUBSCRIPTION_PLAN_FAMILIES,
} from "@/lib/billing-display";

describe("getDefaultOneTimePack", () => {
  it("returns the configured default pack key", () => {
    expect(DEFAULT_ONE_TIME_PACK_KEY).toBe("pack_100");
  });

  it("returns the pack values from billing config", () => {
    expect(getDefaultOneTimePack()).toEqual({
      key: "pack_100",
      pack: {
        key: "pack_100",
        kind: "one_time",
        priceCents: 500,
        currency: "usd",
        credits: 100,
        creemPriceId: "prod_6KOKpJVJpPE8OZJjxomp0i",
      },
      displayCredits: "100",
      displayPrice: "$5",
    });
  });
});

describe("getSubscriptionPlanDisplays", () => {
  it("only exposes subscription families that exist in billing config", () => {
    expect(MARKETING_SUBSCRIPTION_PLAN_FAMILIES).toEqual([
      {
        id: "starter",
        monthlyKey: "starter_monthly",
        yearlyKey: "starter_yearly",
        featured: false,
      },
    ]);
  });

  it("derives marketing prices and credits from the real billing plans", () => {
    expect(getSubscriptionPlanDisplays()).toEqual([
      {
        id: "starter",
        monthlyKey: "starter_monthly",
        yearlyKey: "starter_yearly",
        featured: false,
        monthlyPlan: {
          key: "starter_monthly",
          kind: "subscription",
          priceCents: 2900,
          currency: "usd",
          creditsPerCycle: 1000,
          cycle: "month",
          creemPriceId: "prod_15Lg98rscWbq43aOg1GSu3",
          grantSchedule: { mode: "per_cycle" },
        },
        yearlyPlan: {
          key: "starter_yearly",
          kind: "subscription",
          priceCents: 29000,
          currency: "usd",
          creditsPerCycle: 12000,
          cycle: "year",
          creemPriceId: "prod_400Ofo5usOjFq2ZWcqJrpy",
          grantSchedule: {
            mode: "installments",
            grantsPerCycle: 12,
            intervalMonths: 1,
            creditsPerGrant: 1000,
            initialGrants: 1,
          },
        },
        displayMonthlyPrice: "$29",
        displayYearlyPrice: "$290",
        displayMonthlyCredits: "1,000",
        displayYearlyCredits: "12,000",
        displayYearlyCreditsPerGrant: "1,000",
      },
    ]);
  });
});
