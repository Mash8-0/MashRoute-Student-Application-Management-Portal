// Agent tier sequence (lowest → highest). Drives per-university commission.
// Keep in sync with frontend/src/lib/agentCategories.js
const AGENT_CATEGORIES = [
  { value: 'STANDARD', label: 'Standard Agent', tier: 1 },
  { value: 'PRIORITY', label: 'Priority Agent', tier: 2 },
  { value: 'PREMIUM', label: 'Premium Agent', tier: 3 },
  { value: 'ELITE', label: 'Elite Agent', tier: 4 },
  { value: 'PREMIUM_PARTNER', label: 'Premium Partner', tier: 5 },
  { value: 'ELITE_PARTNER', label: 'Elite Partner', tier: 6 },
  { value: 'STRATEGIC_PARTNER', label: 'Strategic Partner', tier: 7 },
  { value: 'MASTER', label: 'Master Agent', tier: 8 },
];

const AGENT_CATEGORY_VALUES = AGENT_CATEGORIES.map((c) => c.value);

const isValidCategory = (v) => AGENT_CATEGORY_VALUES.includes(v);

module.exports = { AGENT_CATEGORIES, AGENT_CATEGORY_VALUES, isValidCategory };
