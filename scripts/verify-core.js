const path = require('node:path');
const { checksumPayload, stableStringify } = require('../src/util/checksum');
const { readJsonLines, unwrapJsonlRecord } = require('../src/util/jsonl');
const { projectRoot } = require('../src/util/tempPaths');
const { summarizeRecords } = require('../src/core/recordSummary');

async function main() {
  assert(stableStringify({ b: 2, a: 1 }) === '{"a":1,"b":2}', 'stable stringify should sort object keys');
  assert(
    checksumPayload({ b: 2, a: 1 }) === checksumPayload({ a: 1, b: 2 }),
    'checksum should be stable regardless of object key order'
  );

  const wrapped = unwrapJsonlRecord({ _key: 'row-1', _value: { id: 1 } });
  assert(wrapped.key === 'row-1', 'JSONL unwrap should preserve _key');
  assert(wrapped.value.id === 1, 'JSONL unwrap should preserve _value');

  const records = [];
  await readJsonLines(path.join(projectRoot(), 'fixtures', 'sample-records.jsonl'), ({ value }) => {
    records.push(value);
  });

  const summary = summarizeRecords(records);
  assert(summary.total === 3, 'sample fixture should contain three records');
  assert(summary.kinds.find((entry) => entry.kind === 'note')?.count === 2, 'summary should count note records');
  assert(summary.kinds.find((entry) => entry.kind === 'task')?.count === 1, 'summary should count task records');

  console.log('core utilities verified');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
