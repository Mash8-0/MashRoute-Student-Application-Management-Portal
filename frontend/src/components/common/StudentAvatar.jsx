import { useState } from 'react';
import { cn } from '../../lib/utils';

const sizeMap = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-20 w-20 text-2xl',
};

function getDriveImageUrl(url) {
  if (!url) return url;
  const match = url.match(/[?&]id=([\w-]+)/) || url.match(/\/d\/([\w-]+)/);
  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
  }
  return url;
}

export default function StudentAvatar({ student, documents = [], size = 'md', className = '' }) {
  const [error, setError] = useState(false);

  const sizeClasses = sizeMap[size] || sizeMap.md;

  const photoDoc = documents.find((d) => d.type === 'PHOTO' && !d.deletedAt);
  const rawUrl = photoDoc?.driveViewLink || photoDoc?.fileUrl;
  const photoUrl = rawUrl ? getDriveImageUrl(rawUrl) : null;

  const initial = (student?.fullName || '?').trim().charAt(0).toUpperCase();

  if (photoUrl && !error) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-full',
          sizeClasses,
          className
        )}
      >
        <img
          src={photoUrl}
          alt={student?.fullName || 'Student'}
          className="h-full w-full object-cover"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary',
        sizeClasses,
        className
      )}
    >
      {initial}
    </div>
  );
}
