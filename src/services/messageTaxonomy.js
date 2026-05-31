const SEVERITIES = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  DEGRADED: 'degraded',
  ERROR: 'error',
  BLOCKED: 'blocked'
});

const CATEGORIES = Object.freeze({
  ARTIFACT: 'artifact',
  COMPUTE: 'compute',
  IO: 'io',
  NETWORK: 'network',
  READINESS: 'readiness',
  SERVICE: 'service',
  TASK: 'task',
  USER_ACTION: 'user_action',
  VALIDATION: 'validation'
});

const DEFINITIONS = Object.freeze({
  CHECKSUM_MISMATCH: definition(SEVERITIES.ERROR, CATEGORIES.ARTIFACT, true),
  EXTERNAL_CALL_BLOCKED: definition(SEVERITIES.BLOCKED, CATEGORIES.NETWORK, true),
  HTTP_CANCELLED: definition(SEVERITIES.WARNING, CATEGORIES.NETWORK, true),
  HTTP_INVALID_JSON: definition(SEVERITIES.ERROR, CATEGORIES.NETWORK, true),
  HTTP_TIMEOUT: definition(SEVERITIES.WARNING, CATEGORIES.NETWORK, true),
  PARTIAL_RESULT: definition(SEVERITIES.INFO, CATEGORIES.COMPUTE, false),
  RUNTIME_PATHS_INVALID: definition(SEVERITIES.BLOCKED, CATEGORIES.READINESS, true),
  SERVICE_CONTEXT_MISSING: definition(SEVERITIES.ERROR, CATEGORIES.SERVICE, true),
  SERVICE_UNKNOWN_COMMAND: definition(SEVERITIES.ERROR, CATEGORIES.SERVICE, true),
  TASK_CANCELLED: definition(SEVERITIES.WARNING, CATEGORIES.TASK, true),
  TASK_FAILED: definition(SEVERITIES.ERROR, CATEGORIES.TASK, true),
  TASK_LOCKED: definition(SEVERITIES.BLOCKED, CATEGORIES.TASK, true),
  TASK_WARNING: definition(SEVERITIES.WARNING, CATEGORIES.TASK, false),
  USER_AGENT_MISSING: definition(SEVERITIES.BLOCKED, CATEGORIES.NETWORK, true),
  VALIDATION_FAILED: definition(SEVERITIES.WARNING, CATEGORIES.VALIDATION, true)
});

function taxonomyMessage(code, message, overrides = {}) {
  const normalizedCode = normalizeCode(code);
  const base = DEFINITIONS[normalizedCode] || definition(SEVERITIES.WARNING, CATEGORIES.USER_ACTION, false);
  return {
    severity: overrides.severity || base.severity,
    code: normalizedCode,
    message,
    category: overrides.category || base.category,
    source: overrides.source || null,
    actionable: overrides.actionable !== undefined ? Boolean(overrides.actionable) : base.actionable
  };
}

function normalizeMessage(entry = {}, fallback = {}) {
  return taxonomyMessage(
    entry.code || fallback.code || 'TASK_WARNING',
    entry.message || fallback.message || String(entry),
    {
      severity: entry.severity || fallback.severity,
      category: entry.category || fallback.category,
      source: entry.source || fallback.source,
      actionable: entry.actionable ?? fallback.actionable
    }
  );
}

function validateTaxonomyMessage(entry) {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  return Object.values(SEVERITIES).includes(entry.severity) &&
    typeof entry.code === 'string' &&
    entry.code.length > 0 &&
    typeof entry.message === 'string' &&
    entry.message.length > 0 &&
    Object.values(CATEGORIES).includes(entry.category) &&
    typeof entry.actionable === 'boolean';
}

function knownCodes() {
  return Object.keys(DEFINITIONS).sort();
}

function normalizeCode(code) {
  return String(code || 'TASK_WARNING').trim().toUpperCase();
}

function definition(severity, category, actionable) {
  return { severity, category, actionable };
}

module.exports = {
  SEVERITIES,
  CATEGORIES,
  taxonomyMessage,
  normalizeMessage,
  validateTaxonomyMessage,
  knownCodes
};
