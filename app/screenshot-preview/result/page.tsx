'use client';
// TEMP: Screenshot preview — delete after screenshots taken

const blogOutput = [
  { type: 'h2', text: 'Introducing Enterprise Features: Built for Teams That Ship Fast' },
  { type: 'p', text: 'The way teams build software has changed. Shipping fast is no longer a competitive advantage — it\'s the baseline expectation. Today, we\'re announcing a set of enterprise features designed around one principle: get out of your team\'s way.' },
  { type: 'h3', text: 'New API Endpoints' },
  { type: 'p', text: 'Our expanded API surface gives engineering teams direct access to everything in the platform. Create workflows, trigger automations, and pull structured data without touching the UI. Full REST and webhook support, with OAuth 2.0 and API key authentication built in.' },
  { type: 'bullets', items: ['Integrate 3rdShift directly into your existing CI/CD pipeline', 'Trigger worker tasks programmatically from your codebase', 'Pull structured outputs into your data warehouse or CRM'] },
  { type: 'h3', text: 'Team Collaboration Features' },
  { type: 'p', text: 'Enterprise teams don\'t work alone. We\'ve shipped a new collaboration layer that lets your team share workers, results, and workflows without stepping on each other. Shared worker libraries mean everyone has access to the same trained workers.' },
  { type: 'h3', text: 'Security and Compliance' },
  { type: 'p', text: 'For teams operating at scale, security isn\'t optional. This release ships with SSO support via SAML 2.0, role-based access control with custom permission sets, full audit logging with timestamps, and data residency controls.' },
  { type: 'p', text: 'These features are available on Pro and Operator plans starting today.' },
];

export default function ResultPreview() {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <nav className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="cursor-pointer hover:text-zinc-900">My Tasks</span>
          <span>›</span>
          <span className="text-zinc-900 font-medium">Q2 Product Launch Blog Post</span>
        </nav>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Completed</span>
          <span className="text-xs text-zinc-400">47 seconds</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 mb-5">
        {['📋 Copy', '⬇️ Download', '🔄 Run Again'].map((btn, i) => (
          <button key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 transition-colors">
            {btn}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
          <span className="flex size-6 items-center justify-center rounded-lg bg-blue-50 text-sm">✍️</span>
          Ava · Article Writer
        </div>
      </div>

      <hr className="border-zinc-200 mb-5" />

      {/* Output */}
      <div className="rounded-xl border border-zinc-950/[0.08] bg-white p-8 shadow">
        {blogOutput.map((block, i) => {
          if (block.type === 'h2') return <h2 key={i} className="text-xl font-bold text-zinc-950 mb-4 mt-0">{block.text}</h2>;
          if (block.type === 'h3') return <h3 key={i} className="text-base font-semibold text-zinc-900 mb-3 mt-5">{block.text}</h3>;
          if (block.type === 'p') return <p key={i} className="text-sm text-zinc-600 leading-relaxed mb-4">{block.text}</p>;
          if (block.type === 'bullets') return (
            <ul key={i} className="list-disc list-inside space-y-1.5 mb-4 ml-1">
              {(block.items || []).map((item, j) => <li key={j} className="text-sm text-zinc-600">{item}</li>)}
            </ul>
          );
          return null;
        })}
      </div>

      {/* Refinement bar */}
      <div className="mt-4 rounded-xl border border-zinc-950/[0.08] bg-white p-4 shadow">
        <p className="text-xs font-medium text-zinc-500 mb-3">Refine this output</p>
        <div className="flex flex-wrap gap-2">
          {['Make it shorter', 'More technical', 'Add examples', 'Simplify the language', 'Add a call to action', 'Make it more casual'].map((r, i) => (
            <button key={i} className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Related tasks */}
      <div className="mt-4 rounded-xl border border-zinc-950/[0.08] bg-white p-5 shadow">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">More from Ava</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { title: 'Q1 Recap: Platform Updates', time: 'Yesterday' },
            { title: 'The Future of AI in Sales', time: '3 days ago' },
            { title: 'Feature Spotlight: Workflows', time: '1 week ago' },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 cursor-pointer hover:border-blue-200 hover:bg-blue-50 transition-colors">
              <span className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-sm flex-shrink-0">✍️</span>
              <div>
                <p className="text-xs font-medium text-zinc-800 leading-tight">{t.title}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">{t.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
