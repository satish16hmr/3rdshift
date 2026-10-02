import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getAllPosts, getCategories, getFeaturedPost, formatPostDate } from '@/lib/blog';
import { AnimateIn, AnimateStagger } from '@/app/(marketing)/_components/shared';
import BlogIndexClient from './BlogIndexClient';
import { CrewSection } from '../pricing/page';
import { FaqSection } from '../_components/FaqSection';

const BLOG_DESCRIPTION = 'Practical articles on delegation, automation, content, and growing with 70+ AI team members.';

export const metadata: Metadata = {
  title: 'Blog — 3rdShift',
  description: BLOG_DESCRIPTION,
  alternates: { canonical: 'https://3rdshift.ai/blog' },
  openGraph: {
    title: 'Blog — 3rdShift',
    description: BLOG_DESCRIPTION,
    url: 'https://3rdshift.ai/blog',
    type: 'website',
    images: ['/logo-og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog — 3rdShift',
    description: BLOG_DESCRIPTION,
    images: ['/logo-og.png'],
  },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const categories = getCategories(posts);
  const featured = getFeaturedPost(posts);
  const gridPosts = featured ? posts.filter((post) => post.slug !== featured.slug) : posts;

  return (
    <>
      <section className="blog-hero" id="top">
        <AnimateStagger className="blog-hero-inner">
          <AnimateIn>
            <p className="blog-kicker">3rdShift Blog</p>
          </AnimateIn>
          <AnimateIn delay={0.1}>
            <h1 className="blog-hero-headline">How to build more with fewer people</h1>
          </AnimateIn>
          <AnimateIn delay={0.2}>
            <p className="blog-hero-sub">{BLOG_DESCRIPTION}</p>
          </AnimateIn>
        </AnimateStagger>

        {featured && (
          <AnimateIn delay={0.3} y={30} className="blog-featured-wrap">
            <Link href={`/blog/${featured.slug}`} className="blog-featured-link">
              <div className="blog-featured-image-wrap">
                <Image
                  className="blog-featured-img"
                  src={featured.coverImage}
                  alt=""
                  width={1200}
                  height={675}
                  priority
                  sizes="(max-width: 1280px) calc(100vw - 48px), 1200px"
                />
              </div>
              <div className="blog-featured-card">
                <div className="blog-featured-card-body">
                  <div className="blog-featured-meta">
                    <span className="blog-featured-cat">{featured.category}</span>
                    <span className="blog-featured-date">{formatPostDate(featured.date)}</span>
                    <span className="blog-featured-date">{featured.readingTime}</span>
                  </div>
                  <h2 className="blog-featured-title">{featured.title}</h2>
                  <p className="blog-featured-excerpt">{featured.excerpt}</p>
                </div>
                <div className="blog-featured-author">
                  <div className="blog-featured-author-avatar">
                    <Image src={featured.authorDetails.avatar} alt={`${featured.authorDetails.name} avatar`} width={88} height={88} sizes="44px" />
                  </div>
                  <div className="blog-featured-author-info">
                    <p className="blog-featured-author-name">{featured.authorDetails.name}</p>
                    <p className="blog-featured-author-role">{featured.authorDetails.role}</p>
                  </div>
                </div>
              </div>
            </Link>
          </AnimateIn>
        )}
      </section>

      <Suspense fallback={null}>
        <BlogIndexClient posts={gridPosts} categories={categories} />
        <FaqSection />
      </Suspense>

    </>
  );
}
