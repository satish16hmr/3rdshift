'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NotionSuccess() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('notion_error');
    if (window.opener) {
      window.opener.postMessage(
        error
          ? { type: 'NOTION_ERROR', reason: error }
          : { type: 'NOTION_CONNECTED' },
        window.location.origin
      );
      window.close();
    } else {
      router.push(
        error
          ? `/dashboard/settings?notion_error=${encodeURIComponent(error)}`
          : '/dashboard/settings?notion_connected=1'
      );
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="text-center">
        <div className="mb-3 text-3xl">✅</div>
        <p className="text-sm text-zinc-500">Closing...</p>
      </div>
    </div>
  );
}
