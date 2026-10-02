import crypto from 'crypto'

const META_PIXEL_ID = '798214883315340'
const META_CAPI_VERSION = 'v23.0'

type MetaUserData = {
  email?: string | null
}

type SendMetaPurchaseEventParams = {
  eventId: string
  value: number
  currency?: string | null
  userData: MetaUserData
  eventTime?: number
}

function normalizeEmail(email?: string | null) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export async function sendMetaPurchaseEvent({
  eventId,
  value,
  currency = 'USD',
  userData,
  eventTime,
}: SendMetaPurchaseEventParams) {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim()
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim()
  if (!accessToken) {
    console.warn('[meta-capi] META_CAPI_ACCESS_TOKEN is not configured; skipping Purchase event')
    return { sent: false, skipped: 'missing_token' as const }
  }

  const email = normalizeEmail(userData.email)
  if (!email) {
    console.warn(`[meta-capi] Purchase event ${eventId} missing email; skipping to avoid low-quality CAPI event`)
    return { sent: false, skipped: 'missing_email' as const }
  }

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: eventTime ?? Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: 'https://3rdshift.ai/pricing',
        user_data: {
          em: [sha256(email)],
        },
        custom_data: {
          currency: (currency || 'USD').toUpperCase(),
          value,
        },
      },
    ],
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${META_CAPI_VERSION}/${META_PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        ...(testEventCode ? { test_event_code: testEventCode } : {}),
        access_token: accessToken,
      }),
    })

    const responseBody = await response.json().catch(() => null)

    if (!response.ok) {
      console.error('[meta-capi] Purchase event rejected', {
        eventId,
        status: response.status,
        response: responseBody,
      })
      return { sent: false, error: responseBody }
    }

    console.log('[meta-capi] Purchase event sent', {
      eventId,
      eventsReceived: responseBody?.events_received,
      fbtraceId: responseBody?.fbtrace_id,
    })
    return { sent: true, response: responseBody }
  } catch (error) {
    console.error('[meta-capi] Purchase event failed', { eventId, error })
    return { sent: false, error }
  }
}
