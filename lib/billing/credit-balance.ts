function toNonNegativeCredits(value: number | null | undefined): number {
  const credits = Number(value ?? 0);
  return Number.isFinite(credits) ? Math.max(credits, 0) : 0;
}

export function calculatePlanCreditBalance(params: {
  planCredits: number;
  topupCreditsRemaining?: number | null;
}): number {
  const planCredits = toNonNegativeCredits(params.planCredits);
  return planCredits;
}

export function calculateAvailableCreditBalance(params: {
  planCreditsRemaining: number;
  topupCreditsRemaining?: number | null;
}): number {
  const planCreditsRemaining = toNonNegativeCredits(params.planCreditsRemaining);
  const topupCredits = toNonNegativeCredits(params.topupCreditsRemaining);
  return planCreditsRemaining + topupCredits;
}

export function getCreditDisplaySummary(params: {
  planCreditsRemaining: number;
  topupCreditsRemaining?: number | null;
  includedCreditsLimit: number;
}) {
  const planCreditsRemaining = toNonNegativeCredits(params.planCreditsRemaining);
  const topupCreditsRemaining = toNonNegativeCredits(params.topupCreditsRemaining);
  const includedCreditsLimit = toNonNegativeCredits(params.includedCreditsLimit);
  const availableCreditsRemaining = calculateAvailableCreditBalance({
    planCreditsRemaining,
    topupCreditsRemaining,
  });

  return {
    planCreditsRemaining,
    topupCreditsRemaining,
    includedCreditsLimit,
    availableCreditsRemaining,
    isDepleted: availableCreditsRemaining === 0,
    primaryText: `${availableCreditsRemaining} available`,
    breakdownText: topupCreditsRemaining > 0
      ? `${planCreditsRemaining}/${includedCreditsLimit} plan · ${topupCreditsRemaining} top-up`
      : `${planCreditsRemaining}/${includedCreditsLimit} plan`,
    breakdownCreditText: topupCreditsRemaining > 0
      ? `${planCreditsRemaining}/${includedCreditsLimit} plan `
      : `${planCreditsRemaining}/${includedCreditsLimit} plan`,
      breakdownTopUpText: topupCreditsRemaining > 0
      ? `· ${topupCreditsRemaining} top-up`
      : ``,
  };
}
