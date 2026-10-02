import assert from 'node:assert/strict';
import { parseDeliverableToSheets } from '../lib/downloads/index.ts';

const bellaHtml = `
<h1>March Bookkeeping Summary</h1>
<p><strong>Total Revenue:</strong> $12,500</p>
<ul><li>Flag: Duplicate software charge</li><li>Recommendation: Review refunds weekly</li></ul>
<table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody><tr><td>Revenue</td><td>$12,500</td></tr><tr><td>Software</td><td>$320</td></tr></tbody></table>
`;
const bella = parseDeliverableToSheets(bellaHtml, 'bookkeeping-summarizer')[0];
assert.equal(bella.name, 'Bookkeeping Summary');
assert.deepEqual(bella.rows[0], ['March Bookkeeping Summary']);
assert.ok(bella.headerRows.includes(1));
assert.deepEqual(bella.rows.find((r) => r[0] === 'Total Revenue'), ['Total Revenue', 12500]);
assert.deepEqual(bella.rows.find((r) => r[0] === 'Category'), ['Category', 'Amount']);
assert.deepEqual(bella.rows.find((r) => r[0] === 'Revenue'), ['Revenue', 12500]);
assert.equal(JSON.stringify(bella.rows).includes('<h1>'), false);
assert.equal(JSON.stringify(bella.rows).includes('<strong>'), false);

const brodyMarkdown = `# Client KPI Report
## North Star Metric
- Metric Name: Qualified pipeline created
- Definition: Dollar value of qualified opportunities created per month

| Metric | Target | Owner |
| --- | --- | --- |
| Activation Rate | 35% | Growth |
`;
const brody = parseDeliverableToSheets(brodyMarkdown, 'kpi-dashboard-writer')[0];
assert.equal(brody.name, 'KPI Report');
assert.ok(brody.rows.length >= 6);
assert.deepEqual(brody.rows.find((r) => r[0] === 'Metric Name'), ['Metric Name', 'Qualified pipeline created']);
assert.deepEqual(brody.rows.find((r) => r[0] === 'Activation Rate'), ['Activation Rate', '35%', 'Growth']);
assert.ok(brody.headerRows.length >= 3);

console.log('deliverable xlsx parser tests passed');
