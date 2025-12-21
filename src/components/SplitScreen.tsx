import { HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import MainLogo from '../assets/main-logo.png';
import SoundcloudLogo from '../assets/soundcloud-logo.png';
import SpotifyLogo from '../assets/spotify-logo.png';
import YoutubeLogo from '../assets/youtube-logo.png';

interface Props {
    onSelectService: (service: 'spotify' | 'soundcloud' | 'youtube') => void;
}

export function SplitScreen({ onSelectService }: Props) {
    const [showOnboarding, setShowOnboarding] = useState(false);

    useEffect(() => {
        const hasSeen = localStorage.getItem('has_seen_onboarding');
        if (!hasSeen) {
            setShowOnboarding(true);
        }
    }, []);

    const dismissOnboarding = () => {
        localStorage.setItem('has_seen_onboarding', 'true');
        setShowOnboarding(false);
    };

    return (
        <div className="flex w-full h-screen font-sans select-none relative">
            {/* Help Button to Recall Overlay */}
            <button
                onClick={() => setShowOnboarding(true)}
                className="absolute top-6 right-6 z-40 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors"
                title="Show Info & Instructions"
            >
                <HelpCircle size={24} />
            </button>

            {/* Onboarding Overlay */}
            {showOnboarding && (
                <div className="absolute inset-0 z-50 backdrop-blur-md bg-black/40 flex items-center justify-center p-8">
                    <div className="bg-black/50 border border-white/10 rounded-3xl p-10 max-w-2xl w-full shadow-2xl relative backdrop-blur-xl">
                        <div className="flex flex-col items-center text-center">
                            <img src={MainLogo} alt="App Logo" className="h-32 mb-8 drop-shadow-2xl" />

                            <h1 className="text-3xl font-bold text-white mb-4">Welcome to Universal Music Downloader</h1>

                            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-6">
                                <h3 className="text-red-500 font-bold text-sm uppercase mb-1">⚠️ Legal Disclaimer</h3>
                                <p className="text-xs text-red-200/80 leading-relaxed">
                                    This application is a <strong>Proof of Concept for Educational Purposes Only</strong>.
                                    By using this tool, you agree to respect the Terms of Service of all supported platforms.
                                    Do not use this tool to infringe on copyright. The authors assume no liability for misuse.
                                </p>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/50 rounded-xl p-4 mb-6">
                                <h3 className="text-blue-400 font-bold text-sm uppercase mb-1">ℹ️ Requirement: Public Playlists</h3>
                                <p className="text-xs text-blue-200/80 leading-relaxed">
                                    Please ensure your playlists on Spotify/SoundCloud/YouTube are set to <strong>Public</strong>.
                                    The tool cannot access Private or Collaborative playlists.
                                </p>
                            </div>

                            <p className="text-gray-400 mb-8 leading-relaxed">
                                This application allows you to download your favorite music from Spotify, SoundCloud, and YouTube in high quality.
                            </p>

                            <div className="bg-white/5 rounded-xl p-6 border border-white/10 w-full mb-8 text-left">
                                <h3 className="text-spotify-green font-bold text-lg mb-2 flex items-center">
                                    ⚠️ Setup Required for Spotify
                                </h3>
                                <p className="text-sm text-gray-300 mb-4">
                                    To download from Spotify, you need to provide your own <strong>Client ID</strong> and <strong>Client Secret</strong>.
                                </p>
                                <ol className="list-decimal list-inside text-sm text-gray-400 space-y-2 mb-4 ml-2">
                                    <li>Go to the <a href="https://developer.spotify.com/dashboard" target="_blank" className="text-white underline hover:text-spotify-green">Spotify Developer Dashboard</a>.</li>
                                    <li>Log in and create a new App ("My Music App").</li>
                                    <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong>.</li>
                                    <li>Paste them into the settings sidebar in the Spotify View.</li>
                                </ol>
                            </div>

                            <button
                                onClick={dismissOnboarding}
                                className="bg-white text-black hover:bg-gray-200 font-bold py-4 px-12 rounded-full text-lg transition-transform active:scale-95 shadow-xl"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Spotify (Left) */}
            <div
                className="flex-1 bg-black hover:bg-[#121212] transition-colors cursor-pointer group flex flex-col items-center justify-center border-r border-white/10 relative overflow-hidden"
                onClick={() => onSelectService('spotify')}
            >
                <div className="absolute inset-0 bg-spotify-green/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="z-10 text-center p-6 flex flex-col items-center">
                    <img src={SpotifyLogo} alt="Spotify" className="w-24 h-24 mb-6 object-contain drop-shadow-[0_0_30px_rgba(29,185,84,0.4)] group-hover:scale-110 transition-transform duration-300" />
                    <h2 className="text-3xl font-bold text-spotify-green tracking-wider uppercase mb-2">Spotify</h2>
                    <p className="text-gray-500 text-sm group-hover:text-gray-300 transition-colors">Download Playlists & Tracks</p>
                </div>
            </div>

            {/* SoundCloud (Middle) */}
            <div
                className="flex-1 bg-[#ff5500] hover:bg-[#ff6600] transition-colors cursor-pointer group flex flex-col items-center justify-center border-r border-white/10 relative"
                onClick={() => onSelectService('soundcloud')}
            >
                <div className="z-10 text-center p-6 flex flex-col items-center">
                    <img src={SoundcloudLogo} alt="SoundCloud" className="w-32 h-32 mb-6 object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-300" />
                    <h2 className="text-3xl font-bold text-black tracking-wider uppercase mb-2">SoundCloud</h2>
                    <p className="text-black/70 text-sm font-bold">Download Playlists & Tracks</p>
                </div>
            </div>

            {/* YouTube (Right) */}
            <div
                className="flex-1 bg-[#ff0000] hover:bg-[#ff1a1a] transition-colors cursor-pointer group flex flex-col items-center justify-center relative"
                onClick={() => onSelectService('youtube')}
            >
                <div className="z-10 text-center p-6 flex flex-col items-center">
                    <img src={YoutubeLogo} alt="YouTube" className="w-32 h-32 mb-6 object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-300" />
                    <h2 className="text-3xl font-bold text-white tracking-wider uppercase mb-2">YouTube</h2>
                    <p className="text-white/70 text-sm font-bold">Download Playlists & Tracks</p>
                </div>
            </div>

        </div>
    );
}
