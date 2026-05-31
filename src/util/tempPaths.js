const fs = require('node:fs');
const path = require('node:path');

function projectRoot() {
  return path.resolve(__dirname, '..', '..');
}

function auraTempRoot() {
  const root = process.env.AURA_CORE_TMP || path.join(projectRoot(), '.tmp');
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function makeAuraTempDir(prefix) {
  fs.mkdirSync(auraTempRoot(), { recursive: true });
  return fs.mkdtempSync(path.join(auraTempRoot(), `${prefix}-`));
}

module.exports = {
  auraTempRoot,
  makeAuraTempDir,
  projectRoot
};
