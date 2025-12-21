import { Check, ChevronLeft, DownloadCloud, FolderOpen, Search, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import Logo from '../assets/soundcloud-logo.png';
import { HistoryManager } from '../utils/historyManager';

interface Song {
    id: string;
    title: string;
    artist: string;
    url: string; // Direct URL for SC/YT
    duration: number;
    status: 'pending' | 'downloading' | 'downloaded' | 'error' | 'exists';
    isSelected: boolean;
    isPreviouslyDownloaded?: boolean;
}

interface Props {
    onBack: () => void;
}

export function SoundCloudView({ onBack }: Props) {
    const [url, setUrl] = useState('');
    const [songs, setSongs] = useState<Song[]>([]);
    const [statusMsg, setStatusMsg] = useState('Ready');
    const [targetFolder, setTargetFolder] = useState<string | null>(localStorage.getItem('target_folder'));
    const [isProcessing, setIsProcessing] = useState(false);
    const abortRef = useRef(false);

    const scanUrl = async () => {
        if (!url) { setStatusMsg('Please enter a URL'); return; }

        setStatusMsg('Scanning SoundCloud...');

        try {
            const res = await window.electronAPI.fetchMetadata(url);
            if (res.success && res.tracks) {
                const newSongs = res.tracks.map((t: any) => {
                    const isDownloaded = HistoryManager.has(t.id);
                    return {
                        id: t.id,
                        title: t.title,
                        artist: t.artist,
                        url: t.url,
                        duration: t.duration,
                        status: (isDownloaded ? 'exists' : 'pending') as 'pending' | 'downloading' | 'downloaded' | 'error' | 'exists',
                        isSelected: !isDownloaded,
                        isPreviouslyDownloaded: isDownloaded
                    };
                });

                setSongs(newSongs);
                setStatusMsg(`Found ${newSongs.length} track(s).`);
            } else {
                setStatusMsg(res.error || 'No tracks found or invalid URL');
            }
        } catch (e) {
            console.error(e);
            setStatusMsg('Error scanning URL (Check Console)');
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
        if (!targetFolder) { alert('Select folder first'); return; }

        setIsProcessing(true);
        abortRef.current = false;
        setStatusMsg('Downloading...');

        const newSongs = [...songs];

        for (let i = 0; i < newSongs.length; i++) {
            if (abortRef.current) break;

            if (newSongs[i].isSelected) {
                newSongs[i].status = 'downloading';
                setSongs([...newSongs]);

                // Direct download using the specialized download-song (it handles any URL supported by yt-dlp)
                const res = await window.electronAPI.downloadSong({
                    url: newSongs[i].url, // Direct SC URL
                    folder: targetFolder,
                    artist: newSongs[i].artist,
                    title: newSongs[i].title
                });

                if (res.success) {
                    newSongs[i].status = 'downloaded';
                    HistoryManager.add({
                        id: newSongs[i].id,
                        source: 'soundcloud',
                        title: newSongs[i].title,
                        artist: newSongs[i].artist,
                        timestamp: Date.now()
                    });
                } else {
                    newSongs[i].status = 'error';
                }
                setSongs([...newSongs]);
            }
        }

        setIsProcessing(false);
        setStatusMsg('All Done');
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
        <div className="min-h-screen bg-[#ff5500] text-black px-6 pb-6 pt-12 font-sans select-none flex flex-col items-center relative">
            {/* Drag Handle */}
            <div className="fixed top-0 left-0 w-full h-12 z-50 draggable-header hover:bg-black/5 transition-colors" />

            {/* Back Button */}
            <button onClick={onBack} className="absolute top-14 left-8 p-3 rounded-full bg-black text-white hover:scale-105 transition-transform z-50 shadow-xl group">
                <ChevronLeft size={24} />
                <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap pointer-events-none shadow-lg">BACK</span>
            </button>

            {/* Header */}
            <div className="mb-8 mt-4 relative z-10 flex flex-col items-center">
                <img src={Logo} alt="SoundCloud" className="h-24 object-contain drop-shadow-2xl" />
                <h1 className="text-4xl font-black mt-4 text-black uppercase tracking-tighter drop-shadow-sm">SoundCloud</h1>
                <p className="text-sm text-black/70 font-bold mt-1 uppercase tracking-widest">{statusMsg}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
                {/* Sidebar (Input) */}
                <div className="col-span-1 space-y-6">
                    {/* MONOCHROME CONTAINER: Same Orange BG, Black Shadow */}
                    <div className="bg-[#ff5500] text-black p-6 rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-black/5 relative overflow-hidden">
                        <h2 className="text-xs font-black text-black uppercase mb-4 tracking-widest relative z-10">Target URL</h2>
                        <input
                            className="w-full bg-black/10 border-2 border-transparent focus:border-black/20 rounded-xl p-3 mb-4 text-sm font-bold focus:bg-white outline-none transition-all placeholder-black/40 text-black relative z-10"
                            placeholder="Paste Playlist or Track Link..."
                            value={url} onChange={e => setUrl(e.target.value)}
                        />
                        <button
                            onClick={scanUrl}
                            className="relative z-10 w-full bg-black text-white hover:bg-gray-900 font-bold py-4 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg active:scale-95"
                        >
                            <Search size={18} className="stroke-[3]" />
                            <span className="uppercase tracking-wider">SCAN</span>
                        </button>
                    </div>

                    <div className="bg-[#ff5500] text-black p-6 rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-black/5">
                        <button onClick={selectFolder} className="w-full mb-4 bg-black/10 hover:bg-black/20 border-2 border-transparent py-3 rounded-xl flex items-center justify-center text-sm transition-colors text-sm font-bold uppercase tracking-wide">
                            <FolderOpen size={18} className="mr-2 stroke-[2.5]" />
                            {targetFolder ? 'Folder Selected' : 'Choose Folder'}
                        </button>

                        <div className="flex gap-2">
                            {!isProcessing ? (
                                <button onClick={startProcess} className="flex-1 bg-black text-white hover:bg-gray-900 py-4 rounded-xl text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center shadow-lg transform active:scale-95">
                                    <DownloadCloud size={20} className="mr-2" /> Download
                                </button>
                            ) : (
                                <button onClick={() => abortRef.current = true} className="flex-1 bg-white text-[#ff5500] border-2 border-white py-4 rounded-xl text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center shadow-lg animate-pulse">
                                    <Square size={20} className="mr-2 fill-current" /> Stop
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* List Container */}
                <div className="col-span-1 md:col-span-2 bg-[#ff5500] rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-black/5 overflow-hidden flex flex-col h-[600px] relative">
                    <div className="p-6 bg-black/5 border-b border-black/5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h2 className="font-black text-lg text-black uppercase tracking-wider">Tracks Found ({songs.length})</h2>
                            <span className="text-[10px] text-black/50 font-bold uppercase border border-black/10 rounded px-2 py-1 bg-white/20">Editable Metadata</span>
                        </div>

                        {songs.length > 0 && (
                            <div className="flex gap-2">
                                <button onClick={selectAll} className="px-3 py-1 bg-black text-white text-[10px] font-black uppercase rounded hover:bg-gray-800 transition-colors shadow-md">Select All</button>
                                <button onClick={selectNew} className="px-3 py-1 bg-white text-black text-[10px] font-black uppercase rounded hover:bg-gray-100 transition-colors shadow-md">Select New</button>
                                <button onClick={selectNone} className="px-3 py-1 text-black/50 hover:text-black text-[10px] font-black uppercase transition-colors">Clear</button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {songs.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-black/20 space-y-4">
                                <Search size={64} className="stroke-[3]" />
                                <p className="text-xl uppercase tracking-widest font-black">No Tracks Scanned</p>
                            </div>
                        )}

                        {songs.map((song, idx) => (
                            <div key={idx} className={`flex items-center p-3 hover:bg-black/5 rounded-xl border-2 transition-all group ${song.isSelected ? 'border-black bg-white/20' : 'border-transparent bg-black/5'}`}>
                                <button onClick={() => toggleSelect(idx)} className={`w-8 h-8 rounded-lg border-2 mr-4 flex items-center justify-center transition-all bg-white ${song.isSelected ? 'border-black' : 'border-black/10 group-hover:border-black/30'}`}>
                                    {song.isSelected && <Check size={20} className="text-black stroke-[4]" />}
                                </button>

                                <div className="flex-1 overflow-hidden pr-4">
                                    {/* Editable Inputs */}
                                    <input
                                        value={song.title}
                                        onChange={(e) => {
                                            const newSongs = [...songs];
                                            newSongs[idx].title = e.target.value;
                                            setSongs(newSongs);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-transparent border-b border-transparent focus:border-black p-0 text-black font-black text-base w-full outline-none placeholder-black/30 transition-colors"
                                        placeholder="Title"
                                    />
                                    <input
                                        value={song.artist}
                                        onChange={(e) => {
                                            const newSongs = [...songs];
                                            newSongs[idx].artist = e.target.value;
                                            setSongs(newSongs);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-transparent border-b border-transparent focus:border-black p-0 text-xs text-black/60 font-bold w-full outline-none focus:text-black transition-colors uppercase tracking-wide mt-1"
                                        placeholder="Artist"
                                    />
                                </div>

                                <div className="flex flex-col items-end space-y-1">
                                    <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-md shadow-sm ${song.status === 'downloaded' || song.status === 'exists' ? 'bg-black text-white' :
                                        song.status === 'downloading' ? 'bg-white text-[#ff5500] border-2 border-[#ff5500] animate-pulse' :
                                            song.status === 'error' ? 'bg-red-500 text-white' :
                                                'bg-black/10 text-black/50'
                                        }`}>
                                        {song.status === 'exists' ? 'DONE' : song.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
