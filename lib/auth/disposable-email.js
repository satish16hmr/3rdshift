// The package ships a maintained JSON domain list via its CommonJS entrypoint.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const disposableDomains = require('disposable-email-domains')

const SIGNUP_EMAIL_ERROR = 'Please use a permanent email address.'

const EXTRA_DISPOSABLE_DOMAINS = [
  'luxudata.com',
  'mailinator.com',
  'temp-mail.org',
  'temp-mail.io',
  'temp-mail.com',
  'guerrillamail.com',
  'guerrillamail.net',
  '10minutemail.com',
]

const disposableDomainSet = new Set(
  [...disposableDomains, ...EXTRA_DISPOSABLE_DOMAINS]
    .map((domain) => String(domain).trim().toLowerCase())
    .filter(Boolean)
)

function extractEmailDomain(email) {
  const value = String(email || '').trim().toLowerCase()
  const atIndex = value.lastIndexOf('@')

  if (atIndex < 0 || atIndex === value.length - 1) {
    return ''
  }

  return value.slice(atIndex + 1).replace(/\.$/, '')
}

function isDisposableEmail(email) {
  const domain = extractEmailDomain(email)

  if (!domain) {
    return false
  }

  return disposableDomainSet.has(domain)
}

module.exports = {
  SIGNUP_EMAIL_ERROR,
  extractEmailDomain,
  isDisposableEmail,
}
