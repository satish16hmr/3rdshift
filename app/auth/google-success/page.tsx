'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GoogleSuccess() {
  const router = useRouter();

  useEffect(() => {
    // Tell the opener to refresh Google status, then close this popup
    if (window.opener) {
      window.opener.postMessage({ type: 'GOOGLE_CONNECTED' }, window.location.origin);
      window.close();
    } else {
      // Not a popup — redirect to settings normally
      router.push('/dashboard/settings?google_connected=true');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="text-center">
        <div className="mb-3 text-3xl">✅</div>
        <p className="text-sm text-zinc-500">Google connected. Closing...</p>
      </div>
    </div>
  );
}
