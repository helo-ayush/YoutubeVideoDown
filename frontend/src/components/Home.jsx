import { useState } from 'react';
import { Search, Loader2, ArrowRight, Play, Youtube } from 'lucide-react';

const Home = ({ onInfoFetched }) => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFetch = (e) => {
        if (e && e.preventDefault) e.preventDefault(); // Handle both button click and keydown
        if (!url) return;

        // Instant Switch: Pass strict minimum to App to switch view
        // App / ChannelFilter will handle the actual fetching
        onInfoFetched({
            type: 'channel', // Assume channel for now, layout handles error if not
            url: url,
            loading: true,
            title: 'Loading Channel...',
            videos: []
        });
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full px-4 animate-fade-in">
            <div className="text-center mb-8 md:mb-16 space-y-4 md:space-y-6 max-w-2xl bg-gradient-to-br from-white/5 to-transparent p-6 md:p-12 rounded-[2.5rem] md:rounded-[3rem] border border-white/5 backdrop-blur-3xl shadow-2xl mx-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs md:text-sm font-medium mb-2 md:mb-4">
                    <Youtube size={16} /> YouTube Downloader Pro
                </div>
                <h2 className="text-4xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]">
                    Download <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">Fast.</span>
                </h2>
                <p className="text-gray-400 text-base md:text-xl leading-relaxed max-w-xs md:max-w-none mx-auto">
                    The ultimate tool for high-quality video and playlist and channel downloads.
                </p>
            </div>

            <div className="w-full max-w-2xl relative group px-4">
                {/* Ambient Glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-orange-600 rounded-full blur-[20px] opacity-40 group-hover:opacity-60 transition duration-1000 hidden md:block"></div>

                {/* Main Bar Container */}
                <div className="relative bg-[#0a0a0a]/90 backdrop-blur-xl ring-1 ring-white/10 rounded-3xl md:rounded-full p-2.5 flex flex-col md:flex-row items-center gap-2 md:gap-0 transition-transform transform focus-within:scale-[1.01] shadow-2xl">
                    <div className="hidden md:flex pl-6 text-gray-500">
                        <Search size={22} />
                    </div>

                    <input
                        type="text"
                        placeholder="Paste Youtube Link..."
                        className="flex-1 w-full bg-transparent border-none outline-none text-white px-4 md:px-6 py-3.5 text-lg placeholder-gray-600 font-medium text-center md:text-left h-14 md:h-16 rounded-xl md:rounded-none bg-white/5 md:bg-transparent"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleFetch(e)}
                    />

                    <button
                        onClick={handleFetch}
                        disabled={loading}
                        className="btn-primary cursor-pointer w-full md:w-auto px-8 md:px-8 py-3.5 md:py-3 rounded-2xl md:rounded-full flex items-center justify-center gap-2.5 text-lg font-bold shadow-lg md:mr-2 hover:shadow-red-500/20 active:scale-95 transition-all
                        bg-gradient-to-r from-red-600 to-orange-600 text-white"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (
                            <>
                                <span className="md:hidden">Process Video</span>
                                <span className="hidden md:inline whitespace-nowrap">Process</span>
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl animate-slide-up flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {error}
                </div>
            )}
        </div>
    );
};

export default Home;
