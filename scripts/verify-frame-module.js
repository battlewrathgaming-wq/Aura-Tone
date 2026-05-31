const fs = require('node:fs');
const path = require('node:path');
const {
  frameChannels,
  normalizeFrameOptions,
  normalizeFrameState
} = require('../src/modules/Frame');
const { projectRoot } = require('../src/util/tempPaths');

function main() {
  verifyPureHelpers();
  verifySourceBoundaries();
  console.log('Frame module verified');
}

function verifyPureHelpers() {
  const channels = frameChannels();
  assert(channels.getState === 'aura:window:get-state', 'Frame channels should use aura window prefix');
  assert(channels.setAlwaysOnTop === 'aura:window:set-always-on-top', 'Frame channels should include always-on-top toggle');

  const hudOptions = normalizeFrameOptions({
    title: 'HUD',
    transparent: true,
    defaultAlwaysOnTop: true
  });
  assert(hudOptions.transparent === true, 'Frame options should support transparent HUD windows');
  assert(hudOptions.defaultAlwaysOnTop === true, 'Frame options should support default pinned HUD windows');

  const defaultState = normalizeFrameState({}, { defaultAlwaysOnTop: true });
  assert(defaultState.alwaysOnTop === true, 'Frame state should honor default always-on-top when no state exists');

  const normalized = normalizeFrameState({
    alwaysOnTop: false,
    bounds: { x: 10.1, y: 20.9, width: 800, height: 500 }
  });
  assert(normalized.alwaysOnTop === false, 'Frame state should preserve explicit false always-on-top');
  assert(normalized.bounds.x === 10, 'Frame state should normalize bound x');
  assert(normalized.bounds.y === 21, 'Frame state should normalize bound y');
  const nullBoundsState = normalizeFrameState({ bounds: null });
  assert(nullBoundsState.bounds === null, 'Frame state should preserve null bounds safely');
}

function verifySourceBoundaries() {
  const root = projectRoot();
  const mainText = read(path.join(root, 'src', 'main', 'main.js'));
  const preloadText = read(path.join(root, 'src', 'main', 'preload.js'));
  const rendererText = read(path.join(root, 'src', 'renderer', 'app.js'));
  const htmlText = read(path.join(root, 'src', 'renderer', 'index.html'));
  const styleText = read(path.join(root, 'src', 'renderer', 'styles.css'));
  const shellText = read(path.join(root, 'src', 'modules', 'Frame', 'windowShell.js'));

  assert(mainText.includes("require('../modules/Frame')"), 'main should create windows through Frame module');
  assert(shellText.includes('frame: false'), 'Frame module should create frameless windows');
  assert(shellText.includes('alwaysOnTop: state.alwaysOnTop'), 'Frame module should restore always-on-top state');
  assert(shellText.includes('state.bounds && state.bounds.x !== null && state.bounds.y !== null'), 'Frame module should not dereference null bounds');
  assert(shellText.includes('FRAME_INVALID_ALWAYS_ON_TOP'), 'Frame module should reject invalid always-on-top payloads');
  assert(shellText.includes('setAlwaysOnTop'), 'Frame module should expose always-on-top mutation');
  assert(preloadText.includes('auraWindow'), 'preload should expose auraWindow bridge');
  assert(preloadText.includes('aura:window:set-always-on-top'), 'preload should expose always-on-top IPC');
  assert(htmlText.includes('frame-chrome'), 'renderer should include Frame chrome');
  assert(htmlText.includes('pin-window'), 'renderer should include pin control');
  assert(rendererText.includes('window.auraWindow.setAlwaysOnTop'), 'renderer should toggle always-on-top through auraWindow');
  assert(styleText.includes('-webkit-app-region: drag'), 'Frame chrome should include drag region');
  assert(styleText.includes('-webkit-app-region: no-drag'), 'Frame controls should include no-drag region');
  assert(!/require\s*\(/.test(rendererText), 'renderer should not require Electron or backend modules');
  assert(!/ipcRenderer|BrowserWindow/.test(rendererText), 'renderer should not reference Electron APIs directly');
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main();
