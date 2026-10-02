'use client';

import { useState } from 'react';
import { joinWaitlist } from '@/app/actions/waitlist';

interface EmailCaptureProps {
  source?: string;
  placeholder?: string;
  buttonText?: string;
  dark?: boolean;
  formId?: string;
}

export default function EmailCapture({
  source = 'homepage',
  placeholder = 'your@email.com',
  buttonText = 'Get early access',
  dark = false,
  formId,
}: EmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validation
    if (!email.trim() || !email.includes('@')) {
      setShake(true);
      setErrorMsg('Enter a valid email address');
      setTimeout(() => setShake(false), 400);
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const result = await joinWaitlist(email, source);
      if (result.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg('Something went wrong. Try again.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className={`ec-success${dark ? ' ec-success-dark' : ''}`}>
        <div className={`ec-check-circle${dark ? ' ec-check-circle-dark' : ''}`}>
          <span className="ec-check-icon">✓</span>
        </div>
        <div className={`ec-success-headline${dark ? ' ec-success-headline-dark' : ''}`}>You&apos;re in.</div>
        <div className={`ec-success-sub${dark ? ' ec-success-sub-dark' : ''}`}>We&apos;ll email you when early access opens.</div>
      </div>
    );
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className={dark ? 'cta-form dark-form' : 'hero-form'}
      noValidate
    >
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (errorMsg) setErrorMsg(''); }}
        placeholder={placeholder}
        disabled={status === 'loading'}
        className={shake ? 'ec-shake' : ''}
      />
      <button type="submit" disabled={status === 'loading'} style={status === 'loading' ? { opacity: 0.7 } : {}}>
        {status === 'loading' ? 'Joining...' : buttonText}
      </button>
      {errorMsg && <p className="ec-error">{errorMsg}</p>}
    </form>
  );
}
