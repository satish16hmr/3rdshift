/**
 * ElevenLabs API integration
 * Covers: Text-to-Speech, Speech-to-Text (Scribe), Sound Effects, Dubbing
 */

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

function getHeaders(extra?: Record<string, string>) {
  return {
    'xi-api-key': process.env.ELEVENLABS_API_KEY!,
    ...extra,
  };
}

export const ELEVENLABS_SFX_PROMPT_MAX_CHARS = 450;

export function limitElevenLabsSfxPrompt(description: string): string {
  const normalized = description.replace(/\s+/g, ' ').trim();

  if (normalized.length <= ELEVENLABS_SFX_PROMPT_MAX_CHARS) {
    return normalized;
  }

  const hardLimit = normalized.slice(0, ELEVENLABS_SFX_PROMPT_MAX_CHARS);
  const sentenceBoundary = Math.max(
    hardLimit.lastIndexOf('. '),
    hardLimit.lastIndexOf('! '),
    hardLimit.lastIndexOf('? '),
    hardLimit.lastIndexOf('; ')
  );

  if (sentenceBoundary >= 240) {
    return hardLimit.slice(0, sentenceBoundary + 1).trim();
  }

  const wordBoundary = hardLimit.search(/\s+\S*$/);
  if (wordBoundary >= 240) {
    return hardLimit.slice(0, wordBoundary).trim().replace(/[,:;\-–—]+$/, '').trim();
  }

  return hardLimit.trim().replace(/[,:;\-–—]+$/, '').trim();
}

// ── VOICE MAPPING ────────────────────────────────────────────────────────────
// ElevenLabs voice IDs for Clay's dropdown options (Multilingual v2 model)
// These are stable shared voices from the ElevenLabs voice library.
export const CLAY_VOICES: Record<string, string> = {
  'Professional Male':   'ktkP7Nsj67dw2zcplQYt', // Lawrence - crisp, authoritative
  'Professional Female': 'XrExE9yKIg1WjnnlVkGX', // Matilda - knowledgeable, professional
  'Friendly Male':       'TX3LPaxmHKxFdv7VOQHJ', // Liam - energetic, social
  'Friendly Female':     'cgSgspJ2msm6clMCkdW9', // Jessica - playful, warm
  'British Male':        'JBFqnCBsd6RMkjVDRZzb', // George - warm, captivating
  'British Female':      'pFZP5JQG7iQjIQuC4Bku', // Lily - velvety
  'Deep Male':           'nPczCjzI2devNBz1zQrb', // Brian - deep, resonant
  'Calm Female':         'SAz9YHcvj6GT2YYXdXww', // River - relaxed, neutral
  'Young Male':          'F3hPNAbHQ6mTZdjfgZdb', // Marcus - powerful, younger
  'Young Female':        'FGY2WhTYpPnrIDTdsKH5', // Laura - enthusiastic, quirky
  'Dark & Mysterious Male':        'N2lVS1w4EtoT3dr4eOWO', // Callum - husky, distinctive
  'Soulful Female':      'wkqe33083YLBV35we7yB', // River (Southern) - charismatic, warm, soulful
};

// Pace → ElevenLabs voice_settings
export const PACE_SETTINGS: Record<string, { stability: number; similarity_boost: number; speed?: number }> = {
  'Normal': { stability: 0.5, similarity_boost: 0.75 },
  'Slow':   { stability: 0.6, similarity_boost: 0.75, speed: 0.85 },
  'Fast':   { stability: 0.45, similarity_boost: 0.75, speed: 1.2 },
};

// Language code mapping for Dubbing
export const LANGUAGE_CODES: Record<string, string> = {
  'English':    'en',
  'Spanish':    'es',
  'French':     'fr',
  'Portuguese': 'pt',
  'German':     'de',
  'Japanese':   'ja',
  'Korean':     'ko',
  'Chinese':    'zh',
  'Hindi':      'hi',
  'Arabic':     'ar',
  'Italian':    'it',
};

