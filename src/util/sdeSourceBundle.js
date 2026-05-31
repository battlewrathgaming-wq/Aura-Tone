const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { USER_AGENT } = require('../constants');
const { auraTempRoot, projectRoot } = require('./tempPaths');

const LATEST_METADATA_URL = 'https://developers.eveonline.com/static-data/tranquility/latest.jsonl';
const LATEST_JSONL_ZIP_URL = 'https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip';
const BUILD_JSONL_ZIP_URL_PREFIX = 'https://developers.eveonline.com/static-data/tranquility/eve-online-static-data-';

async function prepareSdeSourceBundle(options = {}) {
  const keepSource = options.keepSource === true || process.env.AURA_CORE_KEEP_SDE_SOURCE === '1';
  const cacheDir = path.resolve(options.cacheDir || process.env.AURA_CORE_SDE_CACHE_DIR || path.join(auraTempRoot(), 'sde'));
  assertProjectLocalPath(cacheDir, 'SDE cache directory');
  fs.mkdirSync(cacheDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const workDir = fs.mkdtempSync(path.join(cacheDir, 'sde-source-'));
  let sourcePath = options.sourcePath ? path.resolve(options.sourcePath) : null;
  let latestMetadata = null;
  let zipDownload = null;
  let sourceUrl = options.sourceUrl || null;
  let buildNumber = options.buildNumber || null;
  let downloaded = false;

  try {
    if (sourcePath) {
      assertProjectLocalPath(sourcePath, 'SDE source path', { allowExternal: options.allowExternalSource === true });
      sourceUrl = sourceUrl || sourcePath;
      buildNumber = buildNumber || buildNumberFromFilename(sourcePath);
    } else {
      latestMetadata = await downloadTextFile({
        url: options.latestMetadataUrl || LATEST_METADATA_URL,
        destination: path.join(workDir, 'latest.jsonl'),
        fetchImpl: options.fetchImpl,
        userAgent: options.userAgent,
        signal: options.signal
      });
      buildNumber = buildNumber || readBuildNumberFromLatestJsonl(latestMetadata.text);
      sourceUrl = buildNumber
        ? buildSdeJsonlZipUrl(buildNumber)
        : (options.latestZipUrl || LATEST_JSONL_ZIP_URL);
      sourcePath = path.join(workDir, buildNumber
        ? `eve-online-static-data-${buildNumber}-jsonl.zip`
        : 'eve-online-static-data-latest-jsonl.zip');
      zipDownload = await downloadBinaryFile({
        url: sourceUrl,
        destination: sourcePath,
        fetchImpl: options.fetchImpl,
        userAgent: options.userAgent,
        signal: options.signal
      });
      downloaded = true;
    }

    const sourceChecksum = checksumFile(sourcePath);
    return {
      status: 'sde source ready',
      started_at: startedAt,
      prepared_at: new Date().toISOString(),
      source_path: sourcePath,
      work_dir: workDir,
      keep_source: keepSource,
      downloaded,
      source: {
        source_url: sourceUrl,
        build_number: buildNumber || null,
        variant: 'jsonl',
        etag: zipDownload?.etag || options.etag || null,
        last_modified: zipDownload?.lastModified || options.lastModified || null,
        file_checksum: sourceChecksum,
        latest_metadata_url: latestMetadata?.url || null,
        latest_metadata_checksum: latestMetadata?.checksum || null,
        latest_metadata_etag: latestMetadata?.etag || null,
        latest_metadata_last_modified: latestMetadata?.lastModified || null
      },
      cleanup: () => cleanupSdeSourceBundle({ workDir, keepSource })
    };
  } catch (error) {
    if (!keepSource) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
    throw error;
  }
}

function cleanupSdeSourceBundle(bundleOrOptions) {
  const workDir = bundleOrOptions?.work_dir || bundleOrOptions?.workDir;
  const keepSource = bundleOrOptions?.keep_source === true || bundleOrOptions?.keepSource === true;
  if (!workDir) {
    return { cleaned: false, reason: 'missing work directory' };
  }
  if (keepSource) {
    return { cleaned: false, reason: 'keep source enabled', work_dir: workDir };
  }
  fs.rmSync(workDir, { recursive: true, force: true });
  return { cleaned: true, work_dir: workDir };
}

function readBuildNumberFromLatestJsonl(text) {
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const record = JSON.parse(line);
    const key = record._key ?? record.key;
    if (String(key) !== 'sde') {
      continue;
    }
    const value = Object.hasOwn(record, '_value') ? record._value : record.value;
    const buildNumber = typeof value === 'object' && value !== null
      ? value.buildNumber || value.build_number || value.version || value.sde
      : value;
    return buildNumber ? String(buildNumber) : null;
  }
  return null;
}

function buildSdeJsonlZipUrl(buildNumber) {
  return `${BUILD_JSONL_ZIP_URL_PREFIX}${buildNumber}-jsonl.zip`;
}

async function downloadTextFile({ url, destination, fetchImpl = fetch, userAgent = USER_AGENT, signal = null }) {
  const response = await fetchImpl(url, {
    method: 'GET',
    signal,
    headers: {
      Accept: 'application/jsonl,text/plain,*/*',
      'User-Agent': userAgent || USER_AGENT
    }
  });
  assertOkResponse(response, url);
  const text = await response.text();
  fs.writeFileSync(destination, text);
  return {
    url,
    destination,
    text,
    checksum: checksumFile(destination),
    etag: response.headers?.get?.('etag') || null,
    lastModified: response.headers?.get?.('last-modified') || null
  };
}

async function downloadBinaryFile({ url, destination, fetchImpl = fetch, userAgent = USER_AGENT, signal = null }) {
  const response = await fetchImpl(url, {
    method: 'GET',
    signal,
    headers: {
      Accept: 'application/zip,application/octet-stream,*/*',
      'User-Agent': userAgent || USER_AGENT
    }
  });
  assertOkResponse(response, url);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, bytes);
  return {
    url,
    destination,
    checksum: checksumFile(destination),
    etag: response.headers?.get?.('etag') || null,
    lastModified: response.headers?.get?.('last-modified') || null
  };
}

function assertOkResponse(response, url) {
  if (!response?.ok) {
    const error = new Error(`SDE source download failed for ${url}: HTTP ${response?.status || 'unknown'}`);
    error.code = 'SDE_SOURCE_DOWNLOAD_FAILED';
    throw error;
  }
}

function checksumFile(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function buildNumberFromFilename(filePath) {
  const match = path.basename(filePath).match(/static-data-(\d+)-jsonl/i);
  return match ? match[1] : null;
}

function assertProjectLocalPath(targetPath, label, options = {}) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedProject = projectRoot();
  const relative = path.relative(resolvedProject, resolvedTarget);
  const isInsideProject = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  if (!isInsideProject && options.allowExternal !== true && process.env.AURA_CORE_ALLOW_EXTERNAL_PATHS !== '1') {
    const error = new Error(`${label} must stay under ${resolvedProject}; set AURA_CORE_ALLOW_EXTERNAL_PATHS=1 to override`);
    error.code = 'SDE_SOURCE_PATH_OUTSIDE_PROJECT';
    throw error;
  }
}

module.exports = {
  LATEST_METADATA_URL,
  LATEST_JSONL_ZIP_URL,
  BUILD_JSONL_ZIP_URL_PREFIX,
  prepareSdeSourceBundle,
  cleanupSdeSourceBundle,
  readBuildNumberFromLatestJsonl,
  buildSdeJsonlZipUrl
};
