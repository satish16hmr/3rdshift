/**
 * Atlas Cloud API integration
 * Covers: Text-to-Video, Image-to-Video, Reference-to-Video (Seedance 2.0)
 * Base URL: https://api.atlascloud.ai/api/v1
 */

const ATLAS_BASE = 'https://api.atlascloud.ai/api/v1';

export interface AtlasProviderResponse {
  provider: 'atlascloud';
  endpoint: string;
  status: number;
  body: unknown;
}

export class AtlasCloudHTTPError extends Error {
  providerResponse: AtlasProviderResponse;

  constructor(message: string, providerResponse: AtlasProviderResponse) {
    super(message);
    this.name = 'AtlasCloudHTTPError';
    this.providerResponse = providerResponse;
  }
}

async function readProviderResponse(res: Response, endpoint: string): Promise<AtlasProviderResponse> {
  const rawBody = await res.text().catch(() => res.statusText);
  let body: unknown = rawBody;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    body = rawBody;
  }
  return { provider: 'atlascloud', endpoint, status: res.status, body };
}

function formatBodyForError(body: unknown) {
  return typeof body === 'string' ? body : JSON.stringify(body);
}

function getHeaders(extra?: Record<string, string>) {
  const apiKey = (process.env.ATLAS_CLOUD_API_KEY || '').trim();
  return {
    'Authorization': `Bearer ${apiKey}`,
    ...extra,
  };
}

// ── Aspect ratio mapping ──────────────────────────────────────────────────────
export const ASPECT_RATIO_MAP: Record<string, string> = {
  '16:9 Landscape': '16:9',
  '9:16 Portrait': '9:16',
  '9:16 Vertical': '9:16', // new form label
  '1:1 Square': '1:1',
  '4:5 Feed': '4:5',
  '16:9': '16:9',
  '9:16': '9:16',
  '1:1': '1:1',
};

// ── Duration mapping ──────────────────────────────────────────────────────────
export const DURATION_MAP: Record<string, number> = {
  '5 seconds': 5,
  '10 seconds': 10,
  '15 seconds': 15,
};

// ── Upload media ──────────────────────────────────────────────────────────────
export async function atlasUploadMedia(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([buffer.buffer as ArrayBuffer], { type: mimeType });
  formData.append('file', blob, fileName);

  const endpoint = '/model/uploadMedia';
  const res = await fetch(`${ATLAS_BASE}${endpoint}`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });

  const providerResponse = await readProviderResponse(res, endpoint);
  if (!res.ok) {
    throw new AtlasCloudHTTPError(
      `Atlas Cloud media upload failed (${res.status}): ${formatBodyForError(providerResponse.body)}`,
      providerResponse
    );
  }

  const data = providerResponse.body as { url?: string; download_url?: string; data?: { url?: string; download_url?: string; id?: string; status?: string; outputs?: unknown; error?: string }; id?: string; status?: string; outputs?: unknown; error?: string };
  // Atlas Cloud uploadMedia returns download_url in data object
  const url = data?.url || data?.data?.url || data?.data?.download_url || data?.download_url;
  if (!url) throw new Error(`Atlas Cloud media upload returned no URL: ${JSON.stringify(data)}`);
  return url;
}

// ── Generate video (text-to-video, image-to-video, reference-to-video) ────────
export interface AtlasVideoParams {
  model: string;           // e.g. 'alibaba/wan-2.7/text-to-video'
  prompt: string;
  image_url?: string;      // for image-to-video (some models)
  image?: string;          // for image-to-video (Wan 2.7 uses 'image')
  video_url?: string;      // for reference-to-video
  video?: string;          // for reference-to-video (some models)
  duration?: number;       // seconds
  aspect_ratio?: string;   // '16:9', '9:16', '1:1'
  resolution?: string;     // '720p', '1080p'
  generate_audio?: boolean;
}

export async function atlasGenerateVideoWithResponse(params: AtlasVideoParams): Promise<{
  predictionId: string;
  providerResponse: AtlasProviderResponse;
}> {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
  };

  if (params.image_url) body.image_url = params.image_url;
  if (params.image) body.image = params.image;
  if (params.video_url) body.video_url = params.video_url;
  if (params.video) body.video = params.video;
  if (params.duration) body.duration = params.duration;
  if (params.aspect_ratio) body.aspect_ratio = params.aspect_ratio;
  if (params.resolution) body.resolution = params.resolution;
  if (params.generate_audio !== undefined) body.generate_audio = params.generate_audio;

  const endpoint = '/model/generateVideo';
  const res = await fetch(`${ATLAS_BASE}${endpoint}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  const providerResponse = await readProviderResponse(res, endpoint);
  if (!res.ok) {
    throw new AtlasCloudHTTPError(
      `Atlas Cloud video generation failed (${res.status}): ${formatBodyForError(providerResponse.body)}`,
      providerResponse
    );
  }

  const data = providerResponse.body as { url?: string; download_url?: string; data?: { url?: string; download_url?: string; id?: string; status?: string; outputs?: unknown; error?: string }; id?: string; status?: string; outputs?: unknown; error?: string };
  const predictionId = data?.data?.id || data?.id;
  if (!predictionId) throw new Error(`Atlas Cloud returned no prediction ID: ${JSON.stringify(data)}`);
  return { predictionId, providerResponse };
}

export async function atlasGenerateVideo(params: AtlasVideoParams): Promise<string> {
  const result = await atlasGenerateVideoWithResponse(params);
  return result.predictionId;
}

// ── Poll for video completion ─────────────────────────────────────────────────
export async function atlasPollVideo(predictionId: string): Promise<{
  status: string;
  videoUrl?: string;
  error?: string;
  providerResponse: AtlasProviderResponse;
}> {
  const endpoint = `/model/prediction/${predictionId}`;
  const res = await fetch(`${ATLAS_BASE}${endpoint}`, {
    method: 'GET',
    headers: getHeaders(),
    signal: AbortSignal.timeout(15_000),
  });

  const providerResponse = await readProviderResponse(res, endpoint);
  if (!res.ok) {
    throw new AtlasCloudHTTPError(
      `Atlas Cloud poll failed (${res.status}): ${formatBodyForError(providerResponse.body)}`,
      providerResponse
    );
  }

  const data = providerResponse.body as { url?: string; download_url?: string; data?: { url?: string; download_url?: string; id?: string; status?: string; outputs?: unknown; error?: string }; id?: string; status?: string; outputs?: unknown; error?: string };
  const status = (data?.data?.status || data?.status || 'unknown') as string;
  const outputs = data?.data?.outputs;
  const rawVideoUrl = Array.isArray(outputs) ? outputs[0] : outputs;
  const videoUrl = typeof rawVideoUrl === 'string' ? rawVideoUrl : undefined;
  const isComplete = status === 'completed' || status === 'succeeded';

  return {
    status,
    videoUrl: isComplete ? videoUrl : undefined,
    error: data?.data?.error || data?.error,
    providerResponse,
  };
}

// ── Download video to buffer ──────────────────────────────────────────────────
export async function atlasDownloadVideo(videoUrl: string): Promise<Buffer> {
  const res = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Video download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
