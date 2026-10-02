import assert from 'node:assert/strict';
import { normalizeRocketReachSearchQuery, buildRocketReachSearchPayload } from '../lib/rocketreach.ts';

const repro = {
  target_industry: 'B2B SaaS Companies and technology sartups looking to automate business operations',
  company_size: 'SMB (11-200)',
  job_titles: 'Founder, Co-Founder, VP of Operations',
  seniority_level: 'Founder, C-Level',
  location: 'New York, California',
  exclude_companies: 'Exclude large enterprises with over 1,000 employees',
};

const normalized = normalizeRocketReachSearchQuery(repro);
assert.deepEqual(normalized.titles, ['Founder', 'Co-Founder', 'VP of Operations']);
assert.deepEqual(normalized.seniority, ['Founder', 'C-Level']);
assert.deepEqual(normalized.locations, ['New York', 'California']);
assert.deepEqual(normalized.companySize, ['11-50', '51-200']);
assert.deepEqual(normalized.excludeEmployers, []);
assert.ok(normalized.keywords.includes('B2B SaaS'));
assert.ok(normalized.keywords.includes('technology startups'));
assert.ok(normalized.keywords.includes('business operations'));
assert.ok(normalized.excludedCompanySize.includes('1001-5000'));
assert.ok(normalized.excludedCompanySize.includes('5001-10000'));
assert.ok(normalized.excludedCompanySize.includes('10001+'));

const payload = buildRocketReachSearchPayload(repro);
assert.deepEqual(payload.query.current_title.slice(0, 3), ['Founder', 'Co-Founder', 'VP of Operations']);
assert.ok(payload.query.current_title.includes('CEO'));
assert.ok(payload.query.current_title.includes('COO'));
assert.deepEqual(payload.query.location, ['New York', 'California']);
assert.deepEqual(payload.query.company_size, ['11-50', '51-200']);
assert.deepEqual(payload.query.exclude_company_size, ['1001-5000', '5001-10000', '10001+']);
assert.equal(payload.query.exclude_current_employer, undefined);
assert.ok(!JSON.stringify(payload).includes('Exclude large enterprises'));
assert.ok(!JSON.stringify(payload).includes('sartups'));

console.log('rocketreach normalization tests passed');
