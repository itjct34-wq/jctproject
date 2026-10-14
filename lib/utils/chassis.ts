/** Normalize chassis for matching CSV rows, ZIP folders, and DB values. */
export function normalizeChassis(raw: string): string {
  return raw.trim().toUpperCase().replace(/[-\s_./\\]/g, '');
}

export function chassisStorageFolder(raw: string): string {
  const cleaned = raw.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || 'unknown';
}

export function isJunkZipPath(path: string): boolean {
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.some((p) => p === '__MACOSX' || p.startsWith('._') || p === '.DS_Store' || p === 'Thumbs.db')) {
    return true;
  }
  const file = parts[parts.length - 1] || '';
  if (!file || file.startsWith('.') || file === '__MACOSX') return true;
  return false;
}

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export function isImageFileName(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXT.has(ext);
}

export function imageContentType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || 'jpg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}