// ── TEXT TO SPEECH (Clay) ────────────────────────────────────────────────────
export async function elevenLabsTTS(params: {
  text: string;
  voice: string;   // dropdown label
  pace: string;    // dropdown label
}): Promise<Buffer> {
  const voiceId = CLAY_VOICES[params.voice] || CLAY_VOICES['Professional Male'];
  const settings = PACE_SETTINGS[params.pace] || PACE_SETTINGS['Normal'];

  const body: Record<string, unknown> = {
    text: params.text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: settings.stability,
      similarity_boost: settings.similarity_boost,
    },
  };

  if (settings.speed) {
    (body.voice_settings as Record<string, unknown>)['speed'] = settings.speed;
  }

  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      ...getHeaders({ 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' }),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── SPEECH TO TEXT / SCRIBE (Opal + Dina) ────────────────────────────────────
export async function elevenLabsScribe(params: {
  audioBuffer: Buffer;
  fileName: string;
  numSpeakers: number;
  withSpeakerLabels: boolean;
  withTimestamps: boolean;
}): Promise<{ text: string; words?: unknown[] }> {
  const formData = new FormData();

  const blob = new Blob([params.audioBuffer.buffer as ArrayBuffer], { type: 'audio/mpeg' });
  formData.append('file', blob, params.fileName);
  formData.append('model_id', 'scribe_v1');

  if (params.withSpeakerLabels && params.numSpeakers > 0) {
    formData.append('diarize', 'true');
    formData.append('num_speakers', String(params.numSpeakers === 99 ? 3 : params.numSpeakers));
  }

  if (params.withTimestamps) {
    formData.append('timestamps_granularity', 'word');
  }

  const res = await fetch(`${ELEVENLABS_BASE}/speech-to-text`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`ElevenLabs Scribe failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data;
}

// ── SOUND EFFECTS (Koa) ───────────────────────────────────────────────────────
export async function elevenLabsSFX(params: {
  description: string;
  durationSeconds: number;
}): Promise<Buffer> {
  const sfxPrompt = limitElevenLabsSfxPrompt(params.description);

  const body = {
    text: sfxPrompt,
    duration_seconds: params.durationSeconds,
    prompt_influence: 0.3,
  };

  const res = await fetch(`${ELEVENLABS_BASE}/sound-generation`, {
    method: 'POST',
    headers: {
      ...getHeaders({ 'Content-Type': 'application/json' }),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`ElevenLabs SFX failed (${res.status}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── DUBBING (Tala) ────────────────────────────────────────────────────────────
export async function elevenLabsStartDubbing(params: {
  audioBuffer: Buffer;
  fileName: string;
  sourceLanguage: string;
  targetLanguage: string;
  numSpeakers: number;
}): Promise<{ dubbing_id: string; expected_duration_secs: number }> {
  const sourceLang = LANGUAGE_CODES[params.sourceLanguage] || 'en';
  const targetLang = LANGUAGE_CODES[params.targetLanguage] || 'es';

  const formData = new FormData();
  const blob = new Blob([params.audioBuffer.buffer as ArrayBuffer], { type: 'audio/mpeg' });
  formData.append('file', blob, params.fileName);
  formData.append('source_lang', sourceLang);
  formData.append('target_lang', targetLang);
  formData.append('watermark', 'false'); // Scale tier — no watermark
  if (params.numSpeakers > 0) {
    formData.append('num_speakers', String(params.numSpeakers === 99 ? 3 : params.numSpeakers));
  }

  const res = await fetch(`${ELEVENLABS_BASE}/dubbing`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`ElevenLabs Dubbing start failed (${res.status}): ${errText}`);
  }

  return res.json();
}

export async function elevenLabsPollDubbing(dubbingId: string): Promise<{
  status: string;
  error?: string;
}> {
  const res = await fetch(`${ELEVENLABS_BASE}/dubbing/${dubbingId}`, {
    method: 'GET',
    headers: getHeaders(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs Dubbing poll failed (${res.status})`);
  }

  return res.json();
}

export async function elevenLabsDownloadDubbing(dubbingId: string, targetLanguage: string): Promise<Buffer> {
  const langCode = LANGUAGE_CODES[targetLanguage] || 'es';

  const res = await fetch(`${ELEVENLABS_BASE}/dubbing/${dubbingId}/audio/${langCode}`, {
    method: 'GET',
    headers: getHeaders(),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`ElevenLabs Dubbing download failed (${res.status}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
