'use client';
// TEMP: Screenshot preview — delete after screenshots taken

const tasks = [
  { emoji: '✍️', tint: 'bg-blue-50', title: 'Q2 Product Launch Blog Post', worker: 'Article Writer', name: 'Ava', status: 'completed', duration: '47s', time: 'Today, 2:14 PM' },
  { emoji: '📧', tint: 'bg-emerald-50', title: 'Enterprise Cold Email Sequence', worker: 'Cold Email Writer', name: 'Sage', status: 'completed', duration: '32s', time: 'Today, 11:52 AM' },
  { emoji: '🔍', tint: 'bg-amber-50', title: 'Competitor Analysis: Acme Corp', worker: 'Competitor Tracker', name: 'Zane', status: 'completed', duration: '58s', time: 'Today, 10:31 AM' },
  { emoji: '📱', tint: 'bg-purple-50', title: 'Social Media Calendar — March', worker: 'Social Media Manager', name: 'Mira', status: 'completed', duration: '41s', time: 'Yesterday, 4:07 PM' },
  { emoji: '🖼️', tint: 'bg-rose-50', title: 'Product Feature Illustrations', worker: 'AI Image Generator', name: 'Jude', status: 'completed', duration: '1m 12s', time: 'Yesterday, 1:45 PM' },
  { emoji: '📊', tint: 'bg-teal-50', title: 'Market Research: AI SaaS Trends', worker: 'Market Research Analyst', name: 'Sam', status: 'completed', duration: '53s', time: 'Yesterday, 11:22 AM' },
  { emoji: '📰', tint: 'bg-indigo-50', title: 'Weekly Newsletter Draft', worker: 'Newsletter Writer', name: 'Quinn', status: 'running', duration: null, time: 'Just now' },
  { emoji: '🎨', tint: 'bg-rose-50', title: 'YouTube Thumbnail Designs', worker: 'Thumbnail Designer', name: 'Reed', status: 'completed', duration: '38s', time: '2 days ago' },
];

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { completed: 'bg-emerald-500', running: 'bg-blue-500 animate-pulse', failed: 'bg-red-500' };
  return <span className={`inline-block size-2 shrink-0 rounded-full ${colors[status]}`} />;
}

function TaskRow({ emoji, tint, title, worker, name, status, duration, time }: any) {
  return (
    <div className="group flex items-center gap-4 rounded-lg px-4 py-3.5 transition-colors hover:bg-zinc-950/[0.025] cursor-pointer">
      <StatusDot status={status} />
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-lg ${tint}`}>{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-950">{title}</span>
        <span className="block text-xs text-zinc-500">{worker} · {name}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
          status === 'completed' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
          : status === 'running' ? 'bg-blue-50 text-blue-700 ring-blue-600/20'
          : 'bg-red-50 text-red-700 ring-red-600/20'
        }`}>
          {status === 'completed' ? 'Completed' : status === 'running' ? 'Running' : 'Failed'}
          {duration && <span className="ml-1.5 font-normal opacity-70">· {duration}</span>}
        </span>
        <span className="text-xs text-zinc-400">{time}</span>
      </span>
    </div>
  );
}

export default function TasksPreview() {
  const filters = ['All', 'Completed', 'Running', 'Failed'];
  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-950">My Tasks</h1>
      <p className="mt-1 text-sm text-zinc-500">Track and manage all your submitted tasks in one place.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {filters.map((f, i) => (
          <button key={f} className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${i === 0 ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-950/10 text-zinc-600 hover:border-zinc-950/20 hover:text-zinc-950'}`}>
            {f}
          </button>
        ))}
      </div>

      <hr className="mt-6 border-zinc-200" />

      <div className="mt-4 divide-y divide-zinc-950/[0.04] rounded-xl border border-zinc-950/[0.08] bg-white">
        {tasks.map((task, i) => <TaskRow key={i} {...task} />)}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-zinc-400">Showing {tasks.length} of {tasks.length} tasks</p>
        <p className="text-xs text-zinc-400">Avg. completion: <span className="font-medium text-zinc-600">49s</span></p>
      </div>

      {/* Usage summary */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Tasks this month', value: '34', sub: '12 more than last month' },
          { label: 'Time saved', value: '~14 hrs', sub: 'vs. doing this manually' },
          { label: 'Heavy credits used', value: '8 / 25', sub: '17 remaining this cycle' },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-zinc-950/[0.08] bg-white p-5 shadow">
            <p className="text-xs font-medium text-zinc-500 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-zinc-950">{stat.value}</p>
            <p className="text-xs text-zinc-400 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>
    </>
  );
}
