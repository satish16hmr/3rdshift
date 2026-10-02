/**
 * Silas image resolution — Unsplash API with Lorem Picsum fallback.
 *
 * Called server-side during website generation (execute-task) and
 * exposed client-side via /api/website-builder/image-proxy for the
 * frontend to fetch section images on demand.
 *
 * Fallback chain:
 *   1. Unsplash API (keyword-relevant, high quality) — requires UNSPLASH_API_KEY
 *   2. Lorem Picsum (random, no keywords) — always works, used when Unsplash is
 *      unavailable / rate-limited / key not configured
 */

interface ImageResult {
  url: string;           // full URL ready to use in <img src>
  thumb?: string;        // small thumbnail (Unsplash only)
  credit?: string;       // photographer credit (Unsplash only)
  source: 'unsplash' | 'picsum';
}

/**
 * Resolve a keyword query to a real image URL.
 * @param query  - natural language keywords (e.g. "modern office workspace laptop")
 * @param width  - desired width in px
 * @param height - desired height in px
 * @param seed   - fallback Lorem Picsum seed (integer, for determinism)
 */
export async function resolveImage(
  query: string,
  width: number,
  height: number,
  seed: number = Math.floor(Math.random() * 1000)
): Promise<ImageResult> {
  const unsplashKey = process.env.UNSPLASH_API_KEY;

  // ── 1. Unsplash API ────────────────────────────────────────────────────────
  if (unsplashKey) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const res = await fetch(
        `https://api.unsplash.com/photos/random?query=${encodedQuery}&orientation=landscape&w=${width}&h=${height}`,
        {
          headers: { Authorization: `Client-ID ${unsplashKey}` },
          signal: AbortSignal.timeout(6000), // 6s timeout
        }
      );

      if (res.ok) {
        const data = await res.json() as {
          urls: { regular: string; thumb: string };
          user: { name: string };
          links: { html: string };
        };

        const url = `${data.urls.regular}&w=${width}&h=${height}&fit=crop&crop=entropy`;
        return {
          url,
          thumb: data.urls.thumb,
          credit: data.user?.name,
          source: 'unsplash',
        };
      }

      // Rate limit (429) or other error — fall through to picsum
      console.warn(`[Silas images] Unsplash ${res.status} for query "${query}" — falling back to Picsum`);
    } catch (err) {
      console.warn(`[Silas images] Unsplash fetch failed: ${err instanceof Error ? err.message : err} — falling back to Picsum`);
    }
  }

  // ── 2. Lorem Picsum fallback ───────────────────────────────────────────────
  return {
    url: `https://picsum.photos/${width}/${height}?random=${seed}`,
    source: 'picsum',
  };
}

/**
 * Build Unsplash query keywords for a given section type + page type.
 * Claude generates these in the artifact's images[] array — but if not available,
 * this provides sensible defaults per section context.
 */
export function defaultQueryForSection(sectionType: string, pageType: string): string {
  const sectionDefaults: Record<string, string> = {
    hero: 'modern professional workspace laptop clean desk',
    features: 'technology software interface dashboard minimal',
    social_proof: 'professional business team meeting office',
    testimonials: 'professional headshot business portrait confident',
    pricing: 'business growth success charts',
    about: 'founder entrepreneur working laptop coffee shop',
    services: 'professional service consultation handshake',
    process: 'workflow planning whiteboard strategy',
    contact: 'phone laptop office communication',
    cta: 'success achievement laptop celebration',
    footer: 'modern office building exterior',
    lead_magnet_hero: 'checklist notebook planning productivity',
    coming_soon_hero: 'launch rocket startup building',
    pain_agitation: 'stressed overwhelmed overworked laptop',
    desire: 'relaxed successful founder laptop beach',
    guarantee: 'handshake trust professional agreement',
  };

  const pageDefaults: Record<string, string> = {
    landing: 'modern saas dashboard interface laptop',
    coming_soon: 'startup launch countdown minimal clean',
    lead_magnet: 'ebook guide checklist download productivity',
    sales_page: 'business success results growth laptop',
    service_business: 'professional service team office clean',
  };

  return sectionDefaults[sectionType] || pageDefaults[pageType] || 'professional business minimal clean';
}
