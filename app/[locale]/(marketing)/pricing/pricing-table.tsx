"use client";

import { useTranslations } from "next-intl";
import { getDefaultOneTimePack, getSubscriptionPlanDisplays } from "@/lib/billing-display";

export function PricingTable() {
  const t = useTranslations("pricing");
  const starterPlan = getSubscriptionPlanDisplays()[0];
  const defaultPack = getDefaultOneTimePack();

  if (!starterPlan) return null;

  const tiers = [
    { id: starterPlan.id, name: t(`tiers.${starterPlan.id}.name`) },
    { id: defaultPack.key, name: t("tiers.credits.name") },
  ];
  const rows = [
    [t("comparison.rows.purchaseType"), t("comparison.values.subscription"), t("comparison.values.oneTime")],
    [t("comparison.rows.monthlyPrice"), starterPlan.displayMonthlyPrice, defaultPack.displayPrice],
    [t("comparison.rows.yearlyPrice"), starterPlan.displayYearlyPrice, t("comparison.values.notApplicable")],
    [t("comparison.rows.monthlyCredits"), t("comparison.values.creditsPerMonth", { credits: starterPlan.displayMonthlyCredits }), t("comparison.values.oneTimeCredits", { credits: defaultPack.displayCredits })],
    [t("comparison.rows.yearlyCredits"), t("comparison.values.creditsPerYear", { credits: starterPlan.displayYearlyCredits }), t("comparison.values.notApplicable")],
    [t("comparison.rows.delivery"), t("comparison.values.yearlyInstallments", { credits: starterPlan.displayYearlyCreditsPerGrant }), t("comparison.values.instantAfterPayment")],
    [t("comparison.rows.bestFor"), t("comparison.values.bestForStarter"), t("comparison.values.bestForCredits")],
  ];

  return (
    <div className="relative z-20 mx-auto w-full px-4 py-28">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr>
              <th className="py-3.5 text-left text-2xl font-extrabold text-foreground" />
              {tiers.map((tier) => (
                <th key={tier.id} className="px-3 py-3.5 text-center text-lg font-semibold text-foreground">
                  {tier.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(([title, starter, pack]) => (
              <tr key={title}>
                <td className="whitespace-nowrap py-4 pr-3 text-sm font-medium text-foreground">{title}</td>
                <td className="whitespace-nowrap px-3 py-4 text-center text-sm text-muted-foreground">{starter}</td>
                <td className="whitespace-nowrap px-3 py-4 text-center text-sm text-muted-foreground">{pack}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
