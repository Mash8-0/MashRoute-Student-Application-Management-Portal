import { useState } from 'react';
import { cn, getInitials } from '../../lib/utils';

const sizeMap = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-base',
};

const imageSizeMap = {
  sm: 'h-9 w-16',
  md: 'h-10 w-20',
  lg: 'h-12 w-24',
};

export default function CompanyBrand({ name, logo, size = 'md', showName = true, className = '' }) {
  const [imgError, setImgError] = useState(false);
  const sizeClasses = sizeMap[size] || sizeMap.md;
  const imageSizeClasses = imageSizeMap[size] || imageSizeMap.md;
  const initials = getInitials(name);

  const showImage = logo && !imgError;

  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      {showImage ? (
        <img
          src={logo}
          alt={name || 'Company logo'}
          onError={() => setImgError(true)}
          className={cn(
            imageSizeClasses,
            'flex-shrink-0 rounded-md border border-border/60 bg-white object-contain p-1 shadow-sm'
          )}
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
