import { useState } from 'react';
import { Download, ArrowLeft, Monitor, FileVideo, Check, Film } from 'lucide-react';

const VideoOptions = ({ data, onDownloadStarted, onBack }) => {
    const [selectedFormat, setSelectedFormat] = useState(null);
    const [downloading, setDownloading] = useState(false);

    const startDownload = async () => {
        if (!selectedFormat) return;
        setDownloading(true);
        try {
            const res = await fetch('http://localhost:5000/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: data.original_url,
                    format_id: selectedFormat.format_id
                })
            });
            const respData = await res.json();
            onDownloadStarted(respData.taskId, data.title);
        } catch (e) {
            console.error(e);
            setDownloading(false);
        }
    };

    return (
        <div className="animate-slide-up w-full">
            <button
                onClick={onBack}
                className="mb-8 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group px-4 py-2 rounded-lg hover:bg-white/5 w-fit"
            >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Search
            </button>

            <div className="glass-panel rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-8 lg:gap-12 w-full">
                {/* Thumbnail side */}
                <div className="md:w-5/12 flex flex-col gap-6">
                    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 aspect-video relative group w-full">
                        <img src={data.thumbnail} alt={data.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-80" />
                        <div className="absolute bottom-4 left-4 right-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-1 bg-red-600 rounded-md text-xs font-bold uppercase tracking-wider">Video</span>
                                <span className="text-xs text-gray-300 font-medium bg-black/50 px-2 py-1 rounded-md backdrop-blur-md">
                                    {Math.floor(data.duration / 60)}:{(data.duration % 60).toString().padStart(2, '0')}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold leading-tight mb-2 text-white">{data.title}</h2>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Film size={14} />
                            <span>Ready to download</span>
                        </div>
                    </div>
                </div>

                {/* Options side */}
                <div className="md:w-7/12 flex flex-col">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
                        <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
                            <Monitor size={20} />
                        </div>
                        Select Quality
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {data.formats.map((fmt) => (
                            <div
                                key={fmt.format_id}
                                onClick={() => setSelectedFormat(fmt)}
                                className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 flex items-center justify-between group overflow-hidden
                    ${selectedFormat?.format_id === fmt.format_id
                                        ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20'
                                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}`}
                            >
                                {/* Selection Glow */}
                                {selectedFormat?.format_id === fmt.format_id && (
                                    <div className="absolute inset-0 bg-blue-400/20 blur-xl" />
                                )}

                                <div className="flex items-center gap-4 relative z-10">
                                    <div className={`p-2 rounded-lg transition-colors ${selectedFormat?.format_id === fmt.format_id ? 'bg-white/20' : 'bg-white/5'}`}>
                                        <FileVideo className={selectedFormat?.format_id === fmt.format_id ? 'text-white' : 'text-gray-400'} size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`font-bold text-lg ${selectedFormat?.format_id === fmt.format_id ? 'text-white' : 'text-gray-200'}`}>
                                            {fmt.resolution}
                                        </span>
                                        <span className={`text-xs ${selectedFormat?.format_id === fmt.format_id ? 'text-blue-100' : 'text-gray-500'}`}>
                                            {fmt.ext.toUpperCase()} {fmt.filesize_approx ? `• ~${(fmt.filesize_approx / 1024 / 1024).toFixed(1)}MB` : ''}
                                        </span>
                                    </div>
                                </div>

                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all relative z-10
                    ${selectedFormat?.format_id === fmt.format_id ? 'border-white bg-white text-blue-600 scale-110' : 'border-gray-500 text-transparent'}`}>
                                    <Check size={14} strokeWidth={4} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/10 flex justify-end">
                        <button
                            disabled={!selectedFormat || downloading}
                            onClick={startDownload}
                            className="btn-primary px-8 py-4 rounded-xl w-full sm:w-auto flex items-center justify-center gap-3 text-lg"
                        >
                            <Download size={22} className={downloading ? 'animate-bounce' : ''} />
                            {downloading ? 'Starting...' : 'Download Selected'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoOptions;
