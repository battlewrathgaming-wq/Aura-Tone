function summarizeRecords(records = []) {
  const normalized = records.map(normalizeRecord);
  const byKind = new Map();

  for (const record of normalized) {
    byKind.set(record.kind, (byKind.get(record.kind) || 0) + 1);
  }

  return {
    total: normalized.length,
    kinds: Array.from(byKind.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([kind, count]) => ({ kind, count }))
  };
}

function normalizeRecord(record = {}) {
  return {
    id: record.id !== undefined && record.id !== null ? String(record.id) : null,
    kind: String(record.kind || 'unknown').trim().toLowerCase() || 'unknown',
    label: record.label ? String(record.label) : null
  };
}

module.exports = {
  normalizeRecord,
  summarizeRecords
};
