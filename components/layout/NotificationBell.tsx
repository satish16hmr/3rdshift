'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getStoredWorkspaceId, workspaceFetch, WORKSPACE_CHANGED_EVENT } from '@/lib/workspace-client';
import Link from 'next/link';

interface TeamUpdate {
  id: string;
  worker_slug: string;
  suggestion_type: string;
  preview_text: string;
  chat_message_id: string | null;
  read: boolean;
  created_at: string;
}

// Worker meta map for notification panel display
const WORKER_META: Record<string, { name: string; emoji: string }> = {
  'content-writer':          { name: 'Ava', emoji: '✍️' },
  'hook-specialist': { name: 'Sam', emoji: '🪝' },
  'email-copywriter':        { name: 'Mira', emoji: '📧' },
  'ad-copywriter':           { name: 'Tate', emoji: '📣' },
  'newsletter-writer':       { name: 'Oscar', emoji: '📰' },
  'seo-strategist':          { name: 'Kai', emoji: '🔍' },
  'social-media-creator':    { name: 'Ash', emoji: '🎬' },
  'lead-generator':          { name: 'Lenny', emoji: '🎯' },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell({ session }: { session: { access_token: string } | null }) {
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState<TeamUpdate[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [plan, setPlan] = useState<string>('starter');
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchUpdates = useCallback(async () => {
    if (!session) return;
    if (!getStoredWorkspaceId()) {
      setUpdates([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await workspaceFetch('/api/team-updates?limit=20', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setUpdates(data.updates || []);
      setUnreadCount((data.updates || []).filter((update: TeamUpdate) => !update.read).length);
      setPlan(data.plan || 'starter');
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Fetch on mount + set up realtime subscription
  useEffect(() => {
    if (!session) return;
    fetchUpdates();
    window.addEventListener(WORKSPACE_CHANGED_EVENT, fetchUpdates);
    window.addEventListener('storage', fetchUpdates);

    // Realtime: re-fetch when new team_updates are inserted
    const supabase = createClient();
    const channel = supabase
      .channel('team-updates-bell')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'team_updates',
      }, () => {
        fetchUpdates();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'team_updates',
      }, () => {
        fetchUpdates();
      })
      .subscribe();

    return () => {
      window.removeEventListener(WORKSPACE_CHANGED_EVENT, fetchUpdates);
      window.removeEventListener('storage', fetchUpdates);
      supabase.removeChannel(channel);
    };
  }, [session, fetchUpdates]);

  // Also listen for Capacitor push events (when app is in foreground)
  useEffect(() => {
    const handler = () => fetchUpdates();
    window.addEventListener('team-update-received', handler);
    return () => window.removeEventListener('team-update-received', handler);
  }, [session, fetchUpdates]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = async () => {
    if (!session) return;
    await workspaceFetch('/api/team-updates', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
    setUpdates(prev => prev.map(u => ({ ...u, read: true })));
    setUnreadCount(0);
  };

  const handleRowClick = async (update: TeamUpdate) => {
    // Mark as read
    if (!update.read && session) {
      await workspaceFetch('/api/team-updates', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'mark_read', id: update.id }),
      });
      setUpdates(prev => prev.map(u => u.id === update.id ? { ...u, read: true } : u));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setOpen(false);
    // Navigate to Team Chat with that worker
    router.push(`/dashboard/team/${update.worker_slug}?tab=chat`);
  };

  // Always render the bell icon — panel and badge only show when session is ready
  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => { if (session) { setOpen(o => !o); if (!open) fetchUpdates(); } }}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        aria-label="Notifications"
        data-team-updates-bell="true"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification panel */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-900">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Updates list */}
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center text-sm text-zinc-400">Loading…</div>
            )}
            {!loading && updates.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="text-2xl mb-2">🔔</div>
                <p className="text-sm text-zinc-500">No notifications yet</p>
                <p className="text-xs text-zinc-400 mt-1">Your team will check in once you've been active a few days.</p>
              </div>
            )}
            {!loading && updates.map(update => {
              const meta = WORKER_META[update.worker_slug] || { name: update.worker_slug, emoji: '💡' };
              return (
                <button
                  key={update.id}
                  onClick={() => handleRowClick(update)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0 ${!update.read ? 'bg-blue-50/50' : ''}`}
                >
                  {/* Worker avatar */}
                  <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm mt-0.5">
                    {meta.emoji}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-zinc-800">{meta.name}</span>
                      <span className="text-[10px] text-zinc-400">{relativeTime(update.created_at)}</span>
                    </div>
                    <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">{update.preview_text}</p>
                  </div>
                  {/* Unread dot */}
                  {!update.read && (
                    <div className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}

            {/* Starter upsell: locked notification teaser */}
            {!loading && plan === 'starter' && (
              <div className="px-4 py-3 border-t border-zinc-100">
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <div className="flex items-start gap-2.5 mb-2">
                    <div className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-sm opacity-50">🔍</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs font-semibold text-zinc-400">Kai</span>
                        <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-600">PRO</span>
                      </div>
                      <div className="relative">
                        <p className="text-xs text-zinc-400 blur-[3px] select-none line-clamp-1">Your competitor just published content ranking for your top keyword. Here's the angle they missed...</p>
                      </div>
                    </div>
                  </div>
                  <Link href="/dashboard/settings/billing" className="block text-center text-xs font-semibold text-blue-600 hover:text-blue-700">
                    Upgrade to Pro to hear from more of your team →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
