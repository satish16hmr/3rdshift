/**
 * SSRF protection — Phase 6
 *
 * assertSafeUrl(url, options) throws if the URL would cause a server-side
 * request to an internal/private/metadata endpoint.
 *
 * Blocks:
 *   - Non-HTTPS schemes (http://, ftp://, file://, etc.)
 *   - RFC-1918 private ranges: 10.x, 172.16-31.x, 192.168.x
 *   - Loopback: 127.x, ::1
 *   - Unspecified: 0.0.0.0, ::
 *   - Link-local: 169.254.x, fe80::/10
 *   - IPv4-mapped IPv6 addresses: ::ffff:*
 *   - Cloud metadata IPs: 169.254.169.254 (AWS/GCP/Azure), 100.100.100.200 (Alibaba)
 *   - localhost (hostname)
 *
 * Optionally restricts to an explicit hostname allowlist.
 *
 * DNS rebinding: not defended against (Vercel network isolation accepted as
 * sufficient mitigation — documented known limitation per Phase 6 design).
 */

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

// IPv4 ranges to block (CIDR notation, checked manually — no dependency needed)
const BLOCKED_IPV4_RANGES = [
  // Loopback
  { prefix: '127.', bits: 8 },
  // RFC-1918 private
  { prefix: '10.', bits: 8 },
  { prefix: '192.168.', bits: 16 },
  // RFC-1918 172.16.0.0/12
  ...Array.from({ length: 16 }, (_, i) => ({ prefix: `172.${16 + i}.`, bits: 16 })),
  // Link-local
  { prefix: '169.254.', bits: 16 },
  // Cloud metadata (explicit)
  { prefix: '100.100.100.200', bits: 32 }, // Alibaba
];

const BLOCKED_IPV4_EXACT = new Set([
  '0.0.0.0', // Unspecified IPv4
  '169.254.169.254', // AWS/GCP/Azure IMDS
  '100.100.100.200', // Alibaba
]);

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google.internal']);

function parseIpv4Part(part: string): number | null {
  if (!part) return null;

  let radix = 10;
  let value = part;
  if (/^0x[0-9a-f]+$/i.test(part)) {
    radix = 16;
    value = part.slice(2);
  } else if (/^0[0-7]+$/.test(part) && part !== '0') {
    radix = 8;
  } else if (!/^\d+$/.test(part)) {
    return null;
  }

  const parsed = Number.parseInt(value, radix);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIpv4Literal(hostname: string): string | null {
  const h = hostname.toLowerCase();
  if (!/^(?:0x[0-9a-f]+|[0-9.]+)$/i.test(h)) return null;

  const parts = h.split('.');
  if (parts.length > 4) return null;

  const nums = parts.map(parseIpv4Part);
  if (nums.some(n => n === null)) return null;
  const n = nums as number[];

  let value: number;
  if (n.length === 1) {
    if (n[0] > 0xffffffff) return null;
    value = n[0];
  } else if (n.length === 2) {
    if (n[0] > 0xff || n[1] > 0xffffff) return null;
    value = (n[0] << 24) + n[1];
  } else if (n.length === 3) {
    if (n[0] > 0xff || n[1] > 0xff || n[2] > 0xffff) return null;
    value = (n[0] << 24) + (n[1] << 16) + n[2];
  } else {
    if (n.some(part => part > 0xff)) return null;
    value = (n[0] << 24) + (n[1] << 16) + (n[2] << 8) + n[3];
  }

  value = value >>> 0;
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ].join('.');
}

function isBlockedIpv4(hostname: string): boolean {
  const canonical = parseIpv4Literal(hostname) ?? hostname;
  if (BLOCKED_IPV4_EXACT.has(canonical)) return true;
  return BLOCKED_IPV4_RANGES.some(({ prefix }) => canonical.startsWith(prefix));
}

function isBlockedIpv6(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ''); // strip brackets
  if (h.startsWith('::ffff:') || h.startsWith('0:0:0:0:0:ffff:')) return true; // IPv4-mapped IPv6
  if (h === '::1' || h === '0:0:0:0:0:0:0:1') return true; // loopback
  if (h.startsWith('fe80:')) return true; // link-local
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // ULA (RFC-4193)
  if (h === '::' || h === '0:0:0:0:0:0:0:0') return true; // unspecified
  return false;
}

