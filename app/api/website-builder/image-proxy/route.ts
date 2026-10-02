import { NextRequest, NextResponse } from 'next/server';
import { resolveImage, defaultQueryForSection } from '@/lib/workers/website-builder/images';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/website-builder/image-proxy
 * Server-side proxy — keeps UNSPLASH_API_KEY off the client.
 *
 * Query params:
 *   q        - keyword query (e.g. "modern office workspace")
 *   w        - width (default 1200)
 *   h        - height (default 600)
 *   seed     - Lorem Picsum fallback seed (default random)
 *   section  - section type (for default query fallback)
 *   page     - page type (for default query fallback)
 *
 * Returns: { url, source, credit? }
 * No auth required — image URLs are public.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const width = Math.min(Math.max(parseInt(searchParams.get('w') || '1200', 10) || 1200, 200), 2000);
  const height = Math.min(Math.max(parseInt(searchParams.get('h') || '600', 10) || 600, 200), 2000);
  const seed = parseInt(searchParams.get('seed') || String(Math.floor(Math.random() * 1000)), 10);
  const sectionType = searchParams.get('section') || '';
  const pageType = searchParams.get('page') || '';

  const resolvedQuery = query || defaultQueryForSection(sectionType, pageType);

  try {
    const result = await resolveImage(resolvedQuery, width, height, seed);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // cache 1h per query
      },
    });
  } catch (err) {
    // Hard fallback — should never reach here since resolveImage always returns picsum
    const fallbackUrl = `https://picsum.photos/${width}/${height}?random=${seed}`;
    return NextResponse.json({ url: fallbackUrl, source: 'picsum' });
  }
}
