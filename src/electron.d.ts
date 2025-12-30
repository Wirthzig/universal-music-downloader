export interface ElectronAPI {
    initDependencies: () => Promise<void>;
    selectFolder: () => Promise<string | null>;
    searchYoutube: (query: { artist: string; title: string; duration?: number } | string) => Promise<string | null>;
    fetchMetadata: (url: string) => Promise<{ success: boolean; tracks?: any[]; error?: string }>;
    downloadSong: (data: { url: string; folder: string; artist: string; title: string }) => Promise<{ success: boolean; error?: string }>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
