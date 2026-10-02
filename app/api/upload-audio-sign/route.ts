/**
 * /api/upload-audio-sign
 * Returns a presigned upload URL for direct browser-to-Supabase uploads.
 * No file bytes pass through Next.js — avoids the 4.5MB API body limit.
 * Flow: client calls this → gets presigned URL → uploads directly to Supabase → calls this again for signed download URL
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';

const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.mp4', '.mov', '.webm'];
const ACCEPTED_MIME_TYPES = [
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mp4', 'audio/x-m4a', 'audio/m4a',
  'video/mp4', 'video/quicktime', 'video/webm', 'audio/webm',
];
const MAX_AUDIO_UPLOAD_BYTES = 100 * 1024 * 1024;

function detectUploadMime(head: Buffer, fileName: string): string | null {
  if (head.length >= 12 && head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WAVE') {
    return 'audio/wav';
  }
  if (head.length >= 3 && head.subarray(0, 3).toString('ascii') === 'ID3') {
    return 'audio/mpeg';
  }
  if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return fileName.toLowerCase().endsWith('.webm') ? 'video/webm' : 'audio/webm';
  }
  if (head.length >= 12 && head.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = head.subarray(8, Math.min(head.length, 32)).toString('ascii').toLowerCase();
    if (brand.includes('qt  ')) return 'video/quicktime';
    return fileName.toLowerCase().endsWith('.mp4') || fileName.toLowerCase().endsWith('.mov') ? 'video/mp4' : 'audio/mp4';
  }
  return null;
}

function getSupabase() {
  return supabaseAdmin;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action, fileName, workerSlug, storagePath, fileSize, mimeType, magicBytes } = body;

  // C10 / Item 5 fix: validate x-workspace-id header membership (same as upload-audio)
  const headerWorkspaceId = req.headers.get('x-workspace-id');
  let resolvedWorkspaceId: string = user.id; // default: scope to user
  if (headerWorkspaceId) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', headerWorkspaceId)
      .eq('user_id', user.id)
      .single();
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of that workspace' }, { status: 403 });
    }
    resolvedWorkspaceId = headerWorkspaceId;
  }

  if (action === 'sign-upload') {
    // Validate extension
    const name = (fileName || '').toLowerCase();
    const hasValidExt = ACCEPTED_EXTENSIONS.some(e => name.endsWith(e));
    if (!hasValidExt) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload MP3, WAV, M4A, MP4, MOV, or WEBM.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(Number(fileSize)) || Number(fileSize) <= 0) {
      return NextResponse.json({ error: 'Missing file size.' }, { status: 400 });
    }
    if (Number(fileSize) > MAX_AUDIO_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum size is 100MB.' }, { status: 413 });
    }

    if (!ACCEPTED_MIME_TYPES.includes(String(mimeType))) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload MP3, WAV, M4A, MP4, MOV, or WEBM.' }, { status: 400 });
    }

    if (typeof magicBytes !== 'string' || magicBytes.length === 0) {
      return NextResponse.json({ error: 'Could not verify file type. Please try again.' }, { status: 400 });
    }
    const head = Buffer.from(magicBytes, 'base64');
    const detectedMime = detectUploadMime(head, String(fileName || ''));
    if (!detectedMime) {
      return NextResponse.json({ error: 'Could not detect file type. File may be corrupted or unsupported.' }, { status: 400 });
    }
    if (!ACCEPTED_MIME_TYPES.includes(detectedMime)) {
      return NextResponse.json({ error: `File type not allowed: ${detectedMime}` }, { status: 400 });
    }
    const declared = String(mimeType);
    const compatible = detectedMime === declared
      || (declared === 'audio/x-m4a' && detectedMime === 'audio/mp4')
      || (declared === 'audio/m4a' && detectedMime === 'audio/mp4')
      || (declared === 'audio/x-wav' && detectedMime === 'audio/wav')
      || (declared === 'audio/wave' && detectedMime === 'audio/wav')
      || (declared === 'video/quicktime' && detectedMime === 'video/mp4');
    if (!compatible) {
      return NextResponse.json({ error: 'File type mismatch — content does not match declared type.' }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeName = (fileName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${resolvedWorkspaceId}/${workerSlug || 'audio'}/${timestamp}_${safeName}`;

    const { data, error } = await supabase.storage
      .from('audio-uploads')
      .createSignedUploadUrl(path, { upsert: false });

    if (error || !data) {
      console.error('Presign error:', error);
      return NextResponse.json({ error: 'Could not generate upload URL' }, { status: 500 });
    }

    // signedUrl is a relative path — prepend the Supabase storage base URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
    const fullUploadUrl = data.signedUrl.startsWith('http')
      ? data.signedUrl
      : `${supabaseUrl}/storage/v1${data.signedUrl}`;

    return NextResponse.json({ uploadUrl: fullUploadUrl, storagePath: path, token: data.token });
  }

  if (action === 'sign-download') {
    // After upload completes, return a signed download URL
    if (!storagePath) return NextResponse.json({ error: 'Missing storagePath' }, { status: 400 });

    // C10 / Item 5 fix: enforce path prefix ownership — reject arbitrary storagePath
    const allowedPrefixes = [resolvedWorkspaceId + '/', user.id + '/'];
    const pathIsOwned = allowedPrefixes.some(prefix => storagePath.startsWith(prefix));
    if (!pathIsOwned) {
      return NextResponse.json({ error: 'Unauthorized: path does not belong to your workspace' }, { status: 403 });
    }

    const { data, error } = await supabase.storage
      .from('audio-uploads')
      .createSignedUrl(storagePath, 7200); // 2 hours

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
