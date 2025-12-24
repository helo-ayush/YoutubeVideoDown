import { useState } from 'react';
import { Download, ArrowLeft, CheckSquare, ChevronLeft, ChevronRight, Filter, Settings, X, Check, PlayCircle, CloudCheck, FolderCheck, SquareSlash, SquareDashed, SquareX, SquareCheck } from 'lucide-react';

import { socket } from '../App';

const ChannelFilter = ({ data, onBatchDownloadStarted, onBack, onFetchPage }) => {
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [downloading, setDownloading] = useState(false);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [isMaxQuality, setIsMaxQuality] = useState(true);
    const [selectedCap, setSelectedCap] = useState(1080); // Default to 1080p when not max

    const qualityOptions = [
        { label: '4K', value: 2160 },
        { label: '2K', value: 1440 },
        { label: '1080p', value: 1080 },
        { label: '720p', value: 720 },
        { label: '480p', value: 480 },
        { label: '360p', value: 360 },
        { label: 'Audio Only', value: 'audio' },
    ];

    const currentTab = data.current_tab || 'videos';

    const handleTabChange = (newTab) => {
        if (newTab === currentTab) return;
        onFetchPage(data.url, 1, newTab);
    };

    const handlePageChange = (direction) => {
        const newPage = direction === 'next' ? (data.page || 1) + 1 : (data.page || 1) - 1;
        if (newPage < 1) return;
        onFetchPage(data.url, newPage, currentTab);
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === data.videos?.length) {
            setSelectedIds(new Set());
        } else {
            const newSet = new Set();
            data.videos?.forEach(v => newSet.add(v.id));
            setSelectedIds(newSet);
        }
    };

    const startBatchDownload = async () => {
        if (selectedIds.size === 0) return;
        setDownloading(true);

        const urlsToDownload = data.videos
            .filter(v => selectedIds.has(v.id))
            .map(v => v.url);

        // Determine quality cap: null if max quality, otherwise the selected value
        const qualityCap = isMaxQuality ? null : selectedCap;

        try {
            const res = await fetch('http://localhost:5000/api/batch_download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    urls: urlsToDownload,
                    quality_cap: qualityCap,
                    sid: socket.id // Send socket ID for tracking
                })
            });
            const respData = await res.json();
            onBatchDownloadStarted(respData.taskIds, `Batch of ${urlsToDownload.length} videos`);
        } catch (e) {
            console.error(e);
            setDownloading(false);
        }
    };

    if (data.loading && (!data.videos || data.videos.length === 0)) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-white animate-pulse">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-red-500/30 rounded-full animate-ping absolute inset-0" />
                    <div className="w-20 h-20 border-4 border-t-red-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin relative z-10" />
                </div>
                <h2 className="text-2xl font-bold mt-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Fetching...</h2>
                <p className="text-gray-500 mt-2 font-medium tracking-wide text-sm">LOADING {currentTab.toUpperCase()} CONTENT</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col relative">
            {/* Header Area */}
            <div className="flex-shrink-0 px-4 md:px-6 py-4 z-30">
                <div className="glass-panel rounded-2xl p-3 md:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border border-white/10 shadow-2xl backdrop-blur-xl bg-black/40">
                    <div className="flex items-center gap-3 md:gap-5">
                        <button
                            onClick={onBack}
                            className="p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300 text-gray-400 hover:text-white hover:scale-105 active:scale-95 border border-white/5"
                        >
                            <ArrowLeft size={18} className="md:w-5 md:h-5" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h2 className="font-bold text-lg md:text-xl text-white flex items-center gap-2 md:gap-3 tracking-tight truncate">
                                <span className="truncate">{data.title}</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-400 uppercase tracking-wider border border-white/5 flex-shrink-0">
                                    {data.type || 'Channel'}
                                </span>
                            </h2>
                            <p className="text-[10px] md:text-xs text-gray-400 font-medium mt-1 flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${data.loading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                                {data.videos?.length || 0} items loaded • Page {data.page || 1}
                            </p>
                        </div>
                    </div>

                    {/* Modern Pill Switcher */}
                    <div className="flex bg-[#0f0f0f] rounded-full p-1 border border-white/10 w-full md:w-auto overflow-hidden relative">
                        {['videos', 'shorts'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={`relative flex-1 md:flex-none cursor-pointer justify-center px-6 py-2 m-1/2 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2
                                    ${currentTab === tab
                                        ? 'bg-[#1b1b1b] text-white shadow-lg shadow-gray-900/40'
                                        : 'text-gray-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 relative px-4 md:px-6 pb-0">
                <div className="h-full rounded-t-3xl border-t border-x border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-sm overflow-hidden relative">

                    {/* Loading Overlay */}
                    {data.loading && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md transition-opacity duration-300">
                            <div className="flex flex-col items-center gap-4 animate-slide-up">
                                <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin shadow-2xl shadow-red-500/20" />
                                <p className="text-white text-sm font-bold tracking-widest uppercase opacity-80">Loading...</p>
                            </div>
                        </div>
                    )}

                    <div className={`h-full overflow-y-auto px-6 py-6 custom-scrollbar transition-all duration-500 ${data.loading ? 'opacity-40 scale-[0.99] blur-[2px]' : 'opacity-100 scale-100 blur-0'}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-24">
                            {data.videos?.map((video) => (
                                <div
                                    key={video.id}
                                    onClick={() => toggleSelection(video.id)}
                                    className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500
                                ${selectedIds.has(video.id)
                                            ? 'ring-2 ring-[#ffc18a62] bg-[#ffc18a14] shadow-2xl shadow-red-900/40 transform scale-[1.02] z-10'
                                            : 'hover:transform ring-2 ring-[#8080805a] hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/50 hover:z-10 bg-black/20 hover:bg-white/5'}`}
                                >
                                    {/* Thumbnail Container */}
                                    <div className="aspect-video bg-gray-900 relative overflow-hidden">
                                        {video.thumbnail ? (
                                            <img
                                                src={video.thumbnail}
                                                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 opacity-90 group-hover:opacity-100"
                                                loading="lazy"
                                                alt={video.title}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
                                                <SquareX size={48} className="opacity-30 mb-3 group-hover:text-red-500/50 transition-colors" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">No Preview</span>
                                            </div>
                                        )}

                                        {/* Cinematic Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300" />

                                        {/* Hover Play Button Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-50 group-hover:scale-100">
                                            <div className="w-12 h-12 rounded-full bg-gray-900/10 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-red-600/40">
                                                {selectedIds.has(video.id)
                                                    ? <SquareX className="text-white" size={20} />
                                                    : <FolderCheck className="text-white" size={20} />
                                                }
                                            </div>
                                        </div>

                                        {/* Duration Badge */}
                                        {video.duration && (
                                            <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wide border border-white/10 text-white shadow-lg">
                                                {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                                            </div>
                                        )}

                                        {/* Short Badge */}
                                        {video.is_short && (
                                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 px-2 py-1 rounded-md text-[9px] font-black tracking-widest shadow-lg shadow-red-900/50">
                                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                                SHORT
                                            </div>
                                        )}

                                        {/* Selection Indicator (Constant) */}
                                        <div className={`absolute top-2 left-2 transition-all duration-200 z-20 ${selectedIds.has(video.id) ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                                            <div className="rounded-lg shadow-lg bg-[#37373733] text-white p-1.5">
                                                <FolderCheck size={16} className="" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Info */}
                                    <div className="p-4 relative">
                                        <h4
                                            className="text-xs font-semibold leading-relaxed line-clamp-2 text-gray-200 min-h-[2.5em] group-hover:text-white transition-colors"
                                            title={video.title}
                                        >
                                            {video.title}
                                        </h4>
                                    </div>

                                    {/* Bottom highlight line */}
                                    {/* <div className={`h-1 w-full transition-all duration-300 ${selectedIds.has(video.id) ? 'bg-red-600' : 'bg-transparent group-hover:bg-white/10'}`} /> */}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Action Bar */}
            <div className="absolute bottom-4 md:bottom-6 left-0 right-0 px-4 md:px-6 z-40 pointer-events-none flex justify-center">
                <div className="pointer-events-auto glass-panel rounded-2xl p-2 md:p-2 md:pl-4 md:pr-2 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-6 shadow-2xl border border-white/10 bg-black/80 md:bg-black/60 backdrop-blur-xl transform translate-y-0 transition-all duration-500 animate-slide-up w-full md:w-auto">

                    <div className="flex items-center justify-between md:justify-start gap-4">
                        {/* Select All Toggle */}
                        <div
                            className="flex items-center gap-3 cursor-pointer group py-1 md:py-2"
                            onClick={toggleSelectAll}
                        >
                            <div className={`w-10 h-6 rounded-full p-1 transition-all duration-300 ease-in-out flex items-center
                                ${selectedIds.size > 0 && selectedIds.size === data.videos?.length ? 'bg-red-600 shadow-lg shadow-red-900/50' : 'bg-white/10 group-hover:bg-white/20 box-shadow-inner'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-all duration-300 ease-out
                                    ${selectedIds.size > 0 && selectedIds.size === data.videos?.length ? 'translate-x-4 scale-110' : 'translate-x-0'}`}
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-white uppercase tracking-wide group-hover:text-red-400 transition-colors">Select All</span>
                                <span className="text-[10px] text-gray-400 font-mono tracking-wider">{selectedIds.size} / {data.videos?.length || 0}</span>
                            </div>
                        </div>

                        {/* Pagination (Mobile: moved here) */}
                        <div className="flex md:hidden items-center gap-1 border-l border-white/10 pl-4">
                            <button
                                onClick={() => handlePageChange('prev')}
                                disabled={data.page <= 1 || data.loading}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 disabled:opacity-20 text-white"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="w-8 text-center text-xs font-bold font-mono text-gray-300">
                                {data.page}
                            </span>
                            <button
                                onClick={() => handlePageChange('next')}
                                disabled={!data.has_more || data.loading}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 disabled:opacity-20 text-white"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="hidden md:block h-8 w-px bg-white/10" />

                    {/* Desktop Pagination */}
                    <div className="hidden md:flex items-center gap-1 border-r border-white/10 pr-6 mr-2">
                        <button
                            onClick={() => handlePageChange('prev')}
                            disabled={data.page <= 1 || data.loading}
                            className="w-10 h-10 cursor-pointer flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 disabled:cursor-default text-white disabled:opacity-20 disabled:hover:bg-transparent transition-all hover:scale-105 active:scale-95"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="w-16 text-center text-sm font-bold font-mono text-gray-300">
                            {data.page}
                        </span>
                        <button
                            onClick={() => handlePageChange('next')}
                            disabled={!data.has_more || data.loading}
                            className="w-10 h-10 cursor-pointer flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white disabled:opacity-20 disabled:cursor-default disabled:hover:bg-transparent transition-all hover:scale-105 active:scale-95"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Settings Button */}
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`w-12 h-10 md:h-12 flex items-center cursor-pointer justify-center rounded-xl transition-all duration-300 md:mr-2 group flex-shrink-0
                            ${showSettings ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}
                        >
                            <Settings size={20} className={`transition-transform duration-500 ${showSettings ? 'rotate-180' : 'group-hover:rotate-90'}`} />
                        </button>

                        {/* Download Button */}
                        <button
                            onClick={startBatchDownload}
                            disabled={selectedIds.size === 0 || downloading}
                            className={`
                                btn-primary flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 rounded-xl flex items-center cursor-pointer justify-center gap-2 md:gap-3 text-sm font-bold uppercase tracking-widest transition-all duration-300
                                ${selectedIds.size === 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-red-600/40 hover:shadow-lg'}
                            `}
                        >
                            {downloading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Download size={18} className="animate-bounce" />
                            )}
                            <span>Download</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Settings Drawer */}
            <div className={`absolute bottom-24 right-6 left-0 md:left-auto md:w-96 glass-panel rounded-2xl border border-white/10 bg-[#0f0f0f]/95 shadow-2xl backdrop-blur-xl z-30 transition-all duration-500 ease-out origin-bottom-right
                ${showSettings ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95 pointer-events-none'}`}>

                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Settings size={16} /> Download Settings
                    </h3>
                    <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white transition">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5">
                    {/* Max Quality Switch */}
                    <div
                        className="flex items-center justify-between bg-white/5 p-4 rounded-xl cursor-pointer hover:bg-white/10 transition-colors group mb-6"
                        onClick={() => setIsMaxQuality(!isMaxQuality)}
                    >
                        <div>
                            <span className="block font-bold text-white text-sm mb-1 group-hover:text-green-400 transition-colors">Always Max Quality</span>
                            <span className="text-[10px] text-gray-400 font-mono">Download highest available resolution</span>
                        </div>
                        <div className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ease-in-out flex items-center
                            ${isMaxQuality ? 'bg-green-500' : 'bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-all duration-300 ease-out
                                ${isMaxQuality ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </div>
                    </div>

                    {/* Static Quality Grid */}
                    <div className={`transition-all duration-300 ${isMaxQuality ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Or Select Quality Cap</p>
                        <div className="grid grid-cols-2 gap-2">
                            {qualityOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSelectedCap(opt.value)}
                                    className={`relative p-3 rounded-lg border text-left transition-all group overflow-hidden
                                        ${selectedCap === opt.value
                                            ? 'bg-red-600 border-red-500 shadow-lg shadow-red-900/30'
                                            : 'bg-black/40 border-white/5 hover:border-white/20'}`}
                                >
                                    <span className={`text-sm font-bold ${selectedCap === opt.value ? 'text-white' : 'text-gray-300'}`}>
                                        {opt.label}
                                    </span>
                                    {selectedCap === opt.value && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            <Check size={14} className="text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
                            Videos will be downloaded at this quality, or their max available resolution if lower.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChannelFilter;
