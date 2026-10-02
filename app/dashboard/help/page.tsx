// @ts-nocheck
'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/input';
import { ArrowRight, MinusCircle, PlusCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/textarea';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Article content ───────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    articles: [
      {
        q: 'What is 3rdShift?',
        a: '3rdShift is an AI-powered workforce platform. Instead of hiring freelancers or virtual assistants, you get a team of 70+ specialized AI team members who deliver finished work — articles, lead lists, thumbnails, presentations, research reports, and more. Your team members remember your brand, your preferences, and what worked last time. Every project is better than the last. Plans start at $29/month.',
      },
      {
        q: 'How does 3rdShift work?',
        a: 'Pick a team member from the Team page, describe what you need, and they deliver finished work. You can use the Form tab for structured tasks (fill in fields, hit Submit) or the Chat tab to have a conversation, brainstorm, give feedback, and generate deliverables collaboratively. Every deliverable can be downloaded, saved to Google Drive, or refined.',
      },
      {
        q: 'Where do I start?',
        a: 'Head to the Team page and pick a team member that matches what you need right now. If you need content, try Ava (Article Writer). Need research, try Zane (Competitor Analyst). Need a thumbnail, try Reed (Thumbnail Designer). Submit a task using the Form tab — fill in the fields and hit Submit Task. Your deliverable will be ready in 30–60 seconds. After that, explore Team Chat to have a conversation and see how your team members learn your preferences.',
      },
      {
        q: 'What should I set up first?',
        a: 'Go to Settings and fill out your Brand Profile — your company name, industry, target audience, tone of voice, and competitors. This gets shared across your entire team automatically. Every team member will use this context in their work, so your deliverables are always on-brand from the first task.',
      },
    ],
  },
  {
    id: 'your-team',
    title: 'Your Team',
    articles: [
      {
        q: 'How many team members are there?',
        a: '70+ AI team members: Content Writing, Copywriting, Research & Strategy, Data & Analytics, Admin & Ops, Documents & Reports, Design & Creative, Marketing, Sales & Lead Gen, Social Media, AI Services, Recruiting & HR, and Audio & Voice. Each team member is a specialist — they know their craft and deliver finished work in their area.',
      },
      {
        q: 'Is this just ChatGPT?',
        a: 'No. ChatGPT is one generalist that gives you text in a chat box. 3rdShift gives you 70+ AI team members who each know their craft, remember your brand and preferences, and deliver finished, downloadable work — not chat text you have to copy and paste. Your team also shares a Brand Profile, so you never start from scratch with a new team member.',
      },
      {
        q: 'Why are some team members locked?',
        a: 'Team members marked PRO+ require a Pro or Operator plan because they use specialized tools — like live web research, verified lead databases, or AI image generation — that cost more to run. Starter plans have access to 40 AI team members. Upgrade to Pro to unlock all 70+.'
      },
      {
        q: 'What\'s the difference between Form and Chat?',
        a: 'The Form tab is structured — fill in specific fields and get a deliverable. It\'s the fastest way to get work done when you know exactly what you need. The Chat tab lets you have a conversation with your team member — brainstorm ideas, give feedback, iterate, and then generate a deliverable from the discussion. Chat also builds memory so your team member learns your preferences over time. Both produce the same quality deliverables and cost the same credits.',
      },
      {
        q: 'Which team member should I use?',
        a: 'Blog post or article → Ava (Article Writer) for any length (400-3,000 words). Hook variations only → Sam (Hook Specialist), 200-pattern library filtered by platform. SEO strategy → Kai (SEO Strategist) — he builds a content brief with keywords, structure, and competitor analysis, then hand it to Ava to write. Email copy → Mira (Email Copywriter). Ad copy → Tate (Ad Copywriter). Landing page → Quinn (Landing Page Copywriter). YouTube/video scripts → Jules (Script Writer). Newsletters → Oscar (Newsletter Editor). Short-form video scripts (TikTok/Reels/Shorts) → Ash (Short-Form Video Script Writer). Social media text posts → Case (X/Twitter), Elliot (LinkedIn). Competitor research → Zane (Competitor Analyst). Market research → Duncan (Market Research Analyst). Leads → Lenny (Lead Generator). Thumbnails → Reed (Thumbnail Designer). Logos → Shay (Logo Concept Generator). Social graphics → Gus (Social Media Graphics Designer). Presentations → Mack (Presentation Builder). Resumes → Beck (Career Coach) — also cover letters, job search strategy, salary negotiation, career transitions. Press releases → Naru (Publications Specialist) — pick Press Release mode. Case studies → Thea (Case Study Specialist). Job descriptions → Eve (Recruiting Specialist). Meeting notes → Dina (Meeting Notes Specialist). Product descriptions → Dex (Product Copywriter). AI prompt help → Pete (Prompt Engineer). Brand strategy → Piper (Brand Strategist). You can also ask JARVIS (the chat widget in the bottom right) "I need help with [X]" and he\'ll recommend the right team member.',
      },
    ],
  },
  {
    id: 'plans-pricing',
    title: 'Plans & Pricing',
    articles: [
      {
        q: 'What plans are available?',
        a: 'Three plans: Starter ($29/mo annual or $39/mo), Pro ($79/mo annual or $99/mo), and Operator ($199/mo annual or $249/mo). Starter gives you 40 AI team members, 200 light tasks/month, and a 5-message/day chat teaser. Pro gives you all 70+ team members, 500 light tasks, 50 heavy credits, full Team Chat with memory, and Google Workspace integration. Operator adds Workflows, scheduling, 20 Playbooks, custom Playbooks, 1,250 light tasks, and 150 heavy credits.'
      },
      {
        q: 'What\'s founding member pricing?',
        a: 'Founding Member Launch Pricing is available for a limited time. Starter: $29/month (annual) or $39/month. Pro: $79/month (annual) or $99/month. Operator: $199/month (annual) or $249/month. If you cancel, you lose the founding rate permanently.'
      },
      {
        q: 'How do I upgrade or downgrade?',
        a: 'Go to Billing in the sidebar. You can change your plan anytime. Upgrades take effect immediately. Downgrades take effect at the end of your current billing cycle.',
      },
      {
        q: 'How do I cancel?',
        a: 'Go to Billing in the sidebar and click Cancel. Your plan stays active until the end of your current billing cycle — you won\'t lose access immediately. Important: founding members who cancel lose their locked-in pricing permanently. If you resubscribe later, you\'ll pay the regular price.',
      },
    ],
  },
  {
    id: 'credits',
    title: 'Credits',
    articles: [
      {
        q: 'How do credits work?',
        a: 'There are two types of tasks on 3rdShift. Light tasks are free to run — they use AI to generate content like blog posts, emails, social media posts, and more. Heavy credit tasks require specialized external tools — like live web research, verified lead databases, or AI image generation — and cost 1, 2, 3, 4, 5, or 6 heavy credits depending on the team member. You can see the credit cost before submitting any task.',
      },
      {
        q: 'How many credits do I get?',
        a: 'Starter: 200 light tasks and light-task-only team access. Pro: 500 light tasks and 50 heavy credits. Operator: 1,250 light tasks and 150 heavy credits. Heavy credits reset at the start of each billing cycle.',
      },
      {
        q: 'Why did this task cost credits but that one didn\'t?',
        a: 'Most team members run light tasks (free). Some team members run heavy credit tasks because they use specialized tools to deliver their work. You always see the credit cost and your remaining balance before submitting.',
      },
      {
        q: 'Does chatting cost credits?',
        a: 'No. Chat conversations are completely free on Pro and Operator. You only use credits when a team member generates a deliverable — the same cost whether you trigger it from Chat or Form.',
      },
      {
        q: 'I ran out of credits. What do I do?',
        a: 'You can still use all free team members (light tasks) even when heavy credits are depleted. If you\'re on the Operator plan, you can buy top-up credit packs from the Billing page without waiting for your reset. If you\'re on Starter or Pro, upgrading your plan gives you more credits immediately. Otherwise, credits reset at the start of your next billing cycle.',
      },
      {
        q: 'Can I buy more credits without upgrading?',
        a: 'Top-up credit packs are available for Operator plan members. Packs: 25 credits ($47), 50 credits ($87), or 100 credits ($167). Purchased top-up credits never expire.',
      },
      {
        q: 'How many credits do audio team members cost?',
        a: 'Clay (Voiceover Artist) costs 3 heavy credits per task. Opal (Transcription), Dina (Meeting Notes), and Koa (Sound Effects) each cost 1 heavy credit. Tala (Content Translator) costs 3 or 6 heavy credits. All audio team members use heavy credits regardless of plan.',
      },
      {
        q: 'What happens if an audio task fails?',
        a: 'If the audio processing fails due to a system error, your credits are automatically refunded to your account. You are never charged for failed tasks.',
      },
    ],
  },
  {
    id: 'team-chat-memory',
    title: 'Team Chat & Memory',
    articles: [
      {
        q: 'How does Team Chat work?',
        a: 'Open any team member\'s page and click the Chat tab. You can have a natural conversation — describe what you need, brainstorm ideas, give feedback, ask for changes. When you\'re ready for a deliverable, your team member will generate it right in the chat. The deliverable card appears with a View & Download button and a Refine button.',
      },
      {
        q: 'How does memory work?',
        a: 'Your team members automatically remember important details from your conversations — your brand name, preferences, style, past requests, and working style. This means every project gets better because they already know your context. You don\'t need to re-explain yourself every time.',
      },
      {
        q: 'I told Ava something. Does Reed know it too?',
        a: 'Partially. Your Brand Profile (company name, industry, audience, tone of voice) is shared across ALL team members — set it once in Settings and the whole team knows. But individual preferences — like "I prefer minimalist thumbnails" — stay with that specific team member. This way each specialist builds their own understanding of how you like their type of work.',
      },
      {
        q: 'Can I see or delete what they remember?',
        a: 'Yes. Open the Memory panel at the bottom of any chat to see what that team member remembers. You can delete individual memories by clicking the delete icon. You can also say "forget that" in the chat and the team member will remove the memory.',
      },
      {
        q: 'What\'s the Brand Profile?',
        a: 'Your Brand Profile lives in Settings and stores your company name, industry, target audience, tone of voice, competitors, and additional context. Every team member uses this automatically in their work. Set it up once and your entire team is on-brand from day one.',
      },
      {
        q: 'Is there a chat message limit?',
        a: 'Starter: 5 messages/day, 150/month. Pro: 20/hour, 100/day, 1,000/month. Operator: 20/hour, 100/day, 1,500/month. Counters reset daily at midnight UTC (daily) or on your billing date (monthly). Forms always work regardless of chat limits.',
      },
    ],
  },
  {
    id: 'workflows',
    title: 'Workflows (Operator)',
    articles: [
      {
        q: 'What are Workflows?',
        a: 'Workflows let you connect team members together so one member\'s output feeds into the next. Example: Ava writes an article → Kai optimizes it for SEO → Case turns it into social posts. You can run workflows manually or schedule them to run automatically on specific days. Available on the Operator plan.',
      },
      {
        q: 'What are Playbooks?',
        a: 'Playbooks are pre-built workflow playbooks for common business tasks — like weekly content creation, competitor monitoring, or lead generation campaigns. There are 20 Playbooks ready to use. Operator members can also save their own workflows as Custom Playbooks and reuse them anytime.',
      },
      {
        q: 'Do Workflows cost extra?',
        a: 'No. Workflows are included with the Operator plan. Each team member in the workflow uses the same credits as running them individually. There\'s no surcharge for automation.',
      },
      {
        q: 'How many team members can be in a Workflow?',
        a: '2 to 5 team members per workflow. The same team member can appear more than once in a workflow but not back-to-back. You can have up to 10 active scheduled workflows at a time. Schedules run at 6 AM your local time on the days you select.',
      },
    ],
  },
  {
    id: 'google-workspace',
    title: 'Google Workspace',
    articles: [
      {
        q: 'How do I connect Google?',
        a: 'Go to Settings → Integrations → Connect Google. Available on Pro and Operator plans. Once connected, a "Save to Google" button appears on every deliverable.',
      },
      {
        q: 'Where do my files go?',
        a: '3rdShift automatically creates a "3rdShift" folder in your Google Drive with subfolders for each team member. Articles save to Google Docs, spreadsheets to Google Sheets, presentations to Google Slides, and images save directly to Drive. Everything is organized by who created it.',
      },
      {
        q: 'I don\'t see the Save to Google button.',
        a: 'Google Workspace integration is available on Pro and Operator plans. If you\'re on Starter, upgrade to Pro to connect. If you\'re already on Pro or Operator, go to Settings → Integrations and make sure Google is connected. You may need to click "Connect Google" and authorize access.',
      },
    ],
  },
  {
    id: 'data-trust',
    title: 'Data & Trust',
    articles: [
      {
        q: 'Is the research real? Do team members make things up?',
        a: 'Team members that do research use live web data to inform their work. You\'ll see a source note at the bottom of research deliverables showing how many live web results were used and the date. If a team member can\'t access live data for any reason, the task will fail and you won\'t be charged — we never fall back to guessing or making up data.',
      },
      {
        q: 'Are Lenny\'s leads real people?',
        a: 'Yes. Lenny connects to a verified B2B database with over 300 million contacts. The names, emails, companies, and LinkedIn profiles are real, verified data. Some contacts may not have email addresses available, which is normal for any lead database — not every person has a publicly verified email.',
      },
      {
        q: 'Who sees my data?',
        a: 'Only you. Your tasks, deliverables, conversations, and memories are completely private. No other 3rdShift users can access your work.',
      },
      {
        q: 'Do you use my content to train AI?',
        a: 'No. Your content is never used to train AI models. Your data stays yours.',
      },
      {
        q: 'Is my payment information secure?',
        a: 'Yes. All payments are processed through Stripe, a PCI-compliant payment processor used by millions of businesses worldwide. 3rdShift never stores your credit card information.',
      },
      {
        q: 'Who processes my audio files?',
        a: 'Audio and video files are processed by our audio AI provider and returned to your account. We do not store copies beyond what is in your account. Your files are handled in accordance with our privacy policy.',
      },
    ],
  },
  {
    id: 'deliverables-tasks',
    title: 'Deliverables & Tasks',
    articles: [
      {
        q: 'How long does a task take?',
        a: 'Most tasks complete in 15 to 30 seconds. Tasks that involve live web research, complex documents, or detailed reports may take 60 to 90 seconds. Image and video generation can take 1 to 5 minutes. If a task has been processing for more than 5 minutes, try refreshing the page.',
      },
      {
        q: 'A task failed. What happened?',
        a: 'Task failures usually mean a temporary issue with an external service. You were not charged any credits for failed tasks. Try submitting the same task again — it usually works on the second attempt.',
      },
      {
        q: 'The deliverable isn\'t what I wanted.',
        a: 'You have two options. Hit the Refine button on the result page to generate a new version with the same inputs. Or go to Chat and tell the team member specifically what to change — "make it shorter," "use a more professional tone," "focus on the pricing section." Chat is better for targeted feedback because you can explain exactly what\'s off.',
      },
      {
        q: 'How do I download my deliverable?',
        a: 'Click "View & Download" on the deliverable card. On the result page, click the Download button. For image deliverables with multiple options, you\'ll see all options displayed — download the ones you prefer.',
      },
      {
        q: 'Where can I find past deliverables?',
        a: 'Go to My Tasks in the sidebar. All your completed tasks are listed with links to the results. You can also find deliverables in your Google Drive if you\'ve connected Google Workspace.',
      },
      {
        q: 'Can I get a refund on a bad deliverable?',
        a: 'If a task failed, you were not charged. If a deliverable was generated but isn\'t what you expected, try using Refine or Chat to get a better result — your team members are designed to iterate with you. If you\'re still not satisfied, use the support form below and we\'ll take a look.',
      },
      {
        q: 'What file types can I upload for transcription or meeting notes?',
        a: 'You can upload MP3, WAV, M4A, MP4, MOV, and WEBM files. Maximum file size is 100MB. Maximum duration is 30 minutes for transcription (Opal) and 60 minutes for meeting notes (Dina).',
      },
      {
        q: 'What format are audio outputs in?',
        a: 'All audio outputs (voiceovers, sound effects, dubbed content) are delivered as MP3 files. You can download them directly from the result page.',
      },
      {
        q: 'How long does dubbing/translation take?',
        a: "Tala's translation and dubbing process takes 2-5 minutes depending on the length of the audio. The result page will show a progress indicator while she works. Maximum input duration for dubbing is 5 minutes.",
      },
    ],
  },
  {
    id: 'audio-voice',
    title: 'Audio & Voice',
    articles: [
      {
        q: 'What audio services does 3rdShift offer?',
        a: 'Five team members in the Audio & Voice category: Clay (voiceovers from text), Opal (transcription from audio/video), Dina (meeting notes from recordings), Koa (custom sound effects), and Tala (audio translation and dubbing into 11 languages). All require a Pro plan or higher.',
      },
      {
        q: 'Are the voiceovers real human voices?',
        a: 'No. All voiceovers are generated by AI voice synthesis. They sound natural and professional but they are not recordings of human voice actors.',
      },
      {
        q: 'Can I use the audio commercially?',
        a: 'Yes. All audio outputs generated through your 3rdShift account are licensed for commercial use. Use them in podcasts, YouTube videos, ads, training content, or anywhere else.',
      },
      {
        q: 'Is my uploaded audio private?',
        a: 'Yes. Your uploaded files are stored in your account and are not shared with other users. We do not use your audio to train AI models. Files are processed by our audio provider solely to deliver your requested output.',
      },
      {
        q: 'My transcript has errors. What should I do?',
        a: 'AI transcription is very good but not perfect. Common issues include misheard proper nouns, acronyms, or heavily accented speech. Always review transcripts before publishing or using them for important purposes. You can edit the output after downloading.',
      },
    ],
  },
  {
    id: 'account-settings',
    title: 'Account & Settings',
    articles: [
      {
        q: 'How do I change my password?',
        a: 'Go to Settings in the sidebar. You can update your password from the account section.',
      },
      {
        q: 'How do I change my email?',
        a: 'Go to Settings in the sidebar. You can update your email address from the account section.',
      },
      {
        q: 'Can I have multiple users on one account?',
        a: 'Operator plans include 2 team seats — shared workspace, shared credits. Starter and Pro plans are single-user. Team seats share the same credit pool and can access the same deliverables and team members.',
      },
    ],
  },
];

function HelpCategorySkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-3">
        <Skeleton className="h-5 w-40 bg-zinc-100" />
      </div>
      <div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="border-b border-zinc-200 px-6 py-4 last:border-0">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-72 max-w-[70%] bg-zinc-100" />
              <Skeleton className="size-5 shrink-0 rounded-full bg-zinc-100" />
            </div>
            {index === 0 && (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-3 w-full bg-zinc-100" />
                <Skeleton className="h-3 w-3/4 bg-zinc-100" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HelpPageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mb-8">
        <Skeleton className="h-8 w-40 bg-zinc-100" />
        <Skeleton className="mt-2 h-5 w-96 max-w-full bg-zinc-100" />
      </div>

      <div className="mb-8">
        <Skeleton className="h-16 w-full rounded-lg bg-zinc-100" />
      </div>

      <div className="space-y-6">
        <HelpCategorySkeleton rows={4} />
        <HelpCategorySkeleton rows={5} />
        <HelpCategorySkeleton rows={4} />
      </div>

      <div className="mt-8 rounded-4xl bg-zinc-100 p-10 text-center">
        <Skeleton className="mx-auto h-7 w-72 max-w-full bg-zinc-200" />
        <Skeleton className="mx-auto mt-3 h-5 w-56 max-w-full bg-zinc-200" />
        <Skeleton className="mx-auto mt-10 h-10 w-32 rounded-lg bg-zinc-200" />
      </div>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <Skeleton className="h-7 w-40 bg-zinc-100" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full bg-zinc-100" />
        <div className="mt-5 space-y-5">
          <div>
            <Skeleton className="h-4 w-20 bg-zinc-100" />
            <Skeleton className="mt-1.5 h-9 w-full rounded-lg bg-zinc-100" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 bg-zinc-100" />
            <Skeleton className="mt-1.5 h-32 w-full rounded-lg bg-zinc-100" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}

// ─── Accordion item ─────────────────────────────────────────────────────────────
function ArticleItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-zinc-200 last:border-0">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-4 px-6 pt-4 ${open ? 'pb-2' : 'pb-4'} text-left cursor-pointer transition-[padding] duration-300`}
      >
        <span className="text-sm font-medium text-zinc-800">{q}</span>
        {open
          ? <MinusCircle className="size-5 text-[#A4A7AE] transition-transform duration-300" />
          : <PlusCircle className="size-5 text-[#A4A7AE] transition-transform duration-300" />}
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="pb-4 px-6">
            <p className="text-sm text-neutral-500 leading-relaxed whitespace-pre-line">{a}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryAccordion({ cat, defaultOpenIndex }: { cat: typeof CATEGORIES[number]; defaultOpenIndex?: number }) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex ?? null);

  const toggle = (i: number) => setOpenIndex(prev => (prev === i ? null : i));

  return (
    <div>
      {cat.articles.map((article, i) => (
        <ArticleItem
          key={i}
          q={article.q}
          a={article.a}
          open={openIndex === i}
          onToggle={() => toggle(i)}
        />
      ))}
    </div>
  );
}

