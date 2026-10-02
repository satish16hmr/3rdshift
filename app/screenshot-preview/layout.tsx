// TEMP: Screenshot preview layout — delete after screenshots taken
import '../dashboard/tailwind.css';

export default function ScreenshotLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-[#f5f5f7]" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="flex h-screen w-full overflow-hidden">
          {/* ── Sidebar ── */}
          <aside className="flex w-[220px] shrink-0 flex-col border-r border-zinc-200 bg-white">
            {/* Logo */}
            <div className="flex h-14 items-center border-b border-zinc-100 px-4">
              <img src="/logo-hq.png" alt="3rdShift" className="h-7 w-auto" />
            </div>
            {/* Nav */}
            <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3">
              <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
                <svg className="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm8 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V4zM2 12a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zm8 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
                Dashboard
              </a>
              <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
                <svg className="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                Team
              </a>
              <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
                <svg className="size-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                My Tasks
              </a>
              <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd"/></svg>
                Workflows
              </a>
              <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
                <svg className="size-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>
                Settings
              </a>
            </nav>
            {/* User */}
            <div className="border-t border-zinc-100 px-3 py-3">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">AM</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-950">Alex Morgan</p>
                  <p className="truncate text-[10px] text-zinc-500">Pro Plan · Founding Member</p>
                </div>
              </div>
            </div>
          </aside>
          {/* ── Main ── */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Header */}
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
              <span className="text-sm font-medium text-zinc-500">3rdShift Dashboard</span>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">Pro</span>
                <div className="flex size-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">AM</div>
              </div>
            </header>
            {/* Content */}
            <main className="flex-1 overflow-auto">
              <div className="mx-auto max-w-[960px] p-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
