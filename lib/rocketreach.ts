/**
 * RocketReach API utilities for Lenny (Lead Generator)
 *
 * Two-step approach:
 *   1. searchRocketReach() — FREE, returns full names/titles/companies/LinkedIn
 *   2. revealContact()    — 1 export credit, returns email + phone
 */

export interface RocketReachLead {
  profile_id: number;
  name: string;
  title: string;
  company: string;
  linkedin_url: string | null;
  location: string | null;
  revealed: boolean;
  email: string | null;
  phone: string | null;
}

export interface LeadsOutput {
  leads: RocketReachLead[];
  search_criteria: {
    industry: string;
    titles: string;
    size: string;
    location: string;
  };
  total_results: number;
}

export interface RevealResult {
  email: string | null;
  phone: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COMPANY_SIZE_BUCKETS: Array<[number, number, string]> = [
  [1, 10, '1-10'],
  [11, 50, '11-50'],
  [51, 200, '51-200'],
  [201, 500, '201-500'],
  [501, 1000, '501-1000'],
  [1001, 5000, '1001-5000'],
  [5001, 10000, '5001-10000'],
  [10001, Infinity, '10001+'],
];

export interface RocketReachSearchQuery {
  target_industry?: string;
  job_titles?: string;
  target_role?: string; // legacy field name
  seniority_level?: string;
  seniority?: string;
  location?: string;
  company_size?: string;
  exclude_companies?: string;
}

export interface NormalizedRocketReachQuery {
  titles: string[];
  seniority: string[];
  keywords: string[];
  locations: string[];
  companySize: string[];
  excludeEmployers: string[];
  excludedCompanySize: string[];
}

export interface RocketReachSearchPayload {
  query: Record<string, string[]>;
  page_size: number;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

function titleCaseToken(value: string): string {
  const upper = new Set(['VP', 'CEO', 'COO', 'CFO', 'CTO', 'CMO', 'CIO', 'CRO', 'HR', 'IT', 'SAAS', 'SMB']);
  const lower = new Set(['of', 'and', 'or', 'the', 'for', 'to', 'in', 'at']);
  return value
    .split(/\s+/)
    .map((word, wordIndex) => word
      .split('-')
      .map((part, partIndex) => {
        const upperPart = part.toUpperCase();
        const lowerPart = part.toLowerCase();
        if (upper.has(upperPart)) return upperPart === 'SAAS' ? 'SaaS' : upperPart;
        if ((wordIndex > 0 || partIndex > 0) && lower.has(lowerPart)) return lowerPart;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join('-'))
    .join(' ');
}

function splitAndTrim(value: string | undefined | null): string[] {
  if (!value) return [];
  return unique(
    value
      .replace(/[\r\n;]+/g, ',')
      .split(/,|\s+[–—-]\s+/)
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
      .map(titleCaseToken)
  );
}

function bucketsAtOrAbove(minEmployees: number): string[] {
  return COMPANY_SIZE_BUCKETS
    .filter(([, hi]) => hi >= minEmployees)
    .map(([, , label]) => label);
}

function bucketsBelow(maxEmployees: number): string[] {
  return COMPANY_SIZE_BUCKETS
    .filter(([lo]) => lo < maxEmployees)
    .map(([, , label]) => label);
}

function bucketsOver(maxEmployees: number): string[] {
  return COMPANY_SIZE_BUCKETS
    .filter(([, hi]) => hi > maxEmployees)
    .map(([, , label]) => label);
}

/**
 * Map free-text company size input to RocketReach company_size range strings.
 * RocketReach values: "1-10", "11-50", "51-200", "201-500", "501-1000",
 *                     "1001-5000", "5001-10000", "10001+"
 */
export function mapCompanySize(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const s = raw.toLowerCase().trim().replace(/,/g, '');

  // Exact known mappings
  const exact: Record<string, string[]> = {
    '1-10': ['1-10'],
    'startup (1-10)': ['1-10'],
    '11-50': ['11-50'],
    '51-200': ['51-200'],
    '11-200': ['11-50', '51-200'],
    'smb (11-200)': ['11-50', '51-200'],
    '10-200': ['1-10', '11-50', '51-200'],
    'under 200': ['1-10', '11-50', '51-200'],
    'under 200 employees': ['1-10', '11-50', '51-200'],
    'small companies': ['1-10', '11-50', '51-200'],
    'small businesses': ['1-10', '11-50', '51-200'],
    '50-200': ['11-50', '51-200'],
    '50-200 employees': ['11-50', '51-200'],
    '201-500': ['201-500'],
    '501-1000': ['501-1000'],
    'mid-market (201-1000)': ['201-500', '501-1000'],
    'mid market (201-1000)': ['201-500', '501-1000'],
    '201-1000': ['201-500', '501-1000'],
    '1001-5000': ['1001-5000'],
    '5001-10000': ['5001-10000'],
    '10001+': ['10001+'],
    'enterprise (1000+)': ['1001-5000', '5001-10000', '10001+'],
    '1000+': ['1001-5000', '5001-10000', '10001+'],
  };

  if (exact[s]) return exact[s];

  const overMatch = s.match(/(?:over|more than|greater than|>|above)\s*(\d+)/);
  if (overMatch) return bucketsOver(parseInt(overMatch[1], 10));

  const plusMatch = s.match(/(\d+)\s*\+/);
  if (plusMatch) return bucketsAtOrAbove(parseInt(plusMatch[1], 10));

  // "under X" or "less than X"
  const underMatch = s.match(/(?:under|less than|<|below)\s*(\d+)/);
  if (underMatch) return bucketsBelow(parseInt(underMatch[1], 10));

  // "X-Y" numeric range — map each relevant RocketReach bucket that overlaps
  const rangeMatch = s.match(/(\d+)\s*[^\d]+\s*(\d+)/);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1], 10);
    const hi = parseInt(rangeMatch[2], 10);
    const matched = COMPANY_SIZE_BUCKETS
      .filter(([blo, bhi]) => lo <= bhi && hi >= blo)
      .map(([, , label]) => label);
    if (matched.length) return matched;
  }

