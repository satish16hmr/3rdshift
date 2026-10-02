'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { workers, type WorkerConfig } from '@/lib/workers/registry';
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  EllipsisVerticalIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
} from '@heroicons/react/24/outline';
import { createPortal } from 'react-dom';

const PULSE_KEY = 'jarvis_pulse_shown';
const AVATAR_BASE = '/images/marketing/workers-figma';
const JARVIS_LOGO_SRC = '/icons/icon-192.png';
const AVATAR_NAMES = new Set([
  'alice', 'ash', 'ava', 'beck', 'bella', 'blair', 'bree', 'brody', 'cade', 'cara', 'case', 'charlie',
  'clay', 'cruz', 'dale', 'darcy', 'dex', 'dina', 'duncan', 'elliot', 'ellis', 'ember', 'emma', 'eve',
  'flynn', 'gus', 'heath', 'holly', 'iris', 'ivy', 'jett', 'joe', 'joss', 'jude', 'jules', 'kai',
  'knox', 'koa', 'lane', 'lena', 'lenny', 'lyra', 'mack', 'marlo', 'mira', 'naru', 'nash', 'nico',
  'nora', 'opal', 'oscar', 'paul', 'penn', 'pete', 'peyton', 'piper', 'quinn', 'reed', 'remy', 'ren',
  'rio', 'sage', 'sam', 'shay', 'sienna', 'silas', 'sully', 'tala', 'tate', 'tess', 'thea', 'trey',
  'vera', 'vince', 'wes', 'wilma', 'zane', 'zeke',
]);

