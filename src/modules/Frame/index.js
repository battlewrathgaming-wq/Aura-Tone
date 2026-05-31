const {
  DEFAULT_FRAME_STATE,
  frameStatePath,
  loadFrameState,
  normalizeFrameState,
  saveFrameState
} = require('./windowState');
const {
  DEFAULT_FRAME_OPTIONS,
  createFrameWindow,
  frameChannels,
  frameStateForWindow,
  normalizeFrameOptions,
  registerFrameWindowHandlers
} = require('./windowShell');

module.exports = {
  DEFAULT_FRAME_OPTIONS,
  DEFAULT_FRAME_STATE,
  createFrameWindow,
  frameChannels,
  frameStateForWindow,
  frameStatePath,
  loadFrameState,
  normalizeFrameOptions,
  normalizeFrameState,
  registerFrameWindowHandlers,
  saveFrameState
};
