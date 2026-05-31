const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aura', {
  listServices: () => ipcRenderer.invoke('aura:service:list'),
  invokeService: (command, payload = {}, options = {}) => ipcRenderer.invoke('aura:service:invoke', {
    command,
    payload,
    ...options
  })
});

contextBridge.exposeInMainWorld('auraWindow', {
  getState: () => ipcRenderer.invoke('aura:window:get-state'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('aura:window:set-always-on-top', enabled === true),
  minimize: () => ipcRenderer.invoke('aura:window:minimize'),
  close: () => ipcRenderer.invoke('aura:window:close')
});
