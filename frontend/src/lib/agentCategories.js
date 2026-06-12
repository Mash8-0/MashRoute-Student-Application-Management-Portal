// Agent tier sequence (lowest → highest). Drives per-university commission.
// Keep in sync with backend/src/utils/agentCategories.js
export const AGENT_CATEGORIES = [
  { value: 'STANDARD', label: 'Standard Agent', tier: 1, desc: 'Basic approved agent' },
  { value: 'PRIORITY', label: 'Priority Agent', tier: 2, desc: 'Regular active agent with priority support' },
  { value: 'PREMIUM', label: 'Premium Agent', tier: 3, desc: 'Trusted agent with quality applications' },
  { value: 'ELITE', label: 'Elite Agent', tier: 4, desc: 'Top-performing individual agent' },
  { value: 'PREMIUM_PARTNER', label: 'Premium Partner', tier: 5, desc: 'Trusted agency / company partner' },
  { value: 'ELITE_PARTNER', label: 'Elite Partner', tier: 6, desc: 'High-volume strong agency partner' },
  { value: 'STRATEGIC_PARTNER', label: 'Strategic Partner', tier: 7, desc: 'Long-term special business partner' },
  { value: 'MASTER', label: 'Master Agent', tier: 8, desc: 'Highest level, can manage sub-agents' },
];

export const CATEGORY_LABELS = Object.fromEntries(AGENT_CATEGORIES.map((c) => [c.value, c.label]));

// When the agency releases commission to the agent.
export const COMMISSION_RELEASE_OPTIONS = [
  { value: 'UPFRONT', label: 'Upfront' },
  { value: 'AFTER_REGISTRATION', label: 'Upon registration' },
  { value: 'AFTER_ENROLLMENT', label: 'Upon successful enrollment' },
  { value: 'ON_COMPLETION', label: 'Upon completion' },
];

export const releaseLabel = (v) =>
  COMMISSION_RELEASE_OPTIONS.find((o) => o.value === v)?.label || 'Upon registration';

export const PAYOUT_METHODS = ['Bank Transfer', 'Cheque', 'Cash', 'Online Wallet', 'Adjusted against fees'];

export const categoryLabel = (v) => CATEGORY_LABELS[v] || v || '—';

// Format a commission row for display, e.g. "5%" or "MYR 1,500".
export function formatCommission(row) {
  if (!row || row.amount == null || row.amount === '') return '—';
  const amt = Number(row.amount);
  if (Number.isNaN(amt)) return '—';
  if (row.type === 'PERCENTAGE') return `${amt}%`;
  return `${row.currency || 'MYR'} ${amt.toLocaleString()}`;
}
