
## Dual prompt source drift (identified 2026-04-29, commit cd9f711)

9 workers have dead `prompt.ts` files. The **inline `inlinePrompts` entry in `configs.ts` wins** for these workers, not the dedicated file:
`ecommerce-strategist`, `email-marketing-strategist`, `funnel-strategist`, `image-cleanup`, `linkedin-ghostwriter`, `market-research-analyst`, `product-description-writer`, `social-media-creator`, `website-builder`

All inline versions are correct and functional. The dead `.ts` files are post-launch hygiene — consolidation deferred.

**Rule going forward:** Any prompt change for these 9 workers must be made in `configs.ts` inlinePrompts, not in the `prompt.ts` file.