// ─── Support form ───────────────────────────────────────────────────────────────
function SupportForm() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subject, message: description }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-100 p-6 text-center">
        <p className="text-base font-semibold text-green-800">Got it — we'll get back to you soon.</p>
        <p className="text-sm text-green-600 mt-1">Your message has been received.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-zinc-800 mb-1">Still need help?</h3>
      <p className="text-sm text-neutral-500 mb-5">Describe your issue and we'll get back to you within 24 hours.</p>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Subject <span className="text-blue-500">*</span></label>
          <Input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Brief description of your issue"
          />
        </div>
        <div className='mb-11.5'>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Description <span className="text-red-500">*</span></label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tell us what's happening, what you expected, and what you tried..."
            className='h-32'
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button
          variant="primary"
          onClick={submit}
          disabled={submitting || !subject.trim() || !description.trim()}
          className='gap-1.5 w-fit!'
        >
          {submitting ? 'Sending…' : 'Send to Team'}
          <ArrowRight className='w-4 h-4' />
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────
export default function HelpPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return CATEGORIES;
    const q = query.toLowerCase();
    return CATEGORIES.map(cat => ({
      ...cat,
      articles: cat.articles.filter(a =>
        a.q.toLowerCase().includes(q) || a.a.toLowerCase().includes(q)
      ),
    })).filter(cat => cat.articles.length > 0);
  }, [query]);

  const hasResults = filtered.length > 0;
  const isSearching = query.trim().length > 0;

  if (loading) {
    return <HelpPageSkeleton />;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-800">Help Center</h1>
        <p className="text-base text-neutral-500 mt-1">Find answers about your team, plans, credits, and features.</p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        {/* Wrap the icon in a relative z-10 container to pull it to the front layer */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-zinc-400 pointer-events-none">
          <Search className="size-5" />
        </div>

        <Input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search help articles..."
          /* Added [&>span]:isolate to keep the background layer underneath the icon */
          className="h-16 [&>span]:isolate [&_input]:h-full [&_input]:px-11"
        />

        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer text-sm z-20"
          >
            ✕
          </button>
        )}
      </div>

      {/* No results */}
      {isSearching && !hasResults && (
        <div className="text-center py-12 text-zinc-400 text-sm">
          No articles found for "{query}". Try a different search or ask JARVIS below.
        </div>
      )}

      {/* Article categories */}
      <div className="space-y-6">
        {filtered.map(cat => (
          <div key={cat.id} className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-zinc-100 bg-zinc-50">
              <h2 className="text-base font-bold text-[#717680]">{cat.title}</h2>
            </div>
            <CategoryAccordion
              cat={cat}
              defaultOpenIndex={isSearching && cat.articles.length === 1 ? 0 : undefined}
            />
          </div>
        ))}
      </div>

      {/* JARVIS prompt */}
      <div className="mt-8 p-10 text-center bg-cover bg-no-repeat rounded-4xl" style={{ backgroundImage: "url('/images/referBg.png')" }}>
        <p className="text-2xl font-medium text-zinc-950 mb-3">Can't find what you need?</p>
        <p className="text-base text-zinc-950 mb-10">Can't find what you need?</p>
        <Button
          variant="primary"
          onClick={() => typeof window !== 'undefined' && window.__openJarvis?.()}
          className='gap-1.5'
        >
          Ask JARVIS
          <ArrowRight className='w-4 h-4' />
        </Button>
      </div>

      {/* Support form */}
      <div className="mt-8">
        <SupportForm />
      </div>
    </div>
  );
}
