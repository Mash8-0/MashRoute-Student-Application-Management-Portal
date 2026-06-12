import { motion } from 'framer-motion';

export default function PageHeader({ title, description, actions, breadcrumbs }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        {breadcrumbs && (
          <p className="mb-1 text-xs text-muted-foreground">{breadcrumbs}</p>
        )}
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 mt-2 sm:mt-0">{actions}</div>}
    </motion.div>
  );
}
