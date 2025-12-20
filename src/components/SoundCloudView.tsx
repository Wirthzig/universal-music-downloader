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
            <button onClick={onBack} className="absolute top-14 left-8 p-2 rounded-full hover:bg-black/10 text-black/50 hover:text-black transition-colors z-50 group">
                <ChevronLeft size={32} />
                <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none">Back</span>
            </button>

            {/* Header */}
            <div className="mb-8 mt-4 relative z-10 flex flex-col items-center">
                <img src={Logo} alt="SoundCloud" className="h-24 object-contain drop-shadow-xl" />
                <h1 className="text-4xl font-black mt-4 text-black uppercase tracking-tighter">SoundCloud</h1>
                <p className="text-sm text-black/60 font-medium mt-1 uppercase tracking-widest">{statusMsg}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
                {/* Sidebar (Input) */}
                <div className="col-span-1 space-y-4">
                    <div className="bg-black text-white p-6 rounded-3xl shadow-2xl">
                        <h2 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Target URL</h2>
                        <input
                            className="w-full bg-white/10 border border-white/10 rounded-xl p-3 mb-4 text-sm focus:border-white focus:bg-white/20 outline-none transition-all placeholder-gray-500 text-white"
                            placeholder="Paste Playlist or Track Link..."
                            value={url} onChange={e => setUrl(e.target.value)}
                        />
                        <button
                            onClick={scanUrl}
                            className="w-full bg-white text-black hover:bg-gray-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg"
                        >
                            <Search size={18} />
                            <span>SCAN</span>
                        </button>
                    </div>

                    <div className="bg-black text-white p-6 rounded-3xl shadow-2xl">
                        <button onClick={selectFolder} className="w-full mb-4 bg-white/10 hover:bg-white/20 py-3 rounded-xl flex items-center justify-center text-sm transition-colors font-medium">
                            <FolderOpen size={18} className="mr-2" />
                            {targetFolder ? 'Folder Selected' : 'Choose Output Folder'}
                        </button>

                        <div className="flex gap-2">
                            {!isProcessing ? (
                                <button onClick={startProcess} className="flex-1 bg-white text-black hover:bg-gray-200 py-4 rounded-xl text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center shadow-lg transform active:scale-95">
                                    <DownloadCloud size={20} className="mr-2" /> Download
                                </button>
                            ) : (
                                <button onClick={() => abortRef.current = true} className="flex-1 bg-[#ff5500] text-white py-4 rounded-xl text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center shadow-lg animate-pulse">
                                    <Square size={20} className="mr-2 fill-current" /> Stop
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* List Container */}
                <div className="col-span-1 md:col-span-2 bg-black text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[600px] border-4 border-black">
                    <div className="p-6 border-b border-white/10 bg-white/5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-lg uppercase tracking-wider">Tracks Found ({songs.length})</h2>
                            <span className="text-xs text-gray-500 font-mono">EDIT META BEFORE DL</span>
                        </div>

                        {songs.length > 0 && (
                            <div className="flex gap-2">
                                <button onClick={selectAll} className="px-3 py-1 bg-[#ff5500] text-white text-[10px] font-black uppercase rounded hover:bg-[#ff6600] transition-colors">Select All</button>
                                <button onClick={selectNew} className="px-3 py-1 bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase rounded hover:bg-white/20 transition-colors">Select New</button>
                                <button onClick={selectNone} className="px-3 py-1 text-gray-500 hover:text-white text-[10px] font-black uppercase transition-colors">Clear</button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {songs.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4">
                                <Search size={48} className="opacity-20" />
                                <p className="text-sm uppercase tracking-widest font-bold opacity-50">No Tracks Scanned</p>
                            </div>
                        )}

                        {songs.map((song, idx) => (
                            <div key={idx} className={`flex items-center p-3 hover:bg-white/5 rounded-xl border transition-all ${song.isSelected ? 'border-[#ff5500]/50 bg-white/5' : 'border-transparent'}`}>
                                <button onClick={() => toggleSelect(idx)} className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition-all ${song.isSelected ? 'bg-[#ff5500] border-[#ff5500]' : 'border-gray-600 hover:border-gray-400'}`}>
                                    {song.isSelected && <Check size={14} className="text-black stroke-[3]" />}
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
                                        className="bg-transparent border-none p-0 text-white font-bold text-sm w-full outline-none focus:text-[#ff5500] placeholder-gray-600 transition-colors"
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
                                        className="bg-transparent border-none p-0 text-xs text-gray-400 w-full outline-none focus:text-white transition-colors"
                                        placeholder="Artist"
                                    />
                                </div>

                                <div className="flex flex-col items-end space-y-1">
                                    <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-md ${song.status === 'downloaded' || song.status === 'exists' ? 'bg-green-500 text-black' :
                                        song.status === 'downloading' ? 'bg-[#ff5500] text-white animate-pulse' :
                                            song.status === 'error' ? 'bg-red-500 text-white' :
                                                'bg-gray-800 text-gray-500'
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
