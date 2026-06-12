import { cn, getStatusColor, formatStatusLabel } from '../../lib/utils';

export default function StatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        getStatusColor(status),
        className
      )}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
