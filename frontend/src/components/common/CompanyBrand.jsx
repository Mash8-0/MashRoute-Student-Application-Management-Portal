import { useState } from 'react';
import { cn, getInitials } from '../../lib/utils';

const sizeMap = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-base',
};

export default function CompanyBrand({ name, logo, size = 'md', showName = true, className = '' }) {
  const [imgError, setImgError] = useState(false);
  const sizeClasses = sizeMap[size] || sizeMap.md;
  const initials = getInitials(name);

  const showImage = logo && !imgError;

  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      {showImage ? (
        <img
          src={logo}
          alt={name || 'Company logo'}
          onError={() => setImgError(true)}
          className={cn(sizeClasses, 'flex-shrink-0 rounded-lg object-cover')}
        />
      ) : (
        <div
          className={cn(
            sizeClasses,
            'flex flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary'
          )}
        >
          {initials}
        </div>
      )}
      {showName && (
        <span className="truncate text-sm font-semibold text-foreground">{name}</span>
      )}
    </div>
  );
}
