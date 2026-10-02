'use client';
// TEMP: Screenshot preview — delete after screenshots taken

export default function TaskFormPreview() {
  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
        <span className="hover:text-zinc-900 cursor-pointer">Team</span>
        <span>›</span>
        <span className="text-zinc-900 font-medium">Ava — Article Writer</span>
      </nav>

      {/* Worker header */}
      <div className="flex items-center gap-4 mb-6">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">✍️</span>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Article Writer</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Powered by <span className="font-medium text-zinc-700">Ava</span> · Unlimited tasks</p>
        </div>
        <span className="ml-auto inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Light Task</span>
      </div>

      {/* Form / Chat toggle */}
      <div className="flex items-center gap-1 border-b border-zinc-200 mb-6">
        <button className="px-5 py-2.5 text-sm font-medium border-b-2 border-blue-600 text-blue-600 -mb-px">
          Form
        </button>
        <button className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 border-transparent text-zinc-500 -mb-px">
          Chat
          <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">NEW</span>
        </button>
      </div>

      {/* Form */}
      <div className="grid grid-cols-3 gap-6">
        {/* Main form */}
        <div className="col-span-2 flex flex-col gap-5">
          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1.5">Topic / Title</label>
            <div className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm">
              Q2 Product Launch Blog Post
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1.5">Description <span className="text-zinc-400 font-normal">(what should this cover?)</span></label>
            <div className="rounded-lg border border-blue-500 ring-2 ring-blue-500/20 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm min-h-[120px] leading-relaxed">
              Write a blog post announcing our new enterprise features. Target audience is CTOs and engineering leads. Tone should be professional but approachable. Include sections on: new API endpoints, team collaboration features, and security improvements.
            </div>
            <p className="mt-1 text-xs text-zinc-400 text-right">283 / 2000 characters</p>
          </div>

          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1.5">Target Audience</label>
            <div className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm">
              CTOs, Engineering Leads, Technical Decision Makers
            </div>
          </div>

          {/* Writing style */}
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1.5">Writing Style Reference <span className="text-zinc-400 font-normal">(optional)</span></label>
            <div className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-700 shadow-sm">
              Match our existing blog tone — direct, technical but accessible
            </div>
          </div>

          {/* Word count */}
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1.5">Approximate Word Count</label>
            <div className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm w-48">
              800 — 1,200 words
            </div>
          </div>

          <hr className="border-zinc-200" />

          {/* Run button */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">This is a light task — no credits used</p>
            <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors">
              Run Task →
            </button>
          </div>

          {/* Tips */}
          <div className="rounded-xl border border-zinc-950/[0.06] bg-zinc-50 p-5">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Tips for better results</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '🎯', tip: 'Be specific about your audience — job title, industry, and pain points.' },
                { icon: '✍️', tip: 'Include a sample of your existing content so Ava can match your voice.' },
                { icon: '📐', tip: 'Specify length in words, not vague terms like "long" or "short."' },
                { icon: '🔗', tip: 'Add a competitor URL to reference — Ava will use it for positioning.' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-base mt-0.5">{item.icon}</span>
                  <p className="text-xs text-zinc-500 leading-relaxed">{item.tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Context sidebar */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-zinc-950/[0.08] bg-white p-5 shadow">
            <p className="text-sm font-semibold text-zinc-900 mb-3">About Ava</p>
            <p className="text-xs text-zinc-500 leading-relaxed">Ava specializes in long-form content — blog posts, articles, and thought leadership pieces. She writes in your brand voice and optimizes for SEO.</p>
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block"></span>
                Unlimited tasks on your plan
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="size-1.5 rounded-full bg-blue-500 inline-block"></span>
                Avg. delivery: 45 seconds
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="size-1.5 rounded-full bg-purple-500 inline-block"></span>
                Remembers your brand voice
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-950/[0.08] bg-white p-5 shadow">
            <p className="text-sm font-semibold text-zinc-900 mb-3">Recent tasks with Ava</p>
            <div className="flex flex-col gap-3">
              {['Q1 Recap: Platform Updates', 'The Future of AI in Sales', 'Feature Spotlight: Workflows'].map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 inline-block flex-shrink-0"></span>
                  <span className="text-xs text-zinc-500 truncate">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
