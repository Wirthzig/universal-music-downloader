export interface HistoryItem {
    id: string;
    source: 'spotify' | 'soundcloud' | 'youtube';
    title: string;
    artist: string;
    timestamp: number;
}

const STORAGE_KEY = 'global_download_history';
const OLD_KEY = 'download_history';

export class HistoryManager {
    static getHistory(): HistoryItem[] {
        let history: HistoryItem[] = [];
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                history = JSON.parse(raw);
            }
        } catch (e) {
            console.error('Failed to parse history', e);
        }

        // Migration of old history (if exists and not already migrated)
        const oldRaw = localStorage.getItem(OLD_KEY);
        if (oldRaw) {
            try {
                const oldIds: string[] = JSON.parse(oldRaw);
                if (oldIds.length > 0) {
                    // Filter out IDs that are already in the new history to avoid duplicates
                    const existingIds = new Set(history.map(h => h.id));
                    const newItems = oldIds
                        .filter(id => !existingIds.has(id))
                        .map(id => ({
                            id,
                            source: 'spotify' as const, // Assume old history was Spotify
                            title: 'Unknown Title',
                            artist: 'Unknown Artist',
                            timestamp: Date.now()
                        }));

                    history = [...history, ...newItems];
                    // Save merged history
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
                    // Optional: remove old key? detailed below
                    // localStorage.removeItem(OLD_KEY); 
                }
            } catch (e) {
                console.error('Migration failed', e);
            }
        }

        return history;
    }

    static add(item: HistoryItem) {
        const history = this.getHistory();
        // Check for duplicates
        if (!history.find(h => h.id === item.id)) {
            history.push(item);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        }
    }

    static remove(id: string) {
        let history = this.getHistory();
        history = history.filter(h => h.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }

    static has(id: string): boolean {
        const history = this.getHistory();
        return history.some(h => h.id === id);
    }
}
