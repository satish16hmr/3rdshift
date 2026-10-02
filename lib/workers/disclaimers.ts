export const HUMAN_REVIEW_REQUIRED_DISCLAIMER = `> **HUMAN REVIEW REQUIRED**
>
> This draft is AI-generated and is not professional advice. Have a qualified human reviewer check the facts, legal/compliance implications, and final fit before using it for any hiring, legal, financial, or other high-stakes decision.`;

export function ensureHumanReviewDisclaimer(text: string): string {
  const trimmed = text.trimStart();
  if (trimmed.startsWith(HUMAN_REVIEW_REQUIRED_DISCLAIMER)) {
    return text;
  }

  const withoutLooseDisclaimer = trimmed.replace(/^>?\s*\*\*?HUMAN REVIEW REQUIRED\*\*?[\s\S]*?(?:\n\s*\n|$)/i, '');
  return `${HUMAN_REVIEW_REQUIRED_DISCLAIMER}\n\n${withoutLooseDisclaimer}`;
}
