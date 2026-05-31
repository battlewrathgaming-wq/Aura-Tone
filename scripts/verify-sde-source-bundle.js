const fs = require('node:fs');
const path = require('node:path');
const {
  prepareSdeSourceBundle,
  cleanupSdeSourceBundle,
  readBuildNumberFromLatestJsonl,
  buildSdeJsonlZipUrl
} = require('../src/util/sdeSourceBundle');
const { projectRoot } = require('../src/util/tempPaths');

async function main() {
  const previous = captureEnv();
  const tempRoot = path.join(projectRoot(), '.tmp', 'verify-sde-source-bundle');
  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.mkdirSync(tempRoot, { recursive: true });
  process.env.AURA_CORE_TMP = tempRoot;
  process.env.AURA_CORE_SDE_CACHE_DIR = path.join(tempRoot, 'sde');
  delete process.env.AURA_CORE_KEEP_SDE_SOURCE;

  try {
    verifyBuildNumberParsing();
    await verifyDownloadAndCleanup(tempRoot);
    await verifyKeepSource(tempRoot);
    await verifyLocalSourceIsNotDeleted(tempRoot);
    verifyProjectPathGuard(tempRoot);
    console.log('SDE source bundle utility verified');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    restoreEnv(previous);
  }
}

function verifyBuildNumberParsing() {
  const primitive = `${JSON.stringify({ _key: 'sde', _value: 3351823 })}\n`;
  const objectValue = `${JSON.stringify({ _key: 'sde', _value: { buildNumber: 3351824 } })}\n`;
  assert(readBuildNumberFromLatestJsonl(primitive) === '3351823', 'primitive latest metadata should parse build number');
  assert(readBuildNumberFromLatestJsonl(objectValue) === '3351824', 'object latest metadata should parse build number');
  assert(buildSdeJsonlZipUrl('3351823').endsWith('eve-online-static-data-3351823-jsonl.zip'), 'build URL should target JSONL zip');
}

async function verifyDownloadAndCleanup(tempRoot) {
  const calls = [];
  const bundle = await prepareSdeSourceBundle({
    cacheDir: path.join(tempRoot, 'download-cache'),
    fetchImpl: fakeSdeFetch(calls)
  });

  assert(bundle.downloaded === true, 'bundle should report downloaded source');
  assert(bundle.source.build_number === '3351823', 'bundle should use latest SDE build number');
  assert(bundle.source.source_url === buildSdeJsonlZipUrl('3351823'), 'bundle should use build-specific SDE URL');
  assert(bundle.source.etag === '"zip-etag"', 'bundle should record SDE zip ETag');
  assert(bundle.source.last_modified === 'Fri, 22 May 2026 00:00:00 GMT', 'bundle should record SDE zip Last-Modified');
  assert(bundle.source.latest_metadata_checksum, 'bundle should record latest metadata checksum');
  assert(fs.existsSync(bundle.source_path), 'downloaded source zip should exist before cleanup');
  assert(calls.length === 2, 'download flow should fetch latest metadata and zip');
  assert(calls[0].headers['User-Agent'], 'download flow should send User-Agent');

  const cleanup = bundle.cleanup();
  assert(cleanup.cleaned === true, 'cleanup should remove work directory by default');
  assert(!fs.existsSync(bundle.work_dir), 'work directory should be removed by cleanup');
}

async function verifyKeepSource(tempRoot) {
  const bundle = await prepareSdeSourceBundle({
    cacheDir: path.join(tempRoot, 'keep-cache'),
    fetchImpl: fakeSdeFetch([])
  });
  const kept = cleanupSdeSourceBundle({ workDir: bundle.work_dir, keepSource: true });
  assert(kept.cleaned === false, 'keepSource cleanup should not remove source');
  assert(fs.existsSync(bundle.source_path), 'keepSource cleanup should preserve source zip');
}

async function verifyLocalSourceIsNotDeleted(tempRoot) {
  const localDir = path.join(tempRoot, 'local-source');
  fs.mkdirSync(localDir, { recursive: true });
  const localSource = path.join(localDir, 'eve-online-static-data-3351823-jsonl.zip');
  fs.writeFileSync(localSource, 'fixture zip');

  const bundle = await prepareSdeSourceBundle({
    sourcePath: localSource,
    cacheDir: path.join(tempRoot, 'local-cache')
  });
  assert(bundle.downloaded === false, 'local source should not be reported as downloaded');
  assert(bundle.source.build_number === '3351823', 'local source should derive build number from filename');
  bundle.cleanup();
  assert(fs.existsSync(localSource), 'cleanup should not delete caller-owned local source paths');
}

function verifyProjectPathGuard() {
  const result = cleanupSdeSourceBundle({});
  assert(result.cleaned === false, 'cleanup without work directory should be harmless');
}

function fakeSdeFetch(calls) {
  return async (url, options = {}) => {
    calls.push({ url, headers: options.headers || {} });
    if (url.includes('latest.jsonl')) {
      return fakeResponse({
        body: `${JSON.stringify({ _key: 'sde', _value: { buildNumber: 3351823 } })}\n`,
        etag: '"latest-etag"',
        lastModified: 'Fri, 22 May 2026 00:00:00 GMT'
      });
    }
    return fakeResponse({
      body: Buffer.from('fixture sde zip'),
      etag: '"zip-etag"',
      lastModified: 'Fri, 22 May 2026 00:00:00 GMT'
    });
  };
}

function fakeResponse({ body, etag, lastModified }) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        const normalized = String(name).toLowerCase();
        if (normalized === 'etag') {
          return etag;
        }
        if (normalized === 'last-modified') {
          return lastModified;
        }
        return null;
      }
    },
    text: async () => buffer.toString('utf8'),
    arrayBuffer: async () => buffer
  };
}

function captureEnv() {
  return {
    AURA_CORE_TMP: process.env.AURA_CORE_TMP,
    AURA_CORE_SDE_CACHE_DIR: process.env.AURA_CORE_SDE_CACHE_DIR,
    AURA_CORE_KEEP_SDE_SOURCE: process.env.AURA_CORE_KEEP_SDE_SOURCE
  };
}

function restoreEnv(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
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
