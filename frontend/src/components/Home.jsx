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
            <div className="text-center mb-16 space-y-6 max-w-2xl bg-gradient-to-br from-white/5 to-transparent p-12 rounded-[3rem] border border-white/5 backdrop-blur-3xl shadow-2xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium mb-4">
                    <Youtube size={16} /> YouTube Downloader Pro
                </div>
                <h2 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]">
                    Download <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">Fast.</span>
                </h2>
                <p className="text-gray-400 text-lg md:text-xl leading-relaxed">
                    The ultimate tool for high-quality video and playlist downloads.
                    Paste a link and experience speed.
                </p>
            </div>

            <div className="w-full max-w-3xl relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative glass-panel rounded-2xl p-2 flex items-center gap-2 transition-transform transform focus-within:scale-[1.02]">
                    <div className="pl-4 text-gray-400">
                        <Search size={22} />
                    </div>
                    <input
                        type="text"
                        placeholder="Paste YouTube Video or Channel URL..."
                        className="flex-1 bg-transparent border-none outline-none text-white px-4 py-4 text-lg placeholder-gray-500 font-medium"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleFetch(e)}
                    />
                    <button
                        onClick={handleFetch}
                        disabled={loading}
                        className="btn-primary px-8 py-4 rounded-xl flex items-center gap-3 text-lg"
                    >
                        {loading ? <Loader2 className="animate-spin" size={24} /> : (
                            <>
                                Process <ArrowRight size={20} />
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
