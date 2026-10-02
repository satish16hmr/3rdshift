type TrackDubLeadParams = {
  clickId?: string;
  customerExternalId?: string | null;
  customerEmail?: string;
  customerName?: string;
  eventName?: string;
  source?: string;
};

type TrackDubLeadResult =
  | { tracked: true; status: number }
  | { tracked: false; reason: 'missing_config' | 'missing_click_id' | 'missing_customer_external_id' | 'dub_error' | 'exception'; status?: number };

function redactClickId(clickId: string) {
  return `${clickId.slice(0, 8)}…${clickId.slice(-4)}`;
}

export async function trackDubLead({
  clickId,
  customerExternalId,
  customerEmail,
  customerName,
  eventName = 'Sign up',
  source = 'unknown',
}: TrackDubLeadParams): Promise<TrackDubLeadResult> {
  const token = process.env.DUB_API_KEY?.trim();
  const cleanClickId = clickId?.trim();
  const cleanCustomerExternalId = customerExternalId?.trim();

  if (!token) {
    console.warn('[dub] Skipping lead tracking: missing DUB_API_KEY', { source });
    return { tracked: false, reason: 'missing_config' };
  }

  if (!cleanClickId) {
    console.info('[dub] Skipping lead tracking: missing Dub click id', {
      source,
      customerExternalId: cleanCustomerExternalId,
    });
    return { tracked: false, reason: 'missing_click_id' };
  }

  if (!cleanCustomerExternalId) {
    console.warn('[dub] Skipping lead tracking: missing customerExternalId', {
      source,
      clickId: redactClickId(cleanClickId),
    });
    return { tracked: false, reason: 'missing_customer_external_id' };
  }

  try {
    const res = await fetch('https://api.dub.co/track/lead', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clickId: cleanClickId,
        eventName,
        customerExternalId: cleanCustomerExternalId,
        ...(customerEmail ? { customerEmail } : {}),
        ...(customerName ? { customerName } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('[dub] Failed to track lead', {
        source,
        status: res.status,
        customerExternalId: cleanCustomerExternalId,
        response: body.slice(0, 500),
      });
      return { tracked: false, reason: 'dub_error', status: res.status };
    }

    console.info('[dub] Lead tracked', {
      source,
      status: res.status,
      customerExternalId: cleanCustomerExternalId,
      clickId: redactClickId(cleanClickId),
    });
    return { tracked: true, status: res.status };
  } catch (error) {
    console.warn('[dub] Failed to track lead', {
      source,
      customerExternalId: cleanCustomerExternalId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { tracked: false, reason: 'exception' };
  }
}
