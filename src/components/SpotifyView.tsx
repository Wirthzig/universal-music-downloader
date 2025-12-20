import axios from 'axios';
import { AlertCircle, Check, ChevronLeft, DownloadCloud, FolderOpen, Search, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import Logo from '../assets/Logo.png';
import { HistoryManager } from '../utils/historyManager';

interface Song {
    id: string;
    title: string;
    artist: string;
    status: 'pending' | 'searching' | 'found' | 'notFound' | 'downloading' | 'downloaded' | 'error' | 'exists';
    youtubeUrl?: string;
    isSelected: boolean;
    isPreviouslyDownloaded?: boolean;
}

interface Props {
    onBack: () => void;
}

export function SpotifyView({ onBack }: Props) {
    const [clientId, setClientId] = useState(localStorage.getItem('spotify_client_id') || '');
    const [clientSecret, setClientSecret] = useState(localStorage.getItem('spotify_client_secret') || '');
    const [overlayDismissed, setOverlayDismissed] = useState(false);

    // Derived state for overlay
    const hasCreds = clientId.length > 0 && clientSecret.length > 0;


    const [playlistUrl, setPlaylistUrl] = useState('');
    const [songs, setSongs] = useState<Song[]>([]);
    const [statusMsg, setStatusMsg] = useState('Ready');
    const [targetFolder, setTargetFolder] = useState<string | null>(localStorage.getItem('target_folder'));
    const [isProcessing, setIsProcessing] = useState(false);
    const abortRef = useRef(false);

    // History is now managed by HistoryManager, we just need to trigger re-renders if needed, 
    // but for now we check directly during scan/download.

    const saveCreds = () => {
        localStorage.setItem('spotify_client_id', clientId);
        localStorage.setItem('spotify_client_secret', clientSecret);
    };

    const getSpotifyToken = async () => {
        const authString = btoa(`${clientId}:${clientSecret}`);
        try {
            const res = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            return res.data.access_token;
        } catch (e) {
            console.error(e);
            setStatusMsg('Spotify Auth Failed');
            return null;
        }
    };

    const scanPlaylist = async () => {
        saveCreds();
        const token = await getSpotifyToken();
        if (!token) return;

        setStatusMsg('Fetching...');

        let id = '';
        const isTrack = playlistUrl.includes('/track/');
        const isPlaylist = playlistUrl.includes('/playlist/');

        if (isTrack) {
            id = playlistUrl.split('/track/')[1]?.split('?')[0];
        } else if (isPlaylist) {
            id = playlistUrl.split('/playlist/')[1]?.split('?')[0];
        }

        if (!id) {
            setStatusMsg('Invalid URL');
            return;
        }

        try {
            let allSongs: Song[] = [];

            if (isTrack) {
                // Single Track
                const res = await axios.get(`https://api.spotify.com/v1/tracks/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
                const item = res.data;
                const isDownloaded = HistoryManager.has(item.id);
                allSongs = [{
                    id: item.id,
                    title: item.name,
                    artist: item.artists.map((a: any) => a.name).join(', '),
                    status: isDownloaded ? 'exists' : 'pending',
                    isSelected: !isDownloaded,
                    isPreviouslyDownloaded: isDownloaded
                }];
            } else {
                // Playlist
                let nextUrl = `https://api.spotify.com/v1/playlists/${id}/tracks`;
                while (nextUrl) {
                    const res = await axios.get(nextUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                    const newItems = res.data.items.map((item: any) => {
                        const trackId = item.track.id;
                        const isDownloaded = HistoryManager.has(trackId);
                        return {
                            id: trackId,
                            title: item.track.name,
                            artist: item.track.artists.map((a: any) => a.name).join(', '),
                            status: (isDownloaded ? 'exists' : 'pending') as 'pending' | 'downloading' | 'downloaded' | 'error' | 'exists',
                            isSelected: !isDownloaded,
                            isPreviouslyDownloaded: isDownloaded
                        };
                    });
                    allSongs = [...allSongs, ...newItems];
                    nextUrl = res.data.next;
                }
            }
            setSongs(allSongs);
            setStatusMsg(`Found ${allSongs.length} item(s).`);
        } catch (e) {
            setStatusMsg('Error fetching data');
            console.error(e);
        }
    };

    const selectFolder = async () => {
        const path = await window.electronAPI.selectFolder();
        if (path) {
            setTargetFolder(path);
            localStorage.setItem('target_folder', path);
        }
    };

    // --- Combined Workflow ---
    const startProcess = async () => {
        if (!targetFolder) {
            alert('Please select a download folder first.');
            return;
        }

        setIsProcessing(true);
        abortRef.current = false;
        setStatusMsg('Starting Download Queue...');

        const newSongs = [...songs];

        for (let i = 0; i < newSongs.length; i++) {
            if (abortRef.current) break;

            if (newSongs[i].isSelected) {

                // 1. Search (if no URL yet)
                if (!newSongs[i].youtubeUrl) {
                    newSongs[i].status = 'searching';
                    setSongs([...newSongs]);

                    // Pass explicit object for better filtering
                    const url = await window.electronAPI.searchYoutube({
                        artist: newSongs[i].artist,
                        title: newSongs[i].title
                    });

                    if (!url) {
                        newSongs[i].status = 'notFound';
                        setSongs([...newSongs]);
                        continue; // Skip download
                    }
                    newSongs[i].youtubeUrl = url;
                    newSongs[i].status = 'found';
                    setSongs([...newSongs]);
                }

                // 2. Download
                newSongs[i].status = 'downloading';
                setSongs([...newSongs]);

                const res = await window.electronAPI.downloadSong({
                    url: newSongs[i].youtubeUrl!,
                    folder: targetFolder,
                    artist: newSongs[i].artist,
                    title: newSongs[i].title
                });

                if (res.success) {
                    newSongs[i].status = 'downloaded';
                    HistoryManager.add({
                        id: newSongs[i].id,
                        source: 'spotify',
                        title: newSongs[i].title,
                        artist: newSongs[i].artist,
                        timestamp: Date.now()
                    });
                } else {
                    newSongs[i].status = 'error';
                }
                setSongs([...newSongs]);

                // Rate limit delay
                if (!abortRef.current) await new Promise(r => setTimeout(r, 1500));
            }
        }

        setIsProcessing(false);
        setStatusMsg(abortRef.current ? 'Stopped' : 'All Done');
    };

    const stopProcess = () => {
        abortRef.current = true;
        setStatusMsg('Stopping...');
    };

    const toggleSelect = (idx: number) => {
        const newSongs = [...songs];
        newSongs[idx].isSelected = !newSongs[idx].isSelected;
        setSongs(newSongs);
    };

    const selectAll = () => setSongs(songs.map(s => ({ ...s, isSelected: true })));
    const selectNone = () => setSongs(songs.map(s => ({ ...s, isSelected: false })));
    const selectNew = () => setSongs(songs.map(s => ({
        ...s,
        isSelected: s.status !== 'downloaded' && s.status !== 'exists'
    })));

    return (
        <div className="min-h-screen bg-gradient-to-br from-spotify-dark to-black text-white px-6 pb-6 pt-12 font-sans select-none flex flex-col items-center relative">

            {/* Missing Credentials Overlay */}
            {!hasCreds && !overlayDismissed && (
                <div className="absolute inset-0 z-50 backdrop-blur-md bg-black/40 flex items-center justify-center p-8">
                    <div className="bg-black/50 border border-red-500/50 rounded-2xl p-8 max-w-lg w-full shadow-2xl relative text-center backdrop-blur-xl">
                        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">Missing Credentials</h2>
                        <p className="text-gray-400 mb-6">
                            You cannot use the Spotify Downloader without a <strong>Client ID</strong> and <strong>Client Secret</strong>.
                        </p>

                        <div className="text-left bg-white/5 p-4 rounded-lg mb-6 border border-white/10">
                            <h3 className="font-bold text-sm text-gray-300 mb-2">How to get keys:</h3>
                            <ul className="list-disc list-inside text-xs text-gray-400 space-y-1">
                                <li>Log in to <a href="https://developer.spotify.com/dashboard" target="_blank" className="text-spotify-green hover:underline">Spotify Developer Dashboard</a></li>
                                <li>Create an App</li>
                                <li>Copy Client ID & Secret</li>
                            </ul>
                        </div>

                        <p className="text-xs text-gray-500 mb-4">Please enter your keys in the sidebar now.</p>

                        <button onClick={() => setOverlayDismissed(true)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-full transition-colors w-full border border-white/10">
                            I understand, let me enter them
                        </button>
                    </div>
                </div>
            )}

            {/* Fixed Drag Handle */}
            <div className="fixed top-0 left-0 w-full h-12 z-50 draggable-header hover:bg-white/5 transition-colors" />

            {/* Home Button */}
            <button onClick={onBack} className="absolute top-14 left-8 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-50 group">
                <ChevronLeft size={32} />
                <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none">Back to Home</span>
            </button>

            {/* Simplified Header - Bigger Logo */}
            <div className="mb-8 mt-4 relative z-10 flex flex-col items-center">
                <img src={Logo} alt="Spotify Downloader" className="h-32 object-contain drop-shadow-2xl" />
                <p className="text-xs text-gray-500 font-mono mt-2">{statusMsg}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">

                {/* Sidebar */}
                <div className="col-span-1 space-y-4">
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
                        <h2 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Credentials</h2>
                        <input
                            className="w-full bg-black/50 border border-white/10 rounded-lg p-2 mb-3 text-sm focus:border-spotify-green outline-none transition-colors"
                            placeholder="Client ID"
                            value={clientId} onChange={e => setClientId(e.target.value)}
                        />
                        <input
                            className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm focus:border-spotify-green outline-none transition-colors"
                            placeholder="Client Secret"
                            type="password"
                            value={clientSecret} onChange={e => setClientSecret(e.target.value)}
                        />
                    </div>

                    <div className="bg-white/5 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
                        {/* Playlist Input */}
                        <input
                            className="w-full bg-black/50 border border-white/10 rounded-lg p-2 mb-4 text-sm focus:border-spotify-green outline-none transition-colors"
                            placeholder="Spotify Playlist or Track URL..."
                            value={playlistUrl} onChange={e => setPlaylistUrl(e.target.value)}
                        />
                        <button
                            onClick={scanPlaylist}
                            className="w-full bg-spotify-green hover:bg-green-400 text-black font-bold py-2 rounded-lg transition-all flex items-center justify-center space-x-2"
                        >
                            <Search size={16} />
                            <span>Scan</span>
                        </button>
                    </div>

                    <div className="bg-white/5 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
                        <button onClick={selectFolder} className="w-full mb-4 bg-white/10 hover:bg-white/20 py-3 rounded-xl flex items-center justify-center text-sm transition-colors font-medium">
                            <FolderOpen size={18} className="mr-2" />
                            {targetFolder ? 'Folder Selected' : 'Choose Output Folder'}
                        </button>

                        {/* Combined Action Button */}
                        <div className="flex gap-2">
                            {!isProcessing ? (
                                <button onClick={startProcess} className="flex-1 bg-spotify-green text-black hover:bg-green-400 py-3 rounded-lg text-sm font-bold transition-colors flex items-center justify-center shadow-lg transform active:scale-95">
                                    <DownloadCloud size={18} className="mr-2" /> Start Download
                                </button>
                            ) : (
                                <button onClick={stopProcess} className="flex-1 bg-red-500/20 border border-red-500/50 text-red-500 hover:bg-red-500/30 py-3 rounded-lg text-sm font-bold transition-colors flex items-center justify-center shadow-lg animate-pulse">
                                    <Square size={18} className="mr-2 fill-current" /> Stop
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="col-span-1 md:col-span-2 bg-black/30 rounded-2xl border border-white/5 overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 border-b border-white/5 bg-white/5 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-gray-300">Tracks ({songs.length})</h2>
                        </div>
                        {songs.length > 0 && (
                            <div className="flex gap-2">
                                <button onClick={selectAll} className="px-3 py-1 bg-spotify-green text-black text-[10px] font-bold uppercase rounded hover:bg-green-400 transition-colors">Select All</button>
                                <button onClick={selectNew} className="px-3 py-1 bg-white/10 border border-white/20 text-white text-[10px] font-bold uppercase rounded hover:bg-white/20 transition-colors">Select New</button>
                                <button onClick={selectNone} className="px-3 py-1 text-gray-500 hover:text-white text-[10px] font-bold uppercase transition-colors">Clear</button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {songs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-600">
                                <p className="text-sm font-mono tracking-widest uppercase opacity-50">No Playlist Loaded</p>
                            </div>
                        ) : (
                            songs.map((song, idx) => (
                                <div key={idx} className={`flex items-center p-3 hover:bg-white/5 rounded-lg border ${song.isSelected ? 'border-white/10' : 'border-transparent'}`}>
                                    <button onClick={() => toggleSelect(idx)} className={`w-5 h-5 rounded border mr-3 flex items-center justify-center transition-colors ${song.isSelected ? 'bg-spotify-green border-transparent' : 'border-gray-500'}`}>
                                        {song.isSelected && <Check size={12} className="text-black" />}
                                    </button>

                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center space-x-2">
                                            <h3 className={`font-medium truncate ${song.isPreviouslyDownloaded ? 'text-gray-500' : 'text-white'}`}>{song.title}</h3>
                                            {song.isPreviouslyDownloaded && (
                                                <div className="group relative">
                                                    <AlertCircle size={14} className="text-yellow-500" />
                                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                                        Previously Downloaded
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                                    </div>
                                    <StatusBadge status={song.status} />
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

const StatusBadge = ({ status }: { status: Song['status'] }) => {
    const styles = {
        pending: 'bg-gray-800 text-gray-400',
        searching: 'bg-yellow-900/50 text-yellow-500 border-yellow-900',
        found: 'bg-blue-900/50 text-blue-400 border-blue-900',
        notFound: 'bg-red-900/50 text-red-500 border-red-900',
        downloading: 'bg-indigo-900/50 text-indigo-400 border-indigo-900 animate-pulse',
        downloaded: 'bg-green-900/50 text-green-400 border-green-900',
        exists: 'bg-gray-800 text-gray-500 border-gray-700',
        error: 'bg-red-900 text-white'
    };

    return (
        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${styles[status] || styles.pending}`}>
            {status === 'exists' ? 'Downloaded' : status}
        </span>
    );
};