const ACTIVE_WORKERS = workers.filter((worker) => worker.active && !worker.deprecated);
const WORKERS_BY_PERSONA = new Map(ACTIVE_WORKERS.map((worker) => [worker.personaName.toLowerCase(), worker]));
const WORKER_PERSONA_PATTERN = new RegExp(
  `\\b(${ACTIVE_WORKERS.map((worker) => worker.personaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'g'
);

declare global {
  interface Window {
    __jarvisToken?: string;
    __openJarvis?: () => void;
    __sendJarvisMessage?: (message: string) => void;
  }
}

interface Message {
  id: string;
  role: 'jarvis' | 'user';
  content: string;
  attachments?: string[];
}

interface SupportFormState {
  open: boolean;
  subject: string;
  message: string;
  submitting: boolean;
  submitted: boolean;
  error: string | null;
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'jarvis',
  content:
    "Hey Josh — I'm JARVIS, your 3rdShift concierge. Ask me anything and I'll point you to the right person on your team.",
};

function avatarKey(workerName: string) {
  return workerName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function avatarSrc(workerName: string) {
  const key = avatarKey(workerName);
  return AVATAR_NAMES.has(key) ? `${AVATAR_BASE}/${key}.png` : null;
}

function workerHref(worker: WorkerConfig) {
  return `/dashboard/team/${worker.slug}`;
}

function getMentionedWorkers(text: string): WorkerConfig[] {
  WORKER_PERSONA_PATTERN.lastIndex = 0;
  const seen = new Set<string>();
  const matches: WorkerConfig[] = [];
  let match: RegExpExecArray | null;

  while ((match = WORKER_PERSONA_PATTERN.exec(text)) !== null) {
    const worker = WORKERS_BY_PERSONA.get(match[1].toLowerCase());
    if (worker && !seen.has(worker.slug)) {
      seen.add(worker.slug);
      matches.push(worker);
    }
  }

  return matches.slice(0, 3);
}

function renderJarvisContent(text: string): React.ReactNode {
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  let keyIdx = 0;

  return boldParts.map((segment) => {
    const bold = segment.startsWith('**') && segment.endsWith('**');
    const content = bold ? segment.slice(2, -2) : segment;
    const nodes = injectWorkerLinksInSegment(content, keyIdx);
    keyIdx += nodes.length + 1;

    if (bold) {
      return <strong key={`b-${keyIdx}`}>{nodes}</strong>;
    }
    return <span key={`s-${keyIdx}`}>{nodes}</span>;
  });
}

function injectWorkerLinksInSegment(text: string, baseKey: number): React.ReactNode[] {
  WORKER_PERSONA_PATTERN.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = WORKER_PERSONA_PATTERN.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const worker = WORKERS_BY_PERSONA.get(match[1].toLowerCase());
    if (worker) {
      parts.push(
        <Link key={`w-${baseKey}-${match.index}`} href={workerHref(worker)} className="font-semibold text-[#2563EB] hover:underline">
          {worker.personaName}
        </Link>
      );
    } else {
      parts.push(match[1]);
    }
    last = match.index + match[1].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

function WorkerRecommendationCard({ worker }: { worker: WorkerConfig }) {
  const src = avatarSrc(worker.personaName);

  return (
    <Link
      href={workerHref(worker)}
      className="group inline-flex h-[76px] min-w-[185px] items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white px-4 transition hover:border-blue-200 hover:shadow-sm"
    >
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F5F5F5] text-lg">
        {src ? <Image src={src} alt="" aria-hidden="true" width={44} height={44} className="h-full w-full object-cover" /> : worker.emoji}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5 text-[#2563EB]">{worker.personaName}</span>
        <span className="block max-w-[180px] truncate text-sm leading-5 text-[#181D27]">{worker.name}</span>
      </span>
    </Link>
  );
}

function JarvisAvatar({ size = 40 }: { size?: number }) {
  return (
    <span className="flex h-full w-full shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2563EB]">
      <Image src={JARVIS_LOGO_SRC} alt="JARVIS" width={size} height={size} className="h-full w-full object-cover" />
    </span>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const mentionedWorkers = useMemo(() => (isUser ? [] : getMentionedWorkers(msg.content)), [isUser, msg.content]);

  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      {!isUser && (
        <span className="mr-3 mt-0.5 size-10">
          <JarvisAvatar size={40} />
        </span>
      )}
      <div className={isUser ? 'w-[550px] max-w-[calc(100%-40px)]' : 'w-[550px] max-w-[calc(100%-40px)]'}>
        <div
          className={[
            'rounded-md border text-sm leading-5',
            isUser
              ? 'ml-auto border-[#344054] bg-[#344054] px-3.5 py-2.5 text-white'
              : 'border-[#E5E7EB] bg-white px-3.5 py-2.5 text-[#181D27]',
          ].join(' ')}
        >
          <div className="whitespace-pre-wrap">{isUser ? msg.content : renderJarvisContent(msg.content)}</div>
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {msg.attachments.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 rounded-md border border-white/30 bg-white/10 px-2 py-1 text-xs">
                  <PaperClipIcon className="size-3.5" />
                  {name}
                </span>
              ))}
            </div>
          )}
          {mentionedWorkers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {mentionedWorkers.map((worker) => <WorkerRecommendationCard key={worker.slug} worker={worker} />)}
            </div>
          )}
        </div>
        {!isUser && msg.id !== 'welcome' && (
          <div className="mt-3 flex items-center gap-2 text-[#414651]">
            <button type="button" aria-label="Copy response" className="rounded p-0.5 hover:bg-zinc-100"><ClipboardDocumentIcon className="size-5" /></button>
            <button type="button" aria-label="Regenerate response" className="rounded p-0.5 hover:bg-zinc-100"><ArrowPathIcon className="size-5" /></button>
            <button type="button" aria-label="Like response" className="rounded p-0.5 hover:bg-zinc-100"><HandThumbUpIcon className="size-5" /></button>
            <button type="button" aria-label="Dislike response" className="rounded p-0.5 hover:bg-zinc-100"><HandThumbDownIcon className="size-5" /></button>
            <button type="button" aria-label="More options" className="rounded p-0.5 hover:bg-zinc-100"><EllipsisVerticalIcon className="size-5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JarvisChat() {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [typing, setTyping] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [supportForm, setSupportForm] = useState<SupportFormState>({
    open: false,
    subject: '',
    message: '',
    submitting: false,
    submitted: false,
    error: null,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        window.__jarvisToken = session.access_token;
      }
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!localStorage.getItem(PULSE_KEY)) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 3000);
      return () => clearTimeout(t);
    }
  }, [mounted]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    if (mounted) localStorage.setItem(PULSE_KEY, '1');
    setPulse(false);
    setTimeout(() => inputRef.current?.focus(), 250);
  }, [mounted]);

  const handleClose = useCallback(() => setOpen(false), []);

  const sendText = useCallback(async (rawText?: string, rawAttachments: File[] = attachments) => {
    const text = (rawText ?? input).trim();
    if (!text || typing || rateLimited) return;

    setOpen(true);
    if (mounted) localStorage.setItem(PULSE_KEY, '1');
    setPulse(false);

    const attachmentNames = rawAttachments.map((file) => file.name);
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      attachments: attachmentNames.length > 0 ? attachmentNames : undefined,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setAttachments([]);
    setTyping(true);

    try {
      const history = updatedMessages
        .filter((m) => !(m.role === 'jarvis' && m.content === WELCOME.content))
        .map((m) => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.attachments?.length
            ? `${m.content}\n\nAttached files: ${m.attachments.join(', ')}`
            : m.content,
        }));

      const token = window.__jarvisToken || '';
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();
      const reply = data.response || "I'm not sure about that one — let me connect you with the team.";
      setMessages((prev) => [...prev, { id: `jarvis-${Date.now()}`, role: 'jarvis', content: reply }]);

      if (data.rateLimited) setRateLimited(true);

      const escalationPhrases = [
        'let me connect you with the team',
        'connect you with the team',
        "i'll make sure the team sees this",
        'let me connect you right away',
      ];
      const replyLower = reply.toLowerCase();
      if (escalationPhrases.some((phrase) => replyLower.includes(phrase))) {
        setSupportForm((prev) => ({
          ...prev,
          open: true,
          subject: text.slice(0, 100),
          submitted: false,
          error: null,
        }));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `jarvis-error-${Date.now()}`, role: 'jarvis', content: "Something went wrong on my end. Let me connect you with the team." },
      ]);
    } finally {
      setTyping(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [attachments, input, messages, mounted, rateLimited, typing]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__openJarvis = handleOpen;
    window.__sendJarvisMessage = (message: string) => sendText(message, []);

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ message?: string }>;
      if (custom.detail?.message) sendText(custom.detail.message, []);
      else handleOpen();
    };

    window.addEventListener('jarvis:send', handler);
    window.addEventListener('jarvis:open', handler);

    return () => {
      delete window.__openJarvis;
      delete window.__sendJarvisMessage;
      window.removeEventListener('jarvis:send', handler);
      window.removeEventListener('jarvis:open', handler);
    };
  }, [handleOpen, sendText]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, handleClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  const submitSupportForm = useCallback(async () => {
    if (!supportForm.subject.trim() || !supportForm.message.trim()) return;
    setSupportForm((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      const token = window.__jarvisToken || '';
      const context = messages.slice(-4).map((m) => `${m.role === 'user' ? 'User' : 'JARVIS'}: ${m.content}`).join('\n');
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subject: supportForm.subject, message: supportForm.message, context }),
      });
      setSupportForm((prev) => res.ok
        ? { ...prev, submitting: false, submitted: true }
        : { ...prev, submitting: false, error: 'Could not submit — please try again.' });
    } catch {
      setSupportForm((prev) => ({ ...prev, submitting: false, error: 'Network error — please try again.' }));
    }
  }, [supportForm, messages]);

  if (!mounted) return null;

  const content = (
    <>
      {!open && (
        <button
          onClick={handleOpen}
          aria-label="Open JARVIS"
          className="fixed bottom-6 right-6 z-30 flex size-12 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-lg transition hover:scale-105 hover:bg-[#1D4ED8] cursor-pointer"
        >
          {pulse && <span className="absolute inset-0 rounded-full bg-[#2563EB]/30" style={{ animation: 'jarvis-pulse 1.5s ease-out' }} />}
          <ChatBubbleLeftRightIcon className="relative z-10 size-6" />
        </button>
      )}

      <div
        aria-hidden={!open}
        className={[
          'fixed inset-0 z-30 pointer-events-none transition-colors duration-300',
          open ? 'bg-black/0' : 'bg-transparent',
        ].join(' ')}
      >
        <aside
          ref={panelRef}
          aria-label="JARVIS chat panel"
          className={[
            'pointer-events-auto fixed right-0 top-0 flex z-30 h-dvh w-full max-w-[808px] flex-col overflow-hidden border-l border-[#E5E7EB] bg-white shadow-2xl transition-transform duration-300 ease-out sm:w-[808px]',
            open ? 'translate-x-0' : 'translate-x-full',
          ].join(' ')}
        >
          <div className="flex h-24 shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-6">
            <div className="flex items-center gap-3">
              <span className="size-16">
                <JarvisAvatar size={64} />
              </span>
              <div>
                <h2 className="text-[26px] font-medium leading-8 tracking-[-0.02em] text-[#181D27]">Jarvis</h2>
                <div className="mt-1 flex items-center gap-1.5 text-xs leading-5 text-[#414651]">
                  <span className="inline-flex h-[22px] items-center gap-1 rounded-full border border-[#D5D7DA] bg-white px-2 text-xs font-medium text-[#414651]">
                    <span className="size-1.5 rounded-full bg-[#F59E0B]" />
                    PRO +
                  </span>
                  <span>3rdShift Concierge</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="JARVIS options" className="rounded-md p-1 text-[#717680] hover:bg-zinc-100 cursor-pointer">
                <EllipsisVerticalIcon className="size-6" />
              </button>
              <button type="button" onClick={handleClose} aria-label="Close JARVIS" className="rounded-md p-1 text-[#717680] hover:bg-zinc-100 cursor-pointer">
                <XMarkIcon className="size-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
            <div className="space-y-5">
              {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
              {typing && (
                <div className="flex justify-start">
                  <div className="rounded-md border border-[#E5E7EB] bg-white px-3.5 py-3">
                    <div className="flex gap-1">
                      <span className="size-1.5 rounded-full bg-[#717680]" style={{ animation: 'jarvis-bounce 1.2s ease-in-out infinite', animationDelay: '0ms' }} />
                      <span className="size-1.5 rounded-full bg-[#717680]" style={{ animation: 'jarvis-bounce 1.2s ease-in-out infinite', animationDelay: '200ms' }} />
                      <span className="size-1.5 rounded-full bg-[#717680]" style={{ animation: 'jarvis-bounce 1.2s ease-in-out infinite', animationDelay: '400ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {supportForm.open && (
            <div className="shrink-0 border-t border-[#E5E7EB] bg-[#FAFAFA] px-6 py-3">
              {supportForm.submitted ? (
                <div className="text-center text-sm text-[#181D27]">Message sent ✓</div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#414651]">Send a message to the team</p>
                  <input
                    type="text"
                    placeholder="Subject"
                    value={supportForm.subject}
                    onChange={(e) => setSupportForm((prev) => ({ ...prev, subject: e.target.value }))}
                    className="h-9 w-full rounded-md border border-[#D5D7DA] bg-white px-3 text-sm outline-none focus:border-[#2563EB]"
                  />
                  <textarea
                    placeholder="Describe your issue or question..."
                    value={supportForm.message}
                    onChange={(e) => setSupportForm((prev) => ({ ...prev, message: e.target.value }))}
                    rows={2}
                    className="w-full resize-none rounded-md border border-[#D5D7DA] bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                  />
                  {supportForm.error && <p className="text-xs text-red-500">{supportForm.error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={submitSupportForm}
                      disabled={supportForm.submitting || !supportForm.subject.trim() || !supportForm.message.trim()}
                      className="h-8 rounded-md bg-[#2563EB] px-3 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {supportForm.submitting ? 'Sending…' : 'Send message'}
                    </button>
                    <button onClick={() => setSupportForm((prev) => ({ ...prev, open: false }))} className="h-8 px-2 text-xs text-[#717680]">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex h-[76px] shrink-0 items-center gap-3 border-t border-[#E5E7EB] bg-white px-6 py-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => setAttachments(Array.from(event.target.files || []))}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach files"
              className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[#D5D7DA] bg-white text-[#414651] shadow-xs hover:bg-[#FAFAFA]"
            >
              <PaperClipIcon className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              {attachments.length > 0 && (
                <div className="mb-1 flex gap-1 overflow-hidden text-xs text-[#717680]">
                  {attachments.map((file) => <span key={file.name} className="truncate rounded bg-zinc-100 px-1.5 py-0.5">{file.name}</span>)}
                </div>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={rateLimited ? 'Daily limit reached — resets at midnight' : 'Message'}
                disabled={typing || rateLimited}
                className="h-11 max-h-28 w-full resize-none rounded-md border border-[#D5D7DA] bg-white px-3.5 py-2.5 text-sm leading-5 text-[#181D27] outline-none placeholder:text-[#717680] focus:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <button
              type="button"
              onClick={() => sendText()}
              disabled={!input.trim() || typing || rateLimited}
              aria-label="Send"
              className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#2563EB] text-white shadow-xs transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PaperAirplaneIcon className="size-5 -rotate-45" />
            </button>
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes jarvis-pulse {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes jarvis-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
  return createPortal(content, document.body);
}
