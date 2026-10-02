'use client';
// TEMP: Screenshot preview — delete after screenshots taken

const categories = ['All', 'Content & Writing', 'Social Media', 'Sales & Leads', 'Research', 'Design', 'Video & Media'];

const recentWorkers = [
  { emoji: '✍️', tint: 'bg-blue-50', name: 'Article Writer', workerName: 'Ava', desc: 'SEO-optimized blog posts, articles, and long-form content in your brand voice.' },
  { emoji: '📧', tint: 'bg-emerald-50', name: 'Cold Email Writer', workerName: 'Sage', desc: 'High-converting cold email sequences for any industry or offer.' },
  { emoji: '🔍', tint: 'bg-amber-50', name: 'Competitor Tracker', workerName: 'Zane', desc: 'Deep competitor analysis and market positioning reports.' },
];

const workers = [
  { emoji: '✍️', tint: 'bg-blue-50', name: 'Article Writer', workerName: 'Ava', desc: 'SEO-optimized blog posts, articles, and long-form content in your brand voice.' },
  { emoji: '📱', tint: 'bg-purple-50', name: 'Social Media Manager', workerName: 'Mira', desc: 'Scroll-stopping posts, carousels, and captions for any platform.' },
  { emoji: '📧', tint: 'bg-emerald-50', name: 'Cold Email Writer', workerName: 'Sage', desc: 'High-converting cold email sequences for any industry or offer.' },
  { emoji: '🔍', tint: 'bg-amber-50', name: 'Competitor Tracker', workerName: 'Zane', desc: 'Deep competitor analysis and market positioning reports.' },
  { emoji: '📊', tint: 'bg-teal-50', name: 'Market Research Analyst', workerName: 'Duncan', desc: 'Comprehensive market research reports with data-backed insights.' },
  { emoji: '🎯', tint: 'bg-emerald-50', name: 'Lead Generator', workerName: 'Lenny', desc: 'Qualified prospect lists with contact details for any niche.' },
  { emoji: '🎨', tint: 'bg-pink-50', name: 'Ad Copy Writer', workerName: 'Quinn', desc: 'High-converting ad copy for Facebook, Google, and LinkedIn.' },
  { emoji: '📰', tint: 'bg-indigo-50', name: 'Newsletter Writer', workerName: 'Tate', desc: 'Engaging email newsletters your subscribers actually want to read.' },
  { emoji: '💼', tint: 'bg-slate-50', name: 'LinkedIn Ghostwriter', workerName: 'Oscar', desc: 'Thought leadership posts that build authority and drive engagement.' },
  { emoji: '🖼️', tint: 'bg-rose-50', name: 'AI Image Generator', workerName: 'Jude', desc: 'Professional images and visuals generated from your description.' },
  { emoji: '🎬', tint: 'bg-red-50', name: 'YouTube Assistant', workerName: 'Reese', desc: 'Scripts, titles, descriptions, and thumbnails for YouTube success.' },
  { emoji: '🧠', tint: 'bg-violet-50', name: 'Research Assistant', workerName: 'Nash', desc: 'Fast, thorough research on any topic with structured summaries.' },
  { emoji: '📈', tint: 'bg-orange-50', name: 'SEO Keyword Researcher', workerName: 'Iris', desc: 'Find high-value keywords and content gaps for any market.' },
  { emoji: '🎤', tint: 'bg-sky-50', name: 'Podcast Scriptwriter', workerName: 'Lane', desc: 'Engaging podcast scripts, episode outlines, and show notes.' },
  { emoji: '🗂️', tint: 'bg-zinc-50', name: 'Admin Assistant', workerName: 'Joss', desc: 'Drafts, summaries, Standard Operating Procedures (SOPs), and internal docs — done in seconds.' },
];

function WorkerCard({ emoji, tint, name, workerName, desc }: any) {
  return (
    <div className="group relative flex flex-col rounded-xl border border-zinc-950/[0.08] bg-white p-6 shadow hover:shadow-lg hover:-translate-y-1 hover:border-zinc-950/15 transition-all duration-200 ease-in-out cursor-pointer">
      <span className={`flex size-11 items-center justify-center rounded-xl text-xl ${tint}`}>{emoji}</span>
      <p className="mt-4 text-sm font-semibold text-zinc-950">{name}</p>
      <p className="mt-1.5 flex-1 text-sm text-zinc-500">{desc}</p>
      <p className="mt-5 text-xs text-zinc-400">
        Powered by <span className="font-medium text-zinc-500">{workerName}</span>
      </p>
    </div>
  );
}

export default function WorkersPreview() {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-950">Team</h1>
        <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Pro</span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">Browse and launch your AI team members.</p>

      {/* Pick up where you left off */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-950 mb-3">Pick up where you left off</h2>
        <div className="grid grid-cols-3 gap-4">
          {recentWorkers.map((w, i) => (
            <div key={i} className="flex flex-col rounded-xl border-l-4 border-l-blue-600 border border-zinc-950/[0.08] bg-white p-5 shadow cursor-pointer hover:shadow-md transition-all">
              <span className={`flex size-10 items-center justify-center rounded-xl text-lg ${w.tint}`}>{w.emoji}</span>
              <p className="mt-3 text-sm font-semibold text-zinc-950">{w.name}</p>
              <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{w.desc}</p>
              <p className="mt-3 text-xs text-blue-600 font-medium">Continue →</p>
            </div>
          ))}
        </div>
      </div>

      <hr className="my-6 border-zinc-200" />

      {/* Search + filter */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 shadow-sm">
          <svg className="size-4 text-zinc-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" /></svg>
          <span className="text-sm text-zinc-400">Search team members...</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat, i) => (
            <button key={cat} className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${i === 0 ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-950/10 text-zinc-600 hover:border-zinc-950/20'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Worker grid */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {workers.map((w, i) => <WorkerCard key={i} {...w} />)}
      </div>
    </>
  );
}
