const AGENT_SOURCES = ['REGISTERED_AGENT', 'MANAGED_AGENT', 'REFERRAL_PARTNER'];

function validateSourceShape(sourceType, sourceAgentId) {
  if (!sourceType) return { valid: false, message: 'Student Source is required' };
  if (sourceType === 'DIRECT_STUDENT') return sourceAgentId
    ? { valid: false, message: 'Direct Student cannot have an Agent' }
    : { valid: true, sourceAgentId: null };
  if (!AGENT_SOURCES.includes(sourceType)) return { valid: false, message: 'Invalid Student Source' };
  if (!sourceAgentId) return { valid: false, message: 'Select Agent is required' };
  return { valid: true, sourceAgentId };
}

module.exports = { AGENT_SOURCES, validateSourceShape };
