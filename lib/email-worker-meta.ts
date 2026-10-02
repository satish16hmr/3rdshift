import { getWorkerAvatarSrcBySlug } from '@/lib/worker-avatars';
import { getWorkerBySlug } from '@/lib/workers/registry';

const EMAIL_ASSET_ORIGIN = 'https://3rdshift.ai';

export type EmailWorkerMeta = {
  name: string;
  role: string;
  avatarUrl: string | null;
};

function absoluteAssetUrl(src: string | null) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  return `${EMAIL_ASSET_ORIGIN}${src.startsWith('/') ? src : `/${src}`}`;
}

export function getEmailWorkerMeta(workerSlug: string): EmailWorkerMeta {
  const worker = getWorkerBySlug(workerSlug);
  return {
    name: worker?.personaName || worker?.name || workerSlug,
    role: worker?.name || workerSlug,
    avatarUrl: absoluteAssetUrl(getWorkerAvatarSrcBySlug(workerSlug)),
  };
}

export function renderEmailWorkerAvatar(meta: EmailWorkerMeta, size = 32) {
  if (meta.avatarUrl) {
    return `<img src="${meta.avatarUrl}" alt="${meta.name}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border-radius:999px;object-fit:cover;border:1px solid #e4e4e7;background:#f4f4f5;" />`;
  }

  const initial = (meta.name || '?').trim().charAt(0).toUpperCase() || '?';
  return `<div aria-label="${meta.name}" style="width:${size}px;height:${size}px;border-radius:999px;background:#eef2ff;color:#2563eb;font-size:13px;font-weight:700;line-height:${size}px;text-align:center;border:1px solid #dbeafe;">${initial}</div>`;
}
