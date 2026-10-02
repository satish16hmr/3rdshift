import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getWorkerBySlug, type WorkerConfig, type WorkerModeDefinition } from '@/lib/workers/registry';

type PageProps = {
  params: {
    id: string;
  };
};

type DeliverablePoint = {
  title: string;
  detail: string;
};

const planLabel = (plan: WorkerConfig['minPlan']) => {
  if (plan === 'operator') return 'Operator+';
  if (plan === 'pro') return 'Pro+';
  return 'Starter+';
};

const outputLabel = (format: WorkerConfig['outputFormat']) => {
  const labels: Record<WorkerConfig['outputFormat'], string> = {
    markdown: 'Written deliverables',
    csv: 'CSV-ready exports',
    json: 'Structured data',
    html: 'HTML deliverables',
    images: 'Image assets',
    pptx: 'Presentation files',
    clips: 'Short-form clips',
    captions: 'Caption packages',
  };

  return labels[format] || 'Finished deliverables';
};

const sentenceFromDescription = (description: string) => {
  const [firstSentence] = description.split(/(?<=[.!?])\s+/);
  return firstSentence || description;
};

const buildDeliverablePoints = (worker: WorkerConfig): DeliverablePoint[] => {
  const modePoints = (worker.workerModes || []).slice(0, 3).map((mode) => ({
    title: mode.title,
    detail: mode.spec || mode.useCase,
  }));

  const basePoints: DeliverablePoint[] = [
    {
      title: outputLabel(worker.outputFormat),
      detail: sentenceFromDescription(worker.description),
    },
    {
      title: 'Task-ready structure',
      detail: worker.tags.slice(0, 3).join(', ') || worker.category,
    },
    {
      title: 'Plan-aware workflow',
      detail: `${planLabel(worker.minPlan)} access with ${worker.taskType} task handling.`,
    },
  ];

  const points = [...modePoints, ...basePoints];
  const deduped = points.filter((point, index, all) =>
    all.findIndex((candidate) => candidate.title === point.title) === index
  );

  return deduped.slice(0, 4);
};

const modeCardData = (worker: WorkerConfig): WorkerModeDefinition[] => {
  if (worker.workerModes?.length) return worker.workerModes;

  return worker.tags.slice(0, 4).map((tag, index) => ({
    id: tag.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    icon: ['✨', '⚡', '📌', '✅'][index] || '✅',
    title: tag,
    spec: worker.description,
    useCase: `Use ${worker.personaName} for ${tag.toLowerCase()} work.`,
    badge: worker.minPlan === 'starter' ? 'free' : worker.minPlan,
    credits: worker.taskType === 'light' ? 0 : worker.creditCost ?? null,
    tierLine: `${planLabel(worker.minPlan)} · ${worker.taskType === 'light' ? 'Included' : `${worker.creditCost ?? 1} credit${(worker.creditCost ?? 1) === 1 ? '' : 's'}`}`,
  }));
};

export default function WorkerPublicPreviewPage({ params }: PageProps) {
  const worker = getWorkerBySlug(params.id);

  if (!worker || !worker.active || worker.deprecated) {
    notFound();
  }

  const displayName = `${worker.personaName} · ${worker.name}`;
  const modes = modeCardData(worker);
  const deliverables = buildDeliverablePoints(worker);

  return (
    <main className="min-h-screen bg-zinc-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 sm:py-14 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-3xl">
            <Link href="/workers" className="text-sm font-medium text-zinc-500 transition hover:text-blue-600">
              Team
            </Link>
            <div className="mt-6 flex items-center gap-4">
              <div className={`flex size-16 shrink-0 items-center justify-center rounded-2xl text-3xl ${worker.iconBgClass || 'bg-blue-50'}`}>
                {worker.emoji}
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">{worker.category}</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
                  {displayName}
                </h1>
              </div>
            </div>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              {worker.description}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm lg:w-80">
            <p className="text-sm font-semibold text-zinc-950">Ready to put {worker.personaName} to work?</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Create a free account to open the live worker form, save tasks, and keep every result in your dashboard.
            </p>
            <Link
              href="/signup"
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Start using {worker.personaName} — Sign up free
            </Link>
            <p className="mt-4 text-center text-sm text-zinc-500">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-blue-600 transition hover:text-blue-700">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1fr_340px] lg:px-8">
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">About this team member</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{worker.description}</p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-950">What {worker.personaName} can do</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Preview the modes available when you sign in.
                </p>
              </div>
              <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 sm:inline-flex">
                {planLabel(worker.minPlan)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {modes.slice(0, 8).map((mode) => (
                <div key={mode.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-xl shadow-sm">
                      {mode.icon}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-950">{mode.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-zinc-600">{mode.spec}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-md bg-white px-3 py-2 text-xs leading-5 text-zinc-600">
                    {mode.useCase}
                  </div>
                  <p className="mt-3 text-xs font-medium text-blue-700">{mode.tierLine}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">Here&apos;s what {worker.personaName} delivers:</h2>
            <ul className="mt-4 space-y-3">
              {deliverables.map((point) => (
                <li key={point.title} className="flex gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-zinc-950">{point.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-zinc-600">{point.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-6">
            <p className="text-sm font-semibold text-blue-950">Use {worker.personaName} inside your dashboard</p>
            <p className="mt-2 text-sm leading-6 text-blue-900/75">
              The signed-in version includes the live form, saved task history, workspace context, and result pages.
            </p>
            <Link
              href="/signup"
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Start using {worker.personaName} — Sign up free
            </Link>
            <p className="mt-4 text-center text-sm text-blue-900/70">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-blue-700 transition hover:text-blue-800">
                Log in
              </Link>
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
