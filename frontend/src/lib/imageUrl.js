export function driveThumbnailUrl(fileId, size = 400) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
}

export function extractDriveFileId(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('google.com')) return '';
    if (parsed.pathname.includes('/file/d/')) {
      return parsed.pathname.split('/file/d/')[1]?.split('/')[0] || '';
    }
    return parsed.searchParams.get('id') || '';
  } catch {
    return '';
  }
}

export function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://localhost') || trimmed.startsWith('https://localhost')) {
    try {
      return `${window.location.origin}${new URL(trimmed).pathname}`;
    } catch {
      return trimmed;
    }
  }

  const driveFileId = extractDriveFileId(trimmed);
  if (driveFileId) return driveThumbnailUrl(driveFileId);

  return trimmed;
}
