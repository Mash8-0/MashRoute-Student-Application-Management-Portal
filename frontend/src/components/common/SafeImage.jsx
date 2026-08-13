import { useEffect, useMemo, useState } from 'react';
import { normalizeImageUrl } from '../../lib/imageUrl';

export default function SafeImage({ src, alt = '', className = '', fallback = null }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = useMemo(() => normalizeImageUrl(src), [src]);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  if (!imageUrl || imgError) return fallback;

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => setImgError(true)}
    />
  );
}
