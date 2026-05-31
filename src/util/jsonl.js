const fs = require('node:fs');
const readline = require('node:readline');

async function readJsonLines(filePath, onRecord) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lines = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let record;
    try {
      record = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`Invalid JSONL in ${filePath}:${lineNumber}: ${error.message}`);
    }

    await onRecord(unwrapJsonlRecord(record), record, lineNumber);
  }
}

function unwrapJsonlRecord(record) {
  if (record && Object.hasOwn(record, '_key')) {
    return {
      key: record._key,
      value: Object.hasOwn(record, '_value') ? record._value : record
    };
  }

  return {
    key: record?.id ?? record?.ID ?? null,
    value: record
  };
}

module.exports = {
  readJsonLines,
  unwrapJsonlRecord
};