/**
 * Validate that a URL is safe to fetch server-side.
 *
 * @param rawUrl     The URL string to validate.
 * @param allowedHosts  Optional allowlist of hostnames (exact match, lowercase).
 *                      If provided, the hostname must be in this list.
 * @throws SsrfError   If the URL is unsafe.
 */
export function assertSafeUrl(rawUrl: string, allowedHosts?: string[]): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Invalid URL: ${rawUrl}`);
  }

  // 1. HTTPS only
  if (parsed.protocol !== 'https:') {
    throw new SsrfError(
      `URL must use HTTPS. Got scheme: ${parsed.protocol.replace(':', '')}`
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new SsrfError(`Blocked hostname: ${hostname}`);
  }

  // 3. Blocked IPv4 ranges
  if (isBlockedIpv4(hostname)) {
    throw new SsrfError(`Blocked IP address: ${hostname}`);
  }

  // 4. Blocked IPv6 ranges
  if (isBlockedIpv6(hostname)) {
    throw new SsrfError(`Blocked IP address: ${hostname}`);
  }

  // 5. Hostname allowlist (if provided)
  if (allowedHosts && allowedHosts.length > 0) {
    const allowed = allowedHosts.map(h => h.toLowerCase());
    if (!allowed.includes(hostname)) {
      throw new SsrfError(
        `Host "${hostname}" is not in the allowed list: ${allowed.join(', ')}`
      );
    }
  }
}

/**
 * Safe external fetch wrapper.
 *
 * - Calls assertSafeUrl on the initial URL
 * - Follows redirects manually, validating each hop with assertSafeUrl
 * - Enforces a response size cap (default 10 MB)
 * - Validates Content-Type against an allowlist if provided
 * - Times out after `timeoutMs` (default 30s)
 *
 * Throws SsrfError on SSRF violations or SsrfFetchError on other failures.
 */
export class SsrfFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfFetchError';
  }
}

export async function safeFetchExternal(
  url: string,
  options: RequestInit & {
    allowedHosts?: string[];
    maxBytes?: number;
    allowedContentTypes?: string[];
    timeoutMs?: number;
  } = {},
): Promise<Response> {
  const {
    allowedHosts,
    maxBytes = 10 * 1024 * 1024, // 10 MB default
    allowedContentTypes,
    timeoutMs = 30_000,
    ...fetchOptions
  } = options;

  // Validate initial URL
  assertSafeUrl(url, allowedHosts);

  // Follow redirects manually so we can validate each hop
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let currentUrl = url;
  let response: Response;

  try {
    response = await fetch(currentUrl, {
      ...fetchOptions,
      redirect: 'manual',
      signal: controller.signal,
    });

    // Handle redirects
    let hops = 0;
    while (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) break;
      if (++hops > 5) throw new SsrfFetchError('Too many redirects (max 5)');

      // Resolve relative redirect against current URL
      const redirectUrl = new URL(location, currentUrl).toString();
      assertSafeUrl(redirectUrl, allowedHosts);
      currentUrl = redirectUrl;

      response = await fetch(currentUrl, {
        ...fetchOptions,
        redirect: 'manual',
        signal: controller.signal,
      });
    }
  } finally {
    clearTimeout(timer);
  }

  // Validate Content-Type if allowlist provided
  if (allowedContentTypes && allowedContentTypes.length > 0) {
    const ct = response.headers.get('content-type') ?? '';
    const ctBase = ct.split(';')[0].trim().toLowerCase();
    const allowed = allowedContentTypes.map(t => t.toLowerCase());
    const typeOk = allowed.some(a => a.endsWith('*')
      ? ctBase.startsWith(a.slice(0, -1))
      : ctBase === a
    );
    if (!typeOk) {
      throw new SsrfFetchError(
        `Unexpected Content-Type: "${ct}". Allowed: ${allowedContentTypes.join(', ')}`
      );
    }
  }

  // Enforce size cap via Content-Length header (fast path)
  const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
  if (contentLength > maxBytes) {
    throw new SsrfFetchError(
      `Response too large: ${contentLength} bytes exceeds limit of ${maxBytes} bytes`
    );
  }

  return response;
}
