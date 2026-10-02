'use client';

import { useMemo, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

import { Button } from '@/components/ui/button';
import type { BlogPost } from '@/lib/blog';
import { Pagination } from '@/components/pagination';
import { AnimateIn } from '@/app/(marketing)/_components/shared';

function formatPostDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const POSTS_PER_PAGE = 6;

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="blog-card">
      <div className="blog-card-img">
        <Image
          src={post.coverImage}
          alt=""
          width={720}
          height={405}
          sizes="(max-width: 768px) 100vw, 420px"
        />
      </div>

      <div className="blog-card-meta-row">
        <span className="blog-card-cat">{post.category}</span>
        <span className="blog-card-date">{formatPostDate(post.date)}</span>
        <span className="blog-card-date">{post.readingTime}</span>
      </div>

      <h3 className="blog-card-title">{post.title}</h3>

      <p className="blog-card-excerpt">{post.excerpt}</p>

      <div className="blog-card-author">
        <div className="blog-card-author-avatar">
          <Image
            src={post.authorDetails.avatar}
            alt={`${post.authorDetails.name} avatar`}
            width={80}
            height={80}
            sizes="40px"
          />
        </div>

        <div>
          <p className="blog-card-author-name">
            {post.authorDetails.name}
          </p>
          <p className="blog-card-author-role">
            {post.authorDetails.role}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function BlogIndexClient({
  posts,
  categories,
}: {
  posts: BlogPost[];
  categories: string[];
}) {
  const searchParams = useSearchParams();
  const blogMainRef = useRef<HTMLElement>(null);

  const requestedCategory = searchParams.get('category') ?? 'All';

  const [activeCategory, setActiveCategory] = useState(
    categories.includes(requestedCategory)
      ? requestedCategory
      : 'All'
  );

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesCategory =
        activeCategory === 'All' ||
        post.category === activeCategory;

      const matchesSearch =
        !query ||
        [post.title, post.excerpt, post.category].some((value) =>
          value.toLowerCase().includes(query)
        );

      return matchesCategory && matchesSearch;
    });
  }, [posts, activeCategory, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / POSTS_PER_PAGE)
  );

  const paginated = filtered.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setTimeout(() => {
      if (blogMainRef.current) {
        const yOffset = -80; // Offset to account for sticky header height (64px) + safety buffer
        const y = blogMainRef.current.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 10);
  };

  const handleCatChange = (cat: string) => {
    setActiveCategory(cat);
    setCurrentPage(1);

    const url =
      cat === 'All'
        ? '/blog'
        : `/blog?category=${encodeURIComponent(cat)}`;

    window.history.replaceState(null, '', url);
  };

  const handleSearch = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  return (
    <section ref={blogMainRef} className="blog-main">
      <div className="blog-main-inner">
        <AnimateIn className="blog-sidebar" x={-20} y={0}>
          <aside aria-label="Blog filters">
            <div className="blog-sidebar-card">
              <div className="blog-search-wrap">
                <svg
                  className="blog-search-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="6.5"
                    cy="6.5"
                    r="4.5"
                    stroke="#a1a1aa"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M10 10l3.5 3.5"
                    stroke="#a1a1aa"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  type="search"
                  placeholder="Search articles"
                  value={search}
                  onChange={handleSearch}
                  className="blog-search"
                  aria-label="Search articles"
                />
              </div>

              <p className="blog-cats-heading">
                Categories
              </p>

              <div className="blog-cats">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCatChange(cat)}
                    className={`blog-cat-btn${activeCategory === cat ? ' active' : ''
                      }`}
                  >
                    {cat === 'All'
                      ? 'All Articles'
                      : cat}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </AnimateIn>

        <div className="blog-grid-wrap">
          {paginated.length === 0 ? (
            <div className="blog-empty">
              No articles found.
            </div>
          ) : (
            <motion.div
              key={`${activeCategory}-${currentPage}-${search}`}
              className="blog-grid"
              variants={{
                initial: {},
                animate: {
                  transition: {
                    staggerChildren: 0.05,
                    delayChildren: 0.35
                  }
                }
              }}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-50px" }}
            >
              {paginated.map((post) => (
                <motion.div
                  key={post.slug}
                  variants={{
                    initial: { opacity: 0, y: 16 },
                    animate: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.35, ease: "easeOut" }
                    }
                  }}
                >
                  <BlogCard post={post} />
                </motion.div>
              ))}
            </motion.div>
          )}

          {totalPages > 1 && (
            <AnimateIn delay={0.15} y={15} className="w-full">
              <div className="flex gap-2 sm:gap-4 items-center justify-between border-t border-zinc-200 pt-3! sm:pt-4! md:pt-5.5! bg-white mt-12! sm:mt-14! md:mt-16! sm:mb-8! lg:mb-0!">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                  disabled={currentPage === 1}
                  className="w-9! sm:w-[111px]!"
                >
                  <span className='flex'><ArrowLeft className='h-4' /></span>
                  <span className='hidden sm:flex'>Previous</span>
                </Button>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  className="justify-center!"
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="w-9! sm:w-[84px]!"
                >
                  <span className='hidden sm:flex'>Next</span>
                  <span className='flex'><ArrowRight className='h-4' /></span>
                </Button>
              </div>
            </AnimateIn>
          )}
        </div>
      </div>
    </section>
  );
}