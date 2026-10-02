// @ts-nocheck
'use client';
/**
 * RoleDeniedToast — listens for 'role-denied' custom events from apiFetch
 * and renders a fixed toast. Mount once in the dashboard layout.
 */
import { useState, useEffect } from 'react';

export function RoleDeniedToast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(null);

  useEffect(() => {
    function handleRoleDenied(e) {
      const msg = e.detail?.message || 'This action requires owner access. Contact your workspace owner.';
      setMessage(msg);
      setVisible(true);
      if (timer) clearTimeout(timer);
      setTimer(setTimeout(() => setVisible(false), 5000));
    }

    window.addEventListener('role-denied', handleRoleDenied);
    return () => window.removeEventListener('role-denied', handleRoleDenied);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#111113',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 500,
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        maxWidth: 420,
        cursor: 'pointer',
      }}
      onClick={() => setVisible(false)}
      role="alert"
    >
      <span style={{ fontSize: 16 }}>🔒</span>
      {message}
      <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 12 }}>✕</span>
    </div>
  );
}
