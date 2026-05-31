const path = require('node:path');
const { loadFrameState, saveFrameState } = require('./windowState');

const DEFAULT_FRAME_OPTIONS = Object.freeze({
  width: 960,
  height: 640,
  minWidth: 720,
  minHeight: 480,
  title: 'Aura',
  frame: false,
  transparent: false,
  resizable: true,
  backgroundColor: '#f5f7f8',
  defaultAlwaysOnTop: false,
  persistBounds: false
});

function createFrameWindow(app, options = {}) {
  const { BrowserWindow } = require('electron');
  const frameOptions = normalizeFrameOptions(options);
  const state = loadFrameState(app, frameOptions);
  const windowOptions = {
    width: state.bounds?.width || frameOptions.width,
    height: state.bounds?.height || frameOptions.height,
    minWidth: frameOptions.minWidth,
    minHeight: frameOptions.minHeight,
    title: frameOptions.title,
    frame: false,
    transparent: frameOptions.transparent,
    alwaysOnTop: state.alwaysOnTop,
    resizable: frameOptions.resizable,
    backgroundColor: frameOptions.backgroundColor,
    webPreferences: {
      preload: frameOptions.preload,
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  if (state.bounds && state.bounds.x !== null && state.bounds.y !== null) {
    windowOptions.x = state.bounds.x;
    windowOptions.y = state.bounds.y;
  }

  const window = new BrowserWindow(windowOptions);
  window.__auraFrameOptions = frameOptions;
  window.__auraFrameState = state;

  if (frameOptions.persistBounds) {
    window.on('close', () => {
      saveFrameState(app, {
        ...window.__auraFrameState,
        bounds: window.getBounds()
      }, frameOptions);
    });
  }

  return window;
}

function registerFrameWindowHandlers(ipcMain, app, getWindow, options = {}) {
  const channels = frameChannels(options.channelPrefix);

  ipcMain.handle(channels.getState, () => frameStateForWindow(getWindow()));

  ipcMain.handle(channels.setAlwaysOnTop, (_event, enabled) => {
    if (typeof enabled !== 'boolean') {
      const error = new Error('Always-on-top value must be a boolean');
      error.code = 'FRAME_INVALID_ALWAYS_ON_TOP';
      throw error;
    }
    const window = getWindow();
    const next = enabled;
    if (window && !window.isDestroyed()) {
      window.setAlwaysOnTop(next);
      window.__auraFrameState = saveFrameState(app, {
        ...window.__auraFrameState,
        alwaysOnTop: next,
        bounds: window.__auraFrameOptions?.persistBounds ? window.getBounds() : window.__auraFrameState?.bounds
      }, window.__auraFrameOptions || options);
    }
    return frameStateForWindow(window);
  });

  ipcMain.handle(channels.minimize, () => {
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.minimize();
    }
    return { minimized: true };
  });

  ipcMain.handle(channels.close, () => {
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.close();
    }
    return { closed: true };
  });

  return channels;
}

function frameStateForWindow(window) {
  if (!window || window.isDestroyed()) {
    return {
      alwaysOnTop: false,
      bounds: null
    };
  }
  return {
    alwaysOnTop: Boolean(window.isAlwaysOnTop()),
    bounds: window.__auraFrameOptions?.persistBounds ? window.getBounds() : null
  };
}

function frameChannels(prefix = 'aura:window') {
  return {
    getState: `${prefix}:get-state`,
    setAlwaysOnTop: `${prefix}:set-always-on-top`,
    minimize: `${prefix}:minimize`,
    close: `${prefix}:close`
  };
}

function normalizeFrameOptions(options = {}) {
  return {
    ...DEFAULT_FRAME_OPTIONS,
    ...options,
    preload: options.preload || path.join(__dirname, '..', '..', 'main', 'preload.js')
  };
}

module.exports = {
  DEFAULT_FRAME_OPTIONS,
  createFrameWindow,
  frameChannels,
  frameStateForWindow,
  normalizeFrameOptions,
  registerFrameWindowHandlers
};
