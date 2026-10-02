import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

export type BlogAuthorId = 'ava' | 'josh' | 'ellis';

export interface BlogAuthor {
  id: BlogAuthorId;
  name: string;
  role: string;
  avatar: string;
  bio: string;
}

export interface BlogHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export const BLOG_AUTHORS: Record<BlogAuthorId, BlogAuthor> = {
  ava: {
    id: 'ava',
    name: 'Ava',
    role: 'Article Writer',
    avatar: '/images/marketing/workers-figma/ava.png',
    bio: "Ava is 3rdShift's AI Article Writer, one of 70+ specialized team members. She turns a topic and a brief into publish-ready content in seconds.",
  },
  josh: {
    id: 'josh',
    name: 'Josh Rager',
    role: '3rdShift Founder',
    avatar: '/images/avatars/josh-rager-founder.png',
    bio: 'Josh Rager is the founder of 3rdShift. He writes about building lean, delegating to AI, and running a business without a traditional team.',
  },
  ellis: {
    id: 'ellis',
    name: 'Ellis',
    role: 'Email Marketer',
    avatar: '/images/marketing/workers-figma/ellis.png',
    bio: "Ellis is 3rdShift's AI Email Marketer, built to turn campaigns, newsletters, and sequences into ready-to-send email work.",
  },
};

export const BLOG_CATEGORY_ORDER = [
  'AI Workers',
  'Content & Marketing',
  'Growth & SEO',
  'Automation & Workflows',
  'Founder Playbook',
] as const;

export interface BlogPostFrontmatter {
  title: string;
  slug: string;
  category: string;
  date: string;
  excerpt: string;
  coverImage: string;
  author?: BlogAuthorId;
  featured?: boolean;
  metaDescription?: string;
  seoTitle?: string;
}

export interface BlogPost extends BlogPostFrontmatter {
  author: BlogAuthorId;
  authorDetails: BlogAuthor;
  content: string;
  html: string;
  readingTime: string;
  tableOfContents: BlogHeading[];
}

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

function parseFrontmatter(raw: string): { data: Record<string, string | boolean>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Blog MDX file is missing frontmatter delimiters.');
  }

  const data: Record<string, string | boolean> = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf(':');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (rawValue === 'true') {
      data[key] = true;
    } else if (rawValue === 'false') {
      data[key] = false;
    } else {
      data[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  }

  return { data, content: match[2].trim() };
}

function normalizeAuthor(author: string | boolean | undefined): BlogAuthorId {
  if (author === 'josh') return 'josh';
  if (author === 'ellis') return 'ellis';
  return 'ava';
}

function estimateReadingTime(content: string): string {
  const words = content.replace(/```[\s\S]*?```/g, '').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 220))} min read`;
}

function plainTextFromMarkdown(value: string): string {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim();
}

function slugifyHeading(value: string): string {
  return plainTextFromMarkdown(value)
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function uniqueId(base: string, counts: Map<string, number>): string {
  const count = counts.get(base) ?? 0;
  counts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function extractTableOfContents(content: string): BlogHeading[] {
  const counts = new Map<string, number>();
  const headings: BlogHeading[] = [];
  const headingPattern = /^(##|###)\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(content)) !== null) {
    const text = plainTextFromMarkdown(match[2]);
    headings.push({
      id: uniqueId(slugifyHeading(text), counts),
      text,
      level: match[1] === '##' ? 2 : 3,
    });
  }
  return headings;
}

function addHeadingIds(html: string): string {
  const counts = new Map<string, number>();
  return html.replace(/<h([23])>(.*?)<\/h\1>/g, (_match, level: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '');
    const id = uniqueId(slugifyHeading(text), counts);
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
}

function mdxToHtml(content: string): string {
  marked.setOptions({
    gfm: true,
    breaks: false,
  });
  const html = marked.parse(content, { async: false }) as string;
  return addHeadingIds(html);
}

function postFromFile(filePath: string): BlogPost {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  const author = normalizeAuthor(data.author);

  const required = ['title', 'slug', 'category', 'date', 'excerpt', 'coverImage'];
  for (const key of required) {
    if (!data[key]) {
      throw new Error(`${path.basename(filePath)} is missing required frontmatter field: ${key}`);
    }
  }

  return {
    title: String(data.title),
    slug: String(data.slug),
    category: String(data.category),
    date: String(data.date),
    excerpt: String(data.excerpt),
    coverImage: String(data.coverImage),
    featured: data.featured === true,
    metaDescription: data.metaDescription ? String(data.metaDescription) : String(data.excerpt),
    seoTitle: data.seoTitle ? String(data.seoTitle) : undefined,
    author,
    authorDetails: BLOG_AUTHORS[author],
    content,
    html: mdxToHtml(content),
    readingTime: estimateReadingTime(content),
    tableOfContents: extractTableOfContents(content),
  };
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => postFromFile(path.join(BLOG_DIR, file)))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getFeaturedPost(posts = getAllPosts()): BlogPost | null {
  return posts.find((post) => post.featured) ?? posts[0] ?? null;
}

export function getPostBySlug(slug: string): BlogPost | null {
  return getAllPosts().find((post) => post.slug === slug) ?? null;
}

export function getCategories(posts: BlogPost[]): string[] {
  const cats = new Set(posts.map((post) => post.category));
  const ordered = BLOG_CATEGORY_ORDER.filter((cat) => cats.has(cat));
  const remaining = Array.from(cats).filter((cat) => !BLOG_CATEGORY_ORDER.includes(cat as typeof BLOG_CATEGORY_ORDER[number])).sort((a, b) => a.localeCompare(b));
  return ['All', ...ordered, ...remaining];
}

export function getRelatedPosts(post: BlogPost, limit = 3): BlogPost[] {
  return getAllPosts()
    .filter((candidate) => candidate.slug !== post.slug)
    .sort((a, b) => {
      if (a.category === post.category && b.category !== post.category) return -1;
      if (b.category === post.category && a.category !== post.category) return 1;
      return a.date < b.date ? 1 : -1;
    })
    .slice(0, limit);
}

export function formatPostDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function categoryHref(category: string): string {
  return `/blog?category=${encodeURIComponent(category)}`;
}