  if (/enterprise|large/.test(s)) return ['1001-5000', '5001-10000', '10001+'];
  if (/smb|small|startup/.test(s)) return ['1-10', '11-50', '51-200'];

  // Fallback — assume SMB if can't parse
  return ['1-10', '11-50', '51-200'];
}

function normalizeIndustry(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const s = raw
    .replace(/sartups/gi, 'startups')
    .replace(/\bcompanies?\b/gi, ' ')
    .replace(/\blooking to\b/gi, ' ')
    .replace(/\bthat\b|\bwho\b|\bwith\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const out: string[] = [];
  if (/b2b\s+saas/i.test(s)) out.push('B2B SaaS');
  if (/technology|tech/i.test(s)) out.push('technology startups');
  if (/automate|automation|operations/i.test(s)) out.push('business operations');
  if (/e[- ]?commerce/i.test(s)) out.push('e-commerce');
  if (/professional services/i.test(s)) out.push('professional services');

  if (!out.length) {
    out.push(...splitAndTrim(s).map((value) => value.replace(/\s+(and|or)\s+/gi, ' ').trim()).filter(Boolean));
  }

  return unique(out).slice(0, 5);
}

function expandSeniority(values: string[]): string[] {
  const expanded: string[] = [];
  for (const value of values) {
    if (/^c[-\s]?level$/i.test(value)) {
      expanded.push('CEO', 'COO', 'CFO', 'CTO', 'CMO', 'CIO', 'CRO');
    } else {
      expanded.push(value);
    }
  }
  return unique(expanded);
}

function parseExcludeCompanies(raw: string | undefined | null): { excludeEmployers: string[]; excludedCompanySize: string[] } {
  if (!raw) return { excludeEmployers: [], excludedCompanySize: [] };
  const s = raw.toLowerCase();
  const hasSizeInstruction = /\b(exclude|avoid|skip|omit)\b/.test(s) && /\b(enterprise|large|employees?|company size|over|under|more than|less than|\d+[,+]?)\b/.test(s);
  if (hasSizeInstruction) {
    return { excludeEmployers: [], excludedCompanySize: mapCompanySize(raw) };
  }
  return { excludeEmployers: splitAndTrim(raw), excludedCompanySize: [] };
}

export function normalizeRocketReachSearchQuery(query: RocketReachSearchQuery): NormalizedRocketReachQuery {
  const seniority = splitAndTrim(query.seniority_level || query.seniority);
  const excluded = parseExcludeCompanies(query.exclude_companies);
  return {
    titles: splitAndTrim(query.job_titles || query.target_role),
    seniority,
    keywords: normalizeIndustry(query.target_industry),
    locations: splitAndTrim(query.location),
    companySize: mapCompanySize(query.company_size),
    excludeEmployers: excluded.excludeEmployers,
    excludedCompanySize: excluded.excludedCompanySize,
  };
}

export function buildRocketReachSearchPayload(query: RocketReachSearchQuery): RocketReachSearchPayload {
  const normalized = normalizeRocketReachSearchQuery(query);
  const titles = unique([...normalized.titles, ...expandSeniority(normalized.seniority)]);
  const payloadQuery: Record<string, string[]> = {
    ...(titles.length ? { current_title: titles } : {}),
    // 'keyword' is the correct RocketReach param — matches company names, descriptions, industry.
    // 'current_employer_keyword' does NOT exist in the API and causes a 400 error.
    ...(normalized.keywords.length ? { keyword: normalized.keywords } : {}),
    ...(normalized.locations.length ? { location: normalized.locations } : {}),
    ...(normalized.companySize.length ? { company_size: normalized.companySize } : {}),
    ...(normalized.excludeEmployers.length ? { exclude_current_employer: normalized.excludeEmployers } : {}),
    ...(normalized.excludedCompanySize.length ? { exclude_company_size: normalized.excludedCompanySize } : {}),
  };
  return { query: payloadQuery, page_size: 20 };
}

// ─── Step 1: Search (FREE) ────────────────────────────────────────────────────

interface RocketReachSearchResponse {
  profiles?: Array<{
    id: number;
    name?: string;
    current_title?: string;
    current_employer?: string;
    linkedin_url?: string;
    city?: string;
    state?: string;
    country?: string;
    location?: string;
  }>;
  pagination?: { total?: number };
}

export async function searchRocketReach(query: RocketReachSearchQuery): Promise<{ leads: RocketReachLead[]; total: number; requestPayload: RocketReachSearchPayload }> {
  const apiKey = process.env.ROCKETREACH_API_KEY;
  if (!apiKey) throw new Error('ROCKETREACH_API_KEY not configured');

  const body = buildRocketReachSearchPayload(query);

  const res = await fetch('https://api.rocketreach.co/api/v2/person/search', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const rawText = await res.text();
  if (res.status === 429) {
    throw new Error('RocketReach rate limit reached. Please retry in a few minutes.');
  }
  if (res.status >= 500) {
    throw new Error(`RocketReach is temporarily unavailable (${res.status}). Please retry shortly.`);
  }
  if (!res.ok) {
    throw new Error(`RocketReach search failed ${res.status}: ${rawText}`);
  }

  const data = JSON.parse(rawText) as RocketReachSearchResponse & { query?: { non_field_errors?: string[] } };

  // RocketReach returns invalid-field errors as 200 with a query.non_field_errors body
  if (data?.query?.non_field_errors?.length) {
    throw new Error(`RocketReach search error: ${data.query.non_field_errors.join(', ')}`);
  }

  const profiles = data?.profiles || [];

  const leads: RocketReachLead[] = profiles.map((p) => {
    // Build location string
    const parts = [p.city, p.state, p.country].filter(Boolean);
    const locationStr = p.location || (parts.length ? parts.join(', ') : null);

    return {
      profile_id: p.id,
      name: p.name || 'Unknown',
      title: p.current_title || 'Unknown',
      company: p.current_employer || 'Unknown',
      linkedin_url: p.linkedin_url || null,
      location: locationStr,
      revealed: false,
      email: null,
      phone: null,
    };
  });

  const total = data?.pagination?.total ?? leads.length;
  console.info('RocketReach Lenny search completed', {
    request_payload: body,
    response_count: leads.length,
    total,
  });

  return { leads, total, requestPayload: body };
}

// ─── Step 2: Reveal (1 export credit) ────────────────────────────────────────

interface RocketReachEmail {
  email?: string;
  smtp_valid?: string;
}

interface RocketReachLookupResponse {
  emails?: RocketReachEmail[];
  phones?: Array<{ number?: string }>;
  profile?: {
    emails?: RocketReachEmail[];
    phones?: Array<{ number?: string }>;
  };
}

export async function revealContact(profileId: number): Promise<RevealResult> {
  const apiKey = process.env.ROCKETREACH_API_KEY;
  if (!apiKey) throw new Error('ROCKETREACH_API_KEY not configured');

  const res = await fetch(
    `https://api.rocketreach.co/api/v2/person/lookup?id=${profileId}`,
    {
      method: 'GET',
      headers: { 'Api-Key': apiKey },
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (res.status === 429) {
    throw new Error('RocketReach rate limit reached. Please retry in a few minutes.');
  }
  if (res.status >= 500) {
    throw new Error(`RocketReach is temporarily unavailable (${res.status}). Please retry shortly.`);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RocketReach lookup failed ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as RocketReachLookupResponse;

  // Email: prefer smtp_valid === 'valid', then any
  const emails = data?.emails || data?.profile?.emails || [];
  const validEmail =
    emails.find((e) => e.smtp_valid === 'valid')?.email ||
    emails[0]?.email ||
    null;

  // Phone: first available
  const phones = data?.phones || data?.profile?.phones || [];
  const phone = phones[0]?.number || null;

  return { email: validEmail, phone };
}
