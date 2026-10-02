export const metadata = {
  title: 'Account Deletion Requested — 3rdShift',
}

export default function AccountDeletionRequestedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-zinc-100">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 3C8.82 3 3 8.82 3 16s5.82 13 13 13 13-5.82 13-13S23.18 3 16 3zm1 19h-2v-2h2v2zm0-4h-2V10h2v8z" fill="#71717a"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-zinc-950 mb-3">Deletion request received.</h1>
        <p className="text-zinc-500 mb-6">
          Your account has been scheduled for deletion. All data will be removed within 30 days.
        </p>
        <p className="text-sm text-zinc-400">
          If you change your mind or have questions, contact us at{' '}
          the Help &amp; Support section inside your 3rdShift dashboard.
        </p>
      </div>
    </div>
  )
}
