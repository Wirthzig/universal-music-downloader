import { Check, ChevronLeft, DownloadCloud, FolderOpen, Search, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import Logo from '../assets/youtube-logo.png'; // Re-using existing logo
import { HistoryManager } from '../utils/historyManager';

interface Song {
    id: string;
    title: string;
    artist: string;
    url: string;
    duration: number;
    status: 'pending' | 'downloading' | 'downloaded' | 'error' | 'exists';
    isSelected: boolean;
    isPreviouslyDownloaded?: boolean;
}

interface Props {
    onBack: () => void;
}

export function YoutubeView({ onBack }: Props) {
    const [url, setUrl] = useState('');
    const [songs, setSongs] = useState<Song[]>([]);
    const [statusMsg, setStatusMsg] = useState('Ready');
    const [targetFolder, setTargetFolder] = useState<string | null>(localStorage.getItem('target_folder'));
    const [isProcessing, setIsProcessing] = useState(false);
    const abortRef = useRef(false);

    const scanUrl = async () => {
        if (!url) { setStatusMsg('Please enter a URL'); return; }
        setStatusMsg('Scanning YouTube...');

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
                setStatusMsg(`Found ${newSongs.length} video(s).`);
            } else {
                setStatusMsg(res.error || 'No videos found or invalid URL');
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

                const res = await window.electronAPI.downloadSong({
                    url: newSongs[i].url,
                    folder: targetFolder,
                    artist: newSongs[i].artist,
                    title: newSongs[i].title
                });

                if (res.success) {
                    newSongs[i].status = 'downloaded';
                    HistoryManager.add({
                        id: newSongs[i].id,
                        source: 'youtube',
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
        <div className="min-h-screen bg-[#ff0000] text-white px-6 pb-6 pt-12 font-sans select-none flex flex-col items-center relative">
            {/* Drag Handle */}
            <div className="fixed top-0 left-0 w-full h-12 z-50 draggable-header hover:bg-black/5 transition-colors" />

            {/* Back Button */}
            <button onClick={onBack} className="absolute top-14 left-8 p-3 rounded-full border-2 border-white hover:bg-white hover:text-[#ff0000] text-white transition-colors z-50 group">
                <ChevronLeft size={24} />
                <span className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-[#ff0000] px-3 py-1 rounded font-bold text-xs whitespace-nowrap pointer-events-none">BACK</span>
            </button>

            {/* Header */}
            <div className="mb-8 mt-4 relative z-10 flex flex-col items-center">
                <img src={Logo} alt="YouTube" className="h-24 object-contain drop-shadow-xl" />
                <h1 className="text-4xl font-black mt-4 text-white uppercase tracking-tighter shadow-sm">YouTube</h1>
                <p className="text-sm text-white/80 font-bold mt-1 uppercase tracking-widest border-b-2 border-white/20 pb-1">{statusMsg}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
                {/* Sidebar (Input) */}
                <div className="col-span-1 space-y-4">
                    <div className="bg-white p-6 rounded-3xl shadow-xl">
                        <h2 className="text-xs font-black text-black uppercase mb-4 tracking-widest">Video URL</h2>
                        <input
                            className="w-full bg-gray-100 border-2 border-black/10 rounded-xl p-3 mb-4 text-sm font-bold focus:bg-white focus:border-black outline-none transition-all placeholder-gray-400 text-black"
                            placeholder="Paste Link..."
                            value={url} onChange={e => setUrl(e.target.value)}
                        />
                        <button
                            onClick={scanUrl}
                            className="w-full bg-black hover:bg-gray-800 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg text-lg uppercase tracking-wider"
                        >
                            <Search size={20} className="stroke-[3]" />
                            <span>SCAN</span>
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-xl">
                        <button onClick={selectFolder} className="w-full mb-4 bg-gray-100 hover:bg-gray-200 border-2 border-transparent hover:border-black py-3 rounded-xl flex items-center justify-center text-sm transition-colors font-bold text-black uppercase tracking-wide">
                            <FolderOpen size={18} className="mr-2 stroke-[2.5]" />
                            {targetFolder ? 'Folder Selected' : 'Choose Output Folder'}
                        </button>

                        <div className="flex gap-2">
                            {!isProcessing ? (
                                <button onClick={startProcess} className="flex-1 bg-black text-white hover:bg-gray-800 py-4 rounded-xl text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center shadow-lg transform active:scale-95">
                                    <DownloadCloud size={22} className="mr-2 stroke-[3]" /> Download
                                </button>
                            ) : (
                                <button onClick={() => abortRef.current = true} className="flex-1 bg-red-600 text-white border-2 border-red-600 py-4 rounded-xl text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center shadow-lg animate-pulse">
                                    <Square size={22} className="mr-2 fill-current" /> Stop
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* List Container */}
                <div className="col-span-1 md:col-span-2 bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col h-[600px]">
                    <div className="p-6 bg-gray-50 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h2 className="font-black text-xl text-black uppercase tracking-wider">Videos Found ({songs.length})</h2>
                            <span className="text-xs text-black/40 font-bold uppercase border border-black/20 rounded px-2 py-1">Editable Metadata</span>
                        </div>

                        {/* Selection Controls */}
                        {songs.length > 0 && (
                            <div className="flex gap-2">
                                <button onClick={selectAll} className="px-3 py-1 bg-black text-white text-[10px] font-black uppercase rounded hover:bg-gray-800 transition-colors">Select All</button>
                                <button onClick={selectNew} className="px-3 py-1 bg-white border-2 border-black text-black text-[10px] font-black uppercase rounded hover:bg-gray-100 transition-colors">Select New</button>
                                <button onClick={selectNone} className="px-3 py-1 text-black/40 hover:text-red-500 text-[10px] font-black uppercase transition-colors">Clear</button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {songs.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4">
                                <Search size={64} className="opacity-50 stroke-[3]" />
                                <p className="text-lg uppercase tracking-widest font-black opacity-50">No Videos Scanned</p>
                            </div>
                        )}

                        {songs.map((song, idx) => (
                            <div key={idx} className={`flex items-center p-3 hover:bg-gray-50 rounded-xl border-2 transition-all ${song.isSelected ? 'border-black bg-gray-50' : 'border-transparent'}`}>
                                <button onClick={() => toggleSelect(idx)} className={`w-6 h-6 rounded-lg border-2 mr-4 flex items-center justify-center transition-all ${song.isSelected ? 'bg-black border-black' : 'border-gray-300 hover:border-black'}`}>
                                    {song.isSelected && <Check size={16} className="text-white stroke-[4]" />}
                                </button>

                                <div className="flex-1 overflow-hidden pr-4 group">
                                    {/* Editable Inputs */}
                                    <input
                                        value={song.title}
                                        onChange={(e) => {
                                            const newSongs = [...songs];
                                            newSongs[idx].title = e.target.value;
                                            setSongs(newSongs);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-transparent border-b border-transparent focus:border-black p-0 text-black font-black text-base w-full outline-none placeholder-gray-300 transition-colors uppercase tracking-tight"
                                        placeholder="TITLE"
                                    />
                                    <input
                                        value={song.artist}
                                        onChange={(e) => {
                                            const newSongs = [...songs];
                                            newSongs[idx].artist = e.target.value;
                                            setSongs(newSongs);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-transparent border-b border-transparent focus:border-black p-0 text-xs text-gray-500 font-bold w-full outline-none transition-colors uppercase tracking-wide mt-1"
                                        placeholder="ARTIST"
                                    />
                                </div>

                                <div className="flex flex-col items-end space-y-1">
                                    <span className={`text-[10px] uppercase font-black px-2 py-1 rounded border-2 border-black ${song.status === 'downloaded' || song.status === 'exists' ? 'bg-black text-white' :
                                        song.status === 'downloading' ? 'bg-[#ff0000] text-white animate-pulse border-[#ff0000]' :
                                            song.status === 'error' ? 'bg-gray-200 text-red-500 border-red-500' :
                                                'bg-gray-100 text-gray-400 border-transparent'
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
