'use client';
// TEMP: Screenshot preview for Phase 3 checkpoint

const MESSAGES = [
  { role: 'member', content: "Hey! I'm Ava, your content writer. What can I help you with today? I can write blog posts, articles, or any long-form content you need." },
  { role: 'user',   content: "Can you write a blog post about AI productivity tools for small businesses?" },
  { role: 'member', content: "Love it — great topic for your audience. A few quick questions to make sure I nail it:\n\n1. What's the target length? (~800 words, ~1,200, or longer?)\n2. Any specific tools you want me to mention or avoid?\n3. What's the call to action at the end — newsletter signup, product demo, something else?\n\nOnce I have those, I'll get started. This is a light task so no credits needed." },
  { role: 'user',   content: "About 1000 words, mention 3rdShift of course, call to action is a free trial signup" },
  { role: 'member', content: "Perfect. Working on it now — I'll have your blog post ready in about 30 seconds. I'll include a strong intro hook, 5 tool categories (with 3rdShift featured prominently), and a clean call to action at the end." },
  { role: 'system', content: '📄 Deliverable generated' },
]

const DELIVERABLE = {
  title: 'Blog Post: AI Productivity Tools for Small Businesses',
  preview: 'Running a small business means wearing a dozen hats. Here\'s how AI tools — including 3rdShift — are changing what\'s possible for lean teams...',
}

function Message({ msg }: { msg: { role: string; content: string } }) {
  if (msg.role === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-zinc-400 bg-zinc-100 rounded-full px-3 py-1">{msg.content}</span>
      </div>
    )
  }
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-base mt-0.5">✍️</div>
      )}
      <div className={`flex flex-col max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-zinc-100 text-zinc-900 rounded-tl-sm shadow-sm'
        }`}>
          {msg.content}
        </div>
        <span className="mt-1 text-[10px] text-zinc-400">{isUser ? '2:34 PM' : '2:34 PM'}</span>
      </div>
      {isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-600 mt-0.5">U</div>
      )}
    </div>
  )
}

export default function ChatPreview() {
  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
        <span>Team</span>
        <span>›</span>
        <span className="text-zinc-900 font-medium">Ava — Article Writer</span>
      </nav>

      {/* Worker header */}
      <div className="flex items-center gap-4 mb-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">✍️</span>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Article Writer</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Ava · Content & Writing</p>
        </div>
      </div>

      {/* Form / Chat toggle — Chat active */}
      <div className="flex items-center gap-1 border-b border-zinc-200 mb-4">
        <button className="px-5 py-2.5 text-sm font-medium border-b-2 border-transparent text-zinc-500 -mb-px">
          Form
        </button>
        <button className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 border-blue-600 text-blue-600 -mb-px">
          Chat
          <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">NEW</span>
        </button>
      </div>

      {/* Chat container */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-blue-50 text-base">✍️</div>
            <div>
              <p className="text-sm font-semibold text-zinc-950">Ava</p>
              <p className="text-xs text-zinc-400">Article Writer</p>
            </div>
          </div>
          <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600">
            View Past Tasks
          </button>
        </div>

        {/* Messages */}
        <div className="px-5 py-4 space-y-3 bg-zinc-50/50" style={{ minHeight: 360 }}>
          {/* Date divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-zinc-100" />
            <span className="text-[11px] font-medium text-zinc-400">Today</span>
            <div className="flex-1 h-px bg-zinc-100" />
          </div>

          {MESSAGES.map((msg, i) => (
            <Message key={i} msg={msg} />
          ))}

          {/* Deliverable card */}
          <div className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-base mt-0.5">✍️</div>
            <div className="flex flex-col items-start max-w-[75%]">
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-white border border-zinc-100 shadow-sm text-zinc-900">
                Done! Here's your blog post. Let me know if you want any changes.
              </div>
              {/* Deliverable card */}
              <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm w-80">
                <div className="flex items-start gap-3">
                  <span className="text-xl">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-950 mb-0.5 text-xs">{DELIVERABLE.title}</p>
                    <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2">{DELIVERABLE.preview}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">View & Download →</button>
                  <button className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600">Refine</button>
                </div>
              </div>
              <span className="mt-1 text-[10px] text-zinc-400">2:35 PM</span>
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="px-5 py-4 bg-white border-t border-zinc-100">
          <div className="flex items-end gap-3 rounded-xl border border-zinc-200 px-4 py-3 bg-white focus-within:border-blue-400">
            <div className="flex-1 text-sm text-zinc-400">Message Ava…</div>
            <button className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white opacity-40">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12.5 7L1.5 1.5L4.5 7L1.5 12.5L12.5 7Z" fill="currentColor" /></svg>
            </button>
          </div>
          <p className="mt-2 text-[10px] text-zinc-400 text-center">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

      {/* ── Starter Limit state (shown below for documentation) ── */}
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Starter Plan — Daily Limit State</p>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-4 space-y-3 bg-zinc-50/50" style={{ minHeight: 120 }}>
            <div className="flex justify-center py-6 text-sm text-zinc-400">Chat history loads here…</div>
          </div>
          {/* Starter limit banner */}
          <div className="px-5 pt-3 bg-white">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <div className="space-y-3">
                <p className="font-semibold text-zinc-950">You've used all 5 free messages today</p>
                <p className="text-zinc-500 text-xs">Chat resets at midnight. Want unlimited chat with memory?</p>
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
                  Upgrade to Pro →
                </button>
              </div>
            </div>
          </div>
          {/* Disabled input */}
          <div className="px-5 py-4 bg-white border-t border-zinc-100">
            <div className="flex items-end gap-3 rounded-xl border border-zinc-100 px-4 py-3 bg-zinc-50">
              <div className="flex-1 text-sm text-zinc-300 italic">Daily limit reached — upgrade to Pro for unlimited chat</div>
              <button className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white opacity-25 cursor-not-allowed">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12.5 7L1.5 1.5L4.5 7L1.5 12.5L12.5 7Z" fill="currentColor" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
