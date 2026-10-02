export const metadata = {
  title: '3rdShift API Documentation',
  description: 'Public API reference for the 3rdShift Zapier integration',
};

export default function ApiDocsPage() {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 860, margin: '0 auto', padding: '48px 24px', color: '#111113', lineHeight: 1.6 }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb', marginBottom: 24 }}>3rdShift</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 8px' }}>3rdShift API Documentation</h1>
        <p style={{ fontSize: 17, color: '#555', margin: 0 }}>
          REST API reference for the 3rdShift ↔ Zapier integration. All endpoints are hosted at{' '}
          <code style={code}>https://3rdshift.ai</code>.
        </p>
      </div>

      <section style={section}>
        <h2 style={h2}>Authentication</h2>
        <p>All API requests require an <strong>API Key</strong> passed in the request header. API keys are available to <strong>Operator plan</strong> subscribers from the 3rdShift dashboard under Settings → API &amp; Integrations.</p>
        <div style={codeBlock}>
          <pre style={{ margin: 0 }}>{`X-API-Key: your_api_key_here`}</pre>
        </div>
        <table style={table}>
          <thead><tr><th style={th}>Header</th><th style={th}>Required</th><th style={th}>Description</th></tr></thead>
          <tbody>
            <tr><td style={td}><code style={code}>X-API-Key</code></td><td style={td}>Yes</td><td style={td}>Your 3rdShift API key. Must belong to an active Operator account.</td></tr>
          </tbody>
        </table>

        <h3 style={h3}>Verify Auth</h3>
        <div style={endpointBar}><span style={method('GET')}>GET</span><span style={endpoint}>/api/zapier/auth/verify</span></div>
        <p>Validates the API key and returns account details. Used by Zapier during connection setup.</p>
        <h4 style={h4}>Response</h4>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`{
  "valid": true,
  "plan": "operator",
  "user_id": "uuid",
  "email": "user@example.com"
}`}</pre></div>
        <table style={table}>
          <thead><tr><th style={th}>Status</th><th style={th}>Meaning</th></tr></thead>
          <tbody>
            <tr><td style={td}>200</td><td style={td}>API key is valid</td></tr>
            <tr><td style={td}>401</td><td style={td}>Missing or invalid API key</td></tr>
            <tr><td style={td}>403</td><td style={td}>Account is not on Operator plan</td></tr>
          </tbody>
        </table>
      </section>

      <section style={section}>
        <h2 style={h2}>Workers</h2>
        <p>Workers are 3rdShift&apos;s AI specialists. Each worker has a unique <code style={code}>slug</code> used when creating tasks.</p>

        <h3 style={h3}>List Workers</h3>
        <div style={endpointBar}><span style={method('GET')}>GET</span><span style={endpoint}>/api/zapier/workers</span></div>
        <p>Returns all active team members. Used by Zapier to populate the worker dropdown in the &quot;Create Task&quot; action.</p>
        <h4 style={h4}>Response</h4>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`[
  {
    "id": "content-writer",
    "label": "Ava · Article Writer",
    "slug": "content-writer",
    "name": "Article Writer",
    "persona_name": "Ava",
    "emoji": "✍️",
    "category": "Content Writing",
    "task_type": "light",
    "credit_cost": 0,
    "output_format": "text",
    "description": "Writes high-quality blog posts, articles, and web copy."
  },
  ...
]`}</pre></div>
        <table style={table}>
          <thead><tr><th style={th}>Field</th><th style={th}>Type</th><th style={th}>Description</th></tr></thead>
          <tbody>
            <tr><td style={td}><code style={code}>id</code></td><td style={td}>string</td><td style={td}>Worker slug (use this in Create Task)</td></tr>
            <tr><td style={td}><code style={code}>label</code></td><td style={td}>string</td><td style={td}>Display name for Zapier dropdown</td></tr>
            <tr><td style={td}><code style={code}>task_type</code></td><td style={td}>string</td><td style={td}><code style={code}>light</code> (free) or <code style={code}>heavy</code> (credits)</td></tr>
            <tr><td style={td}><code style={code}>credit_cost</code></td><td style={td}>number</td><td style={td}>Credits deducted per task (0 for light workers)</td></tr>
          </tbody>
        </table>
      </section>

      <section style={section}>
        <h2 style={h2}>Tasks</h2>

        <h3 style={h3}>Create Task</h3>
        <div style={endpointBar}><span style={method('POST')}>POST</span><span style={endpoint}>/api/zapier/tasks/create</span></div>
        <p>
          Creates a new task and runs it immediately. The endpoint polls for up to 22 seconds and returns the result inline if the worker finishes in time.
          For longer tasks, a <code style={code}>pending</code> response is returned and a <strong>webhook</strong> fires when the task completes.
        </p>
        <h4 style={h4}>Request Body</h4>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`Content-Type: application/json

{
  "worker_slug": "content-writer",
  "inputs": {
    "topic": "10 benefits of remote work",
    "tone": "Professional",
    "word_count": "800"
  }
}`}</pre></div>
        <table style={table}>
          <thead><tr><th style={th}>Field</th><th style={th}>Required</th><th style={th}>Description</th></tr></thead>
          <tbody>
            <tr><td style={td}><code style={code}>worker_slug</code></td><td style={td}>Yes</td><td style={td}>The worker&apos;s slug from the List Workers endpoint</td></tr>
            <tr><td style={td}><code style={code}>inputs</code></td><td style={td}>Yes</td><td style={td}>Key-value map of form fields for the selected worker. Fields vary by worker.</td></tr>
            <tr><td style={td}><code style={code}>task_description</code></td><td style={td}>No</td><td style={td}>Shorthand — automatically mapped to <code style={code}>topic</code>, <code style={code}>description</code>, and <code style={code}>subject</code> inside inputs</td></tr>
          </tbody>
        </table>
        <h4 style={h4}>Response — Completed (201)</h4>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`{
  "id": "uuid",
  "task_id": "uuid",
  "status": "completed",
  "worker": "content-writer",
  "worker_name": "Ava",
  "worker_title": "Article Writer",
  "output": "# 10 Benefits of Remote Work\n\nRemote work has transformed...",
  "created_at": "2026-04-16T21:00:00.000Z",
  "completed_at": "2026-04-16T21:00:08.000Z"
}`}</pre></div>
        <h4 style={h4}>Response — Pending (201)</h4>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`{
  "id": "uuid",
  "task_id": "uuid",
  "status": "pending",
  "worker": "content-writer",
  "worker_name": "Ava",
  "worker_title": "Article Writer",
  "output": "",
  "created_at": "2026-04-16T21:00:00.000Z",
  "completed_at": null,
  "note": "Task is processing. You will receive a webhook notification when complete."
}`}</pre></div>
        <table style={table}>
          <thead><tr><th style={th}>Status</th><th style={th}>Meaning</th></tr></thead>
          <tbody>
            <tr><td style={td}>201</td><td style={td}>Task created (completed or pending)</td></tr>
            <tr><td style={td}>400</td><td style={td}>Missing or invalid request body</td></tr>
            <tr><td style={td}>401</td><td style={td}>Invalid API key</td></tr>
            <tr><td style={td}>402</td><td style={td}>Insufficient credits for heavy worker</td></tr>
            <tr><td style={td}>404</td><td style={td}>Worker slug not found</td></tr>
          </tbody>
        </table>

        <h3 style={h3}>List Recent Tasks</h3>
        <div style={endpointBar}><span style={method('GET')}>GET</span><span style={endpoint}>/api/zapier/tasks/list</span></div>
        <p>Returns the 3 most recent completed tasks for this workspace. Used by Zapier to generate sample trigger data.</p>
        <h4 style={h4}>Response</h4>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`[
  {
    "id": "uuid",
    "worker": "content-writer",
    "worker_name": "Ava",
    "worker_title": "Article Writer",
    "status": "completed",
    "output": "# 10 Benefits of Remote Work\n\nRemote work has transformed...",
    "created_at": "2026-04-16T21:00:00.000Z",
    "completed_at": "2026-04-16T21:00:08.000Z"
  }
]`}</pre></div>
      </section>

      <section style={section}>
        <h2 style={h2}>Webhooks</h2>
        <p>
          3rdShift uses <strong>REST Hooks</strong>. When a task completes, we POST the result to all registered webhook URLs for that workspace.
          Zapier registers and deregisters hooks automatically when you enable/disable a Zap.
        </p>

        <h3 style={h3}>Subscribe</h3>
        <div style={endpointBar}><span style={method('POST')}>POST</span><span style={endpoint}>/api/zapier/hooks/subscribe</span></div>
        <p>Registers a webhook URL to receive <code style={code}>task.completed</code> events.</p>
        <h4 style={h4}>Request Body</h4>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`Content-Type: application/json

{
  "target_url": "https://hooks.zapier.com/hooks/catch/...",
  "event": "task.completed"
}`}</pre></div>
        <table style={table}>
          <thead><tr><th style={th}>Field</th><th style={th}>Required</th><th style={th}>Description</th></tr></thead>
          <tbody>
            <tr><td style={td}><code style={code}>target_url</code></td><td style={td}>Yes</td><td style={td}>The Zapier hook URL to POST events to</td></tr>
            <tr><td style={td}><code style={code}>event</code></td><td style={td}>No</td><td style={td}>Event type. Currently only <code style={code}>task.completed</code> is supported. Defaults to <code style={code}>task.completed</code>.</td></tr>
          </tbody>
        </table>
        <h4 style={h4}>Response (201)</h4>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`{
  "id": "uuid",
  "event": "task.completed",
  "target_url": "https://hooks.zapier.com/hooks/catch/..."
}`}</pre></div>

        <h3 style={h3}>Unsubscribe</h3>
        <div style={endpointBar}><span style={method('DELETE')}>DELETE</span><span style={endpoint}>/api/zapier/hooks/unsubscribe</span></div>
        <p>Deregisters a webhook subscription.</p>
        <h4 style={h4}>Request Body</h4>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`Content-Type: application/json

{
  "target_url": "https://hooks.zapier.com/hooks/catch/..."
}`}</pre></div>
        <p>Alternatively, pass <code style={code}>id</code> (the subscription UUID from Subscribe).</p>
        <h4 style={h4}>Response (200)</h4>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`{ "success": true }`}</pre></div>

        <h3 style={h3}>Webhook Payload</h3>
        <p>When a task completes, 3rdShift POSTs this payload to all active subscribed URLs:</p>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`{
  "id": "uuid",
  "worker": "content-writer",
  "worker_name": "Ava",
  "worker_title": "Article Writer",
  "status": "completed",
  "output": "# 10 Benefits of Remote Work\n\nRemote work has transformed...",
  "deliverable_url": null,
  "credits_used": 0,
  "credit_type": "light",
  "created_at": "2026-04-16T21:00:00.000Z",
  "completed_at": "2026-04-16T21:00:08.000Z"
}`}</pre></div>
        <table style={table}>
          <thead><tr><th style={th}>Field</th><th style={th}>Type</th><th style={th}>Description</th></tr></thead>
          <tbody>
            <tr><td style={td}><code style={code}>id</code></td><td style={td}>string</td><td style={td}>Task UUID</td></tr>
            <tr><td style={td}><code style={code}>worker</code></td><td style={td}>string</td><td style={td}>Worker slug</td></tr>
            <tr><td style={td}><code style={code}>worker_name</code></td><td style={td}>string</td><td style={td}>Worker&apos;s first name (e.g. &quot;Ava&quot;)</td></tr>
            <tr><td style={td}><code style={code}>worker_title</code></td><td style={td}>string</td><td style={td}>Worker&apos;s role title (e.g. &quot;Article Writer&quot;)</td></tr>
            <tr><td style={td}><code style={code}>status</code></td><td style={td}>string</td><td style={td}>Always <code style={code}>completed</code> in webhook payloads</td></tr>
            <tr><td style={td}><code style={code}>output</code></td><td style={td}>string</td><td style={td}>Full text output from the worker</td></tr>
            <tr><td style={td}><code style={code}>deliverable_url</code></td><td style={td}>string|null</td><td style={td}>Download URL for file outputs (PPTX, XLSX, ZIP, etc). Null for text outputs.</td></tr>
            <tr><td style={td}><code style={code}>credits_used</code></td><td style={td}>number</td><td style={td}>Heavy credits deducted (0 for light workers)</td></tr>
            <tr><td style={td}><code style={code}>credit_type</code></td><td style={td}>string</td><td style={td}><code style={code}>light</code> or <code style={code}>heavy</code></td></tr>
          </tbody>
        </table>
      </section>

      <section style={section}>
        <h2 style={h2}>Error Responses</h2>
        <p>All errors return JSON with an <code style={code}>error</code> field:</p>
        <div style={codeBlock}><pre style={{ margin: 0 }}>{`{ "error": "Missing X-API-Key header" }`}</pre></div>
        <table style={table}>
          <thead><tr><th style={th}>Status Code</th><th style={th}>Meaning</th></tr></thead>
          <tbody>
            <tr><td style={td}>400</td><td style={td}>Bad request — missing or invalid parameters</td></tr>
            <tr><td style={td}>401</td><td style={td}>Unauthorized — missing or invalid API key</td></tr>
            <tr><td style={td}>402</td><td style={td}>Payment required — insufficient credits</td></tr>
            <tr><td style={td}>403</td><td style={td}>Forbidden — Operator plan required</td></tr>
            <tr><td style={td}>404</td><td style={td}>Not found — team member slug does not exist</td></tr>
            <tr><td style={td}>500</td><td style={td}>Internal server error</td></tr>
          </tbody>
        </table>
      </section>

      <section style={section}>
        <h2 style={h2}>Rate Limits &amp; Notes</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>The Zapier integration is available on the <strong>Operator plan</strong> ($199/mo) only.</li>
          <li>Light team members (task_type: &quot;light&quot;) run unlimited — no credits consumed.</li>
          <li>Heavy team members deduct credits from your monthly allowance (150 credits/mo on Operator).</li>
          <li>Task execution typically completes within 5–20 seconds. Complex research team members may take longer.</li>
          <li>Webhook delivery is attempted once per subscription URL. Ensure your Zapier hook URL is active.</li>
        </ul>
      </section>

      <footer style={{ marginTop: 64, paddingTop: 24, borderTop: '1px solid #eee', color: '#888', fontSize: 14 }}>
        <p>3rdShift · <a href="https://3rdshift.ai" style={{ color: '#2563eb' }}>3rdshift.ai</a></p>
        <p style={{ marginTop: 4 }}>Last updated: April 2026</p>
      </footer>
    </div>
  );
}

