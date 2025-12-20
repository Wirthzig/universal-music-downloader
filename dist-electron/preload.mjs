"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  initDependencies: () => electron.ipcRenderer.invoke("init-dependencies"),
  selectFolder: () => electron.ipcRenderer.invoke("select-folder"),
  searchYoutube: (query) => electron.ipcRenderer.invoke("search-youtube", query),
  fetchMetadata: (url) => electron.ipcRenderer.invoke("fetch-metadata", url),
  downloadSong: (data) => electron.ipcRenderer.invoke("download-song", data)
});
