export const metadata = {
  title: 'Data Deletion — 3rdShift',
  description: 'Request deletion of your 3rdShift data.',
}

export default function DataDeletionPage() {
  return (
    <div className="legal-page">
      <div className="legal-inner">
        <h1 className="legal-title">Data Deletion</h1>
        <p className="legal-date">Last updated: May 2026</p>
        <div className="legal-section">
          <p>
            To request deletion of your data from 3rdShift, please email{' '}
            <a href="mailto:hello@3rdshift.ai">hello@3rdshift.ai</a> with the subject line
            &quot;Data Deletion Request&quot; and include the email address associated with your account.
          </p>
          <p>
            We will process your request within 30 days and confirm deletion via email.
          </p>
        </div>
      </div>
    </div>
  )
}
