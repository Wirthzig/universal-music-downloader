import axios from 'axios';
import { AlertCircle, Check, ChevronLeft, Coffee, DownloadCloud, FolderOpen, Loader2, Search, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import Logo from '../assets/spotify-logo.png'; // Re-use logo (make sure it looks good on dark)
import { HistoryManager } from '../utils/historyManager';

interface Song {
    id: string;
    title: string;
    artist: string;
    status: 'pending' | 'searching' | 'found' | 'notFound' | 'downloading' | 'downloaded' | 'error' | 'exists';
    youtubeUrl?: string;
    isSelected: boolean;
    isPreviouslyDownloaded?: boolean;
    durationMs?: number;
}

interface Props {
    onBack: () => void;
}

export function SpotifyView({ onBack }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const [isWakingUp, setIsWakingUp] = useState(false);
    const [showErrorOverlay, setShowErrorOverlay] = useState(false);

    const [playlistUrl, setPlaylistUrl] = useState('');
    const [songs, setSongs] = useState<Song[]>([]);
    const [statusMsg, setStatusMsg] = useState('Ready');
    const [targetFolder, setTargetFolder] = useState<string | null>(localStorage.getItem('target_folder'));
    const [isProcessing, setIsProcessing] = useState(false);
    const abortRef = useRef(false);

    const getSpotifyToken = async () => {
        try {
            // Fetch from your Render Backend with 4 min timeout
            const res = await axios.get('https://universal-music-downloader.onrender.com/token', { timeout: 240000 });
            return res.data.access_token;
        } catch (e) {
            console.error(e);
            setStatusMsg('Spotify Auth Failed');
            setShowErrorOverlay(true);
            return null;
        }
    };

    const scanPlaylist = async () => {
        // saveCreds(); // No longer needed
        setIsLoading(true);
        setIsWakingUp(false);
        setShowErrorOverlay(false);

        // Backend Wake-up Timer
        const wakeUpTimer = setTimeout(() => {
            setIsWakingUp(true);
        }, 8000); // 8 seconds to trigger "Waking up..." message

        const token = await getSpotifyToken();
        clearTimeout(wakeUpTimer); // Clear timer immediately after token response
        setIsWakingUp(false);

        if (!token) {
            setIsLoading(false);
            return;
        }

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
                    isPreviouslyDownloaded: isDownloaded,
                    durationMs: item.duration_ms
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
                            isPreviouslyDownloaded: isDownloaded,
                            durationMs: item.track.duration_ms
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
            setShowErrorOverlay(true);
        } finally {
            setIsLoading(false);
        }
    };

    const selectFolder = async () => {
        const path = await window.electronAPI.selectFolder();
        if (path) {
            setTargetFolder(path);
            localStorage.setItem('target_folder', path);
        }
    };

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
                if (!newSongs[i].youtubeUrl) {
                    newSongs[i].status = 'searching';
                    setSongs([...newSongs]);

                    const url = await window.electronAPI.searchYoutube({
                        artist: newSongs[i].artist,
                        title: newSongs[i].title,
                        duration: newSongs[i].durationMs ? Math.round(newSongs[i].durationMs! / 1000) : undefined
                    });

                    if (!url) {
                        newSongs[i].status = 'notFound';
                        setSongs([...newSongs]);
                        continue;
                    }
                    newSongs[i].youtubeUrl = url;
                    newSongs[i].status = 'found';
                    setSongs([...newSongs]);
                }

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
        <div className="min-h-screen bg-[#000000] text-[#1DB954] px-6 pb-6 pt-12 font-sans select-none flex flex-col items-center relative">

            {/* Funny Error Overlay */}
            {showErrorOverlay && (
                <div className="absolute inset-0 z-50 backdrop-blur-md flex items-center justify-center p-8">
                    <div className="bg-black/80 border border-red-500/50 rounded-2xl p-8 max-w-lg w-full shadow-2xl relative text-center backdrop-blur-xl">
                        <h2 className="text-3xl font-black text-red-500 mb-4 uppercase tracking-wide">Whoops! We hit a wall. 🧱</h2>
                        <p className="text-gray-300 mb-6 text-lg leading-relaxed">
                            It looks like this playlist is playing hard to get (Private) or doesn't exist.
                            We aren't hackers, we can only see what's public! 🕵️‍♂️
                        </p>
                        <p className="text-sm text-gray-500 mb-8 font-mono">
                            Please check the link and make sure it's Public.
                        </p>

                        <button onClick={() => setShowErrorOverlay(false)} className="bg-red-500 text-black hover:bg-red-400 font-black py-3 px-8 rounded-full transition-colors w-full shadow-lg">
                            TRY AGAIN
                        </button>
                    </div>
                </div>
            )}

            {/* Drag Handle */}
            <div className="fixed top-0 left-0 w-full h-12 z-50 draggable-header hover:bg-white/5 transition-colors" />

            {/* Back Button */}
            <button onClick={onBack} className="absolute top-14 left-8 p-3 rounded-full bg-[#121212] border border-[#1DB954]/50 text-[#1DB954] hover:bg-[#1DB954] hover:text-black transition-all z-50 group shadow-lg">
                <ChevronLeft size={24} className="stroke-[3]" />
                <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1DB954] text-black px-3 py-1 rounded-full text-xs font-black whitespace-nowrap pointer-events-none">BACK</span>
            </button>

            {/* Header */}
            <div className="mb-8 mt-4 relative z-10 flex flex-col items-center">
                <img src={Logo} alt="Spotify" className="h-24 object-contain drop-shadow-[0_0_15px_rgba(29,185,84,0.5)]" />
                <h1 className="text-4xl font-black mt-4 text-[#1DB954] uppercase tracking-tighter drop-shadow-md">Spotify</h1>
                <p className="text-sm text-[#1DB954]/80 font-bold mt-1 uppercase tracking-widest">{statusMsg}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">

                {/* Sidebar */}
                <div className="col-span-1 space-y-6">
                    {/* Credentials Box REMOVED */}
                    {/* <div className="bg-[#181818] p-6 rounded-3xl shadow-[0_0_15px_rgba(255,255,255,0.1)] relative overflow-hidden">
                        ...
                    </div> */}

                    {/* Input Box */}
                    <div className="bg-[#181818] p-6 rounded-3xl shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        <h2 className="text-xs font-black text-[#1DB954] uppercase mb-4 tracking-widest relative z-10">Playlist URL</h2>
                        <input
                            className="w-full bg-black border border-white/10 focus:border-[#1DB954] rounded-xl p-3 mb-4 text-sm font-bold text-[#1DB954] outline-none transition-all placeholder-[#1DB954]/30 shadow-inner"
                            placeholder="Paste Link..."
                            value={playlistUrl} onChange={e => setPlaylistUrl(e.target.value)}
                        />
                        <button
                            onClick={scanPlaylist}
                            className="w-full bg-[#1DB954] text-black hover:bg-[#1ed760] font-black py-4 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg hover:shadow-[0_0_20px_rgba(29,185,84,0.4)] active:scale-95 uppercase tracking-wider"
                        >
                            <Search size={18} className="stroke-[3]" />
                            <span>SCAN</span>
                        </button>
                    </div>

                    {/* Folder & DL Actions */}
                    <div className="bg-[#181818] p-6 rounded-3xl shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        <button onClick={selectFolder} className="w-full mb-4 bg-black/40 hover:bg-black/60 border border-white/10 text-[#1DB954] py-3 rounded-xl flex items-center justify-center text-sm transition-colors font-bold uppercase tracking-wide">
                            <FolderOpen size={18} className="mr-2" />
                            {targetFolder ? 'Folder Selected' : 'Choose Output'}
                        </button>

                        <div className="flex gap-2">
                            {!isProcessing ? (
                                <button onClick={startProcess} className="flex-1 bg-[#1DB954] text-black hover:bg-[#1ed760] py-4 rounded-xl text-sm font-black transition-colors flex items-center justify-center shadow-lg active:scale-95 uppercase tracking-wider">
                                    <DownloadCloud size={20} className="mr-2" /> Download
                                </button>
                            ) : (
                                <button onClick={stopProcess} className="flex-1 bg-[#121212] text-red-500 border border-red-500 py-4 rounded-xl text-sm font-black transition-colors flex items-center justify-center shadow-lg animate-pulse uppercase tracking-wider">
                                    <Square size={20} className="mr-2 fill-current" /> Stop
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* List Container */}
                <div className="col-span-1 md:col-span-2 bg-[#181818] rounded-3xl shadow-[0_0_15px_rgba(255,255,255,0.1)] overflow-hidden flex flex-col h-[600px]">
                    <div className="p-6 bg-black/20 border-b border-white/5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h2 className="font-black text-xl text-[#1DB954] uppercase tracking-wider">Tracks ({songs.length})</h2>
                        </div>
                        {songs.length > 0 && (
                            <div className="flex gap-2">
                                <button onClick={selectAll} className="px-3 py-1 bg-[#1DB954] text-black text-[10px] font-black uppercase rounded hover:bg-[#1ed760] transition-colors">Select All</button>
                                <button onClick={selectNew} className="px-3 py-1 bg-transparent border border-[#1DB954] text-[#1DB954] text-[10px] font-black uppercase rounded hover:bg-[#1DB954]/10 transition-colors">Select New</button>
                                <button onClick={selectNone} className="px-3 py-1 text-[#1DB954]/50 hover:text-[#1DB954] text-[10px] font-black uppercase transition-colors">Clear</button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar relative">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center text-[#1DB954]/50 space-y-4">
                                <Loader2 size={48} className="text-[#1DB954] animate-spin" />
                                <div className="text-center">
                                    <p className="text-2xl font-black uppercase tracking-widest animate-pulse">
                                        {isWakingUp ? 'Waking Up Backend...' : 'Scanning...'}
                                    </p>

                                    {isWakingUp && (
                                        <div className="mt-6 max-w-md mx-auto bg-[#1DB954]/10 rounded-xl p-4 border border-[#1DB954]/20">
                                            <p className="text-sm text-[#1DB954]/80 mb-3 leading-relaxed">
                                                Our free backend server sleeps when inactive. It might take <strong>1-2 minutes</strong> to start up.
                                                <br /><br />
                                                If you buy us a coffee, we might be able to afford a server that never sleeps! (Or at least one that naps less). ☕
                                            </p>
                                            <a
                                                href="https://ko-fi.com/liberaudio"
                                                target="_blank"
                                                className="inline-flex items-center space-x-2 bg-[#1DB954] text-black px-6 py-3 rounded-full text-xs font-black hover:bg-[#1ed760] hover:scale-105 transition-all shadow-lg uppercase tracking-wide"
                                            >
                                                <Coffee size={16} className="stroke-[3]" />
                                                <span>Buy us a Coffee</span>
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : songs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[#1DB954]/30">
                                <p className="text-xl font-black uppercase tracking-widest opacity-50">No Playlist Loaded</p>
                            </div>
                        ) : (
                            songs.map((song, idx) => (
                                <div key={idx} className={`flex items-center p-3 hover:bg-[#1DB954]/5 rounded-lg border transition-all ${song.isSelected ? 'border-[#1DB954] bg-[#1DB954]/10' : 'border-transparent'}`}>
                                    <button onClick={() => toggleSelect(idx)} className={`w-5 h-5 rounded border mr-3 flex items-center justify-center transition-colors ${song.isSelected ? 'bg-[#1DB954] border-[#1DB954]' : 'border-[#1DB954]/50'}`}>
                                        {song.isSelected && <Check size={12} className="text-black stroke-[3]" />}
                                    </button>

                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center space-x-2">
                                            <h3 className={`font-bold truncate ${song.isPreviouslyDownloaded ? 'text-[#1DB954]/40' : 'text-[#1DB954]'}`}>{song.title}</h3>
                                            {song.isPreviouslyDownloaded && (
                                                <div className="group relative">
                                                    <AlertCircle size={14} className="text-[#1DB954]/40" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-[#1DB954]/60 truncate font-mono">{song.artist}</p>
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
    // Monochrome Green Status Styles
    const styles = {
        pending: 'text-[#1DB954]/40 border-[#1DB954]/20',
        searching: 'text-[#1DB954] border-[#1DB954] animate-pulse',
        found: 'bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]',
        notFound: 'text-red-500 border-red-500',
        downloading: 'bg-[#1DB954] text-black border-[#1DB954] animate-pulse',
        downloaded: 'bg-[#1DB954] text-black border-[#1DB954]',
        exists: 'text-[#1DB954]/40 border-[#1DB954]/20',
        error: 'text-red-500 border-red-500'
    };

    return (
        <span className={`text-[10px] uppercase font-black px-2 py-1 rounded border ${styles[status]}`}>
            {status === 'exists' ? 'DONE' : status}
        </span>
    );
};
