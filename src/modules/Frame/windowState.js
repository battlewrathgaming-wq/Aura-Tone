const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_FRAME_STATE = Object.freeze({
  alwaysOnTop: false,
  bounds: null
});

function loadFrameState(app, options = {}) {
  const filePath = frameStatePath(app, options);
  try {
    if (!fs.existsSync(filePath)) {
      return { ...DEFAULT_FRAME_STATE, alwaysOnTop: options.defaultAlwaysOnTop === true };
    }
    return normalizeFrameState(JSON.parse(fs.readFileSync(filePath, 'utf8')), options);
  } catch {
    return { ...DEFAULT_FRAME_STATE, alwaysOnTop: options.defaultAlwaysOnTop === true };
  }
}

function saveFrameState(app, state, options = {}) {
  const filePath = frameStatePath(app, options);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const normalized = normalizeFrameState(state, options);
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

function frameStatePath(app, options = {}) {
  if (options.settingsPath) {
    return path.resolve(options.settingsPath);
  }
  if (process.env.AURA_FRAME_SETTINGS_PATH) {
    return path.resolve(process.env.AURA_FRAME_SETTINGS_PATH);
  }
  return path.join(app.getPath('userData'), 'aura-frame-state.json');
}

function normalizeFrameState(state = {}, options = {}) {
  return {
    alwaysOnTop: state.alwaysOnTop === true || (state.alwaysOnTop === undefined && options.defaultAlwaysOnTop === true),
    bounds: normalizeBounds(state.bounds)
  };
}

function normalizeBounds(bounds) {
  if (!bounds || typeof bounds !== 'object') {
    return null;
  }
  const normalized = {
    x: numberOrNull(bounds.x),
    y: numberOrNull(bounds.y),
    width: positiveNumberOrNull(bounds.width),
    height: positiveNumberOrNull(bounds.height)
  };
  if (!normalized.width || !normalized.height) {
    return null;
  }
  return normalized;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function positiveNumberOrNull(value) {
  const number = numberOrNull(value);
  return number && number > 0 ? number : null;
}

module.exports = {
  DEFAULT_FRAME_STATE,
  frameStatePath,
  loadFrameState,
  normalizeFrameState,
  saveFrameState
};
