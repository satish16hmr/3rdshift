import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/api/',
          '/auth/',
          '/screenshot-preview/',
          '/docs/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