// Inline styles
const section: React.CSSProperties = { marginBottom: 56 };
const h2: React.CSSProperties = { fontSize: 26, fontWeight: 700, margin: '0 0 12px', borderBottom: '2px solid #2563eb', paddingBottom: 8 };
const h3: React.CSSProperties = { fontSize: 19, fontWeight: 700, margin: '28px 0 8px' };
const h4: React.CSSProperties = { fontSize: 14, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#555', margin: '16px 0 6px' };
const codeBlock: React.CSSProperties = { background: '#f6f8fa', border: '1px solid #e1e4e8', borderRadius: 8, padding: '16px 20px', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 13, overflow: 'auto', marginBottom: 12 };
const code: React.CSSProperties = { background: '#f0f0f0', borderRadius: 4, padding: '2px 5px', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: '0.9em' };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' as const, marginBottom: 12, fontSize: 14 };
const th: React.CSSProperties = { textAlign: 'left' as const, padding: '8px 12px', background: '#f6f8fa', borderBottom: '2px solid #e1e4e8', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #f0f0f0' };
const endpointBar: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, background: '#f6f8fa', border: '1px solid #e1e4e8', borderRadius: 8, padding: '10px 16px', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 14, marginBottom: 12 };
const endpoint: React.CSSProperties = { color: '#111113' };

function method(m: string): React.CSSProperties {
  const colors: Record<string, string> = { GET: '#0ea5e9', POST: '#22c55e', DELETE: '#ef4444' };
  return { fontWeight: 700, color: colors[m] || '#666', minWidth: 56 };
}
