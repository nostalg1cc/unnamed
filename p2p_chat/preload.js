const { contextBridge, ipcRenderer } = require('electron');
const SimplePeer = require('simple-peer'); // Require it here in preload

contextBridge.exposeInMainWorld('electronAPI', {
  SimplePeer: SimplePeer, // Expose SimplePeer class
  // Example for IPC if needed later:
  // generateIdPython: () => ipcRenderer.invoke('generate-id-python'),
  // You could also expose other Node.js modules needed by the renderer this way,
  // e.g., specific parts of 'fs' or 'path' if absolutely necessary,
  // though it's better to handle file operations in main via IPC if possible.
});

console.log('preload.js loaded and SimplePeer exposed.');
