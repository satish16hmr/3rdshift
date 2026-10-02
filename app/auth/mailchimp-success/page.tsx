'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MailchimpSuccess() {
  const router = useRouter();

  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: 'MAILCHIMP_CONNECTED' }, window.location.origin);
      window.close();
    } else {
      router.push('/dashboard/settings?mailchimp_connected=1');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="text-center">
        <div className="mb-3 text-3xl">✅</div>
        <p className="text-sm text-zinc-500">Mailchimp connected. Closing...</p>
      </div>
    </div>
  );
}
