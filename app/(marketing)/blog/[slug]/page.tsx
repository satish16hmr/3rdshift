import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categoryHref, formatPostDate, getAllPosts, getPostBySlug, getRelatedPosts } from '@/lib/blog';
import { AnimateIn, AnimateStagger } from '@/app/(marketing)/_components/shared';
import BlogSubscribeForm from '../BlogSubscribeForm';
import TableOfContents from './TableOfContents';

const SITE_URL = 'https://3rdshift.ai';
const BLOG_INLINE_CTA = {
  heading: 'Get access to the team that takes your business to the next level',
  button: 'Get started →',
  href: '/pricing',
  ariaLabel: 'Get access to the 3rdShift team',
} as const;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const url = `${SITE_URL}/blog/${post.slug}`;
  const description = post.metaDescription || post.excerpt;
  const seoTitle = post.seoTitle || post.title;
  const coverUrl = `${SITE_URL}${post.coverImage}`;

  return {
    title: `${seoTitle} — 3rdShift Blog`,
    description,
    authors: [{ name: post.authorDetails.name, url: SITE_URL }],
    alternates: { canonical: url },
    openGraph: {
      title: seoTitle,
      description,
      url,
      type: 'article',
      publishedTime: post.date,
      authors: [post.authorDetails.name],
      section: post.category,
      images: [{ url: coverUrl, alt: seoTitle, width: 1200, height: 675 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description,
      images: [coverUrl],
    },
  };
}

function splitArticleHtml(html: string) {
  return html.split(/(?=<h2 id=")/g).filter(Boolean);
}

function wrapArticleTables(html: string) {
  return html.replace(/<table>/g, '<div class="blog-table-scroll"><table>').replace(/<\/table>/g, '</table></div>');
}

function RelatedPostsRow({ posts }: { posts: ReturnType<typeof getRelatedPosts> }) {
  if (posts.length === 0) return null;

  return (
    <section className="blog-related-bottom" aria-label="Keep reading">
      <AnimateIn className="blog-related-bottom-head" y={15}>
        <p className="blog-related-bottom-kicker">Keep reading</p>
      </AnimateIn>
      <AnimateStagger className="blog-related-bottom-grid">
        {posts.map((relatedPost) => (
          <AnimateIn key={relatedPost.slug} y={20}>
            <Link href={`/blog/${relatedPost.slug}`} className="blog-related-card">
              <div className="blog-related-card-img">
                <Image src={relatedPost.coverImage} alt="" width={720} height={405} sizes="(max-width: 768px) calc(100vw - 36px), 360px" />
              </div>
              <div className="blog-card-meta-row">
                <span className="blog-card-cat">{relatedPost.category}</span>
                <span className="blog-card-date">{formatPostDate(relatedPost.date)}</span>
              </div>
              <h3 className="blog-related-card-title">{relatedPost.title}</h3>
            </Link>
          </AnimateIn>
        ))}
      </AnimateStagger>
    </section>
  );
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post, 3);
  const shareUrl = `${SITE_URL}/blog/${post.slug}`;
  const shareTitle = encodeURIComponent(post.title);
  const tableOfContents = post.tableOfContents.filter((heading) => heading.level === 2);
  const articleSections = splitArticleHtml(wrapArticleTables(post.html));
  const h2SectionIndexes = articleSections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.trimStart().startsWith('<h2'))
    .map(({ index }) => index);
  const ctaInsertAfterIndex = h2SectionIndexes.at(-2) ?? h2SectionIndexes.at(-1) ?? Math.max(0, articleSections.length - 1);
  const articleSectionsBeforeCta = articleSections.slice(0, ctaInsertAfterIndex + 1);
  const articleSectionsAfterCta = articleSections.slice(ctaInsertAfterIndex + 1);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.seoTitle || post.title,
    description: post.metaDescription || post.excerpt,
    image: [`${SITE_URL}${post.coverImage}`],
    datePublished: post.date,
    dateModified: post.date,
    author: {
      '@type': 'Person',
      name: post.authorDetails.name,
      jobTitle: post.authorDetails.role,
      image: `${SITE_URL}${post.authorDetails.avatar}`,
    },
    publisher: {
      '@type': 'Organization',
      name: '3rdShift',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo-og.png`,
      },
    },
    mainEntityOfPage: shareUrl,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="blog-article" id="top">
        <header className="blog-article-hero">
          <AnimateStagger className="blog-article-hero-copy">
            <AnimateIn>
              <div className="blog-article-top-meta">
                <Link className="blog-article-cat" href={categoryHref(post.category)}>{post.category}</Link>
                <span className="blog-article-top-date">{formatPostDate(post.date)}</span>
                <span className="blog-article-top-date">{post.readingTime}</span>
              </div>
            </AnimateIn>
            <AnimateIn delay={0.1}>
              <h1 className="blog-article-title">{post.title}</h1>
            </AnimateIn>
            <AnimateIn delay={0.2}>
              <p className="blog-article-excerpt">{post.excerpt}</p>
            </AnimateIn>
            <AnimateIn delay={0.3}>
              <div className="blog-article-author-block">
                <div className="blog-article-author-avatar">
                  <Image src={post.authorDetails.avatar} alt={`${post.authorDetails.name} avatar`} width={112} height={112} sizes="56px" />
                </div>
                <div>
                  <p className="blog-article-author-name">{post.authorDetails.name}</p>
                  <p className="blog-article-author-role">{post.authorDetails.role}</p>
                </div>
              </div>
            </AnimateIn>
          </AnimateStagger>

          <AnimateIn delay={0.2} y={30} className="blog-article-feature-img">
            <Image src={post.coverImage} alt="" width={1600} height={900} priority sizes="(max-width: 1024px) calc(100vw - 48px), 520px" />
          </AnimateIn>
        </header>

        <div className="blog-article-shell">
          <div className="blog-article-toc-rail">
            {tableOfContents.length > 0 && (
              <AnimateIn delay={0.35} x={-20} y={0}>
                <TableOfContents
                  headings={tableOfContents}
                  className="blog-toc"
                  ariaLabelledBy="blog-toc-title"
                  titleId="blog-toc-title"
                />
              </AnimateIn>
            )}
          </div>

          <AnimateIn delay={0.35} y={20} className="blog-article-main">
            <div>
              <div className="blog-article-content">
                {articleSectionsBeforeCta.map((section, index) => (
                  <Fragment key={`${post.slug}-section-${index}`}>
                    <div dangerouslySetInnerHTML={{ __html: section }} />
                  </Fragment>
                ))}

                <section className="blog-inline-cta" aria-label={BLOG_INLINE_CTA.ariaLabel}>
                  <p>{BLOG_INLINE_CTA.heading}</p>
                  <Link href={BLOG_INLINE_CTA.href}>{BLOG_INLINE_CTA.button}</Link>
                </section>

                {articleSectionsAfterCta.map((section, index) => (
                  <Fragment key={`${post.slug}-section-after-cta-${index}`}>
                    <div dangerouslySetInnerHTML={{ __html: section }} />
                  </Fragment>
                ))}
              </div>

              <section className="blog-explore-topics" aria-labelledby="blog-explore-title">
                <p id="blog-explore-title" className="blog-explore-label">Explore more on</p>
                <div className="blog-topic-tags">
                  <Link href={categoryHref(post.category)} className="blog-topic-tag">{post.category}</Link>
                </div>
              </section>

              <aside className="blog-author-note" aria-label="About the author">
                <div className="blog-article-author-avatar">
                  <Image src={post.authorDetails.avatar} alt={`${post.authorDetails.name} avatar`} width={112} height={112} sizes="56px" />
                </div>
                <div>
                  <p className="blog-author-note-kicker">About the author</p>
                  <p className="blog-article-author-name">{post.authorDetails.name}</p>
                  <p className="blog-article-author-role">{post.authorDetails.role}</p>
                  <p className="blog-author-note-bio">{post.authorDetails.bio}</p>
                </div>
              </aside>
            </div>
          </AnimateIn>

          <div className="blog-article-sidebar">
            <AnimateIn delay={0.45} x={20} y={0}>
              <BlogSubscribeForm source={post.slug} shareUrl={shareUrl} shareTitle={shareTitle} />
            </AnimateIn>
          </div>
        </div>

        <AnimateIn delay={0.3} y={20} className="blog-article-mobile-main hidden">
          <div>
            {tableOfContents.length > 0 && (
              <TableOfContents
                headings={tableOfContents}
                className="blog-toc blog-mobile-toc"
                ariaLabelledBy="blog-mobile-toc-title"
                titleId="blog-mobile-toc-title"
              />
            )}

            <section className="blog-inline-cta blog-mobile-inline-cta" aria-label={BLOG_INLINE_CTA.ariaLabel}>
              <p>{BLOG_INLINE_CTA.heading}</p>
              <Link href={BLOG_INLINE_CTA.href}>{BLOG_INLINE_CTA.button}</Link>
            </section>

            <div className="blog-article-content">
              {articleSections.map((section, index) => (
                <Fragment key={`${post.slug}-mobile-section-${index}`}>
                  <div dangerouslySetInnerHTML={{ __html: section }} />
                </Fragment>
              ))}
            </div>

            <aside className="blog-mobile-newsletter" aria-label="Weekly newsletter">
              <BlogSubscribeForm source={post.slug} shareUrl={shareUrl} shareTitle={shareTitle} />
            </aside>

            <aside className="blog-author-note" aria-label="About the author">
              <div className="blog-article-author-avatar">
                <Image src={post.authorDetails.avatar} alt={`${post.authorDetails.name} avatar`} width={112} height={112} sizes="56px" />
              </div>
              <div>
                <p className="blog-author-note-kicker">About the author</p>
                <p className="blog-article-author-name">{post.authorDetails.name}</p>
                <p className="blog-article-author-role">{post.authorDetails.role}</p>
                <p className="blog-author-note-bio">{post.authorDetails.bio}</p>
              </div>
            </aside>

            <section className="blog-explore-topics" aria-labelledby="blog-mobile-explore-title">
              <p id="blog-mobile-explore-title" className="blog-explore-label">Explore more on</p>
              <div className="blog-topic-tags">
                <Link href={categoryHref(post.category)} className="blog-topic-tag">{post.category}</Link>
              </div>
            </section>
          </div>
        </AnimateIn>

        <RelatedPostsRow posts={related} />
      </article>
    </>
  );
}
