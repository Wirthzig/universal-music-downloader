import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    initDependencies: () => ipcRenderer.invoke('init-dependencies'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    searchYoutube: (query: any) => ipcRenderer.invoke('search-youtube', query),
    fetchMetadata: (url: string) => ipcRenderer.invoke('fetch-metadata', url),
    downloadSong: (data: any) => ipcRenderer.invoke('download-song', data),
});
