import { useState, useEffect } from 'react';
import { LayoutDashboard, Activity, Zap } from 'lucide-react';
import io from 'socket.io-client';
import Home from './components/Home';
import ChannelFilter from './components/ChannelFilter';
import ProcessingTab from './components/ProcessingTab';
import VideoOptions from './components/VideoOptions';

export const socket = io('http://localhost:5000');

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [data, setData] = useState(null);
    const [tasks, setTasks] = useState({});

    useEffect(() => {
        socket.on('progress', (msg) => {
            setTasks(prev => ({
                ...prev,
                [msg.taskId]: { ...prev[msg.taskId], ...msg }
            }));
        });

        return () => socket.off('progress');
    }, []);

    const fetchChannelData = async (url, page = 1, tab = 'videos') => {
        setData(prev => ({
            ...prev,
            loading: true,
            url: url, // Ensure URL is preserved
            current_tab: tab, // Optimistic update
            page: page
        }));

        // Switch to dashboard if not already there
        setActiveTab('dashboard');

        try {
            // Use tab parameter for server-side filtering
            const response = await fetch('http://localhost:5000/api/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, page, tab })
            });

            const result = await response.json();
            if (result.error) throw new Error(result.error);

            setData(prev => ({
                ...result,
                loading: false,
                // Ensure client-side state consistency
                current_tab: tab,
                page: page
            }));
        } catch (e) {
            console.error("Fetch failed", e);
            // Reset loading but keep basic info if possible or show error
            setData(prev => ({ ...prev, loading: false }));
        }
    };

    // Effect to trigger initial load if passed data is 'loading' skeleton
    useEffect(() => {
        if (data && data.loading && data.url && (!data.videos || data.videos.length === 0)) {
            // Only fetch if we really don't have videos yet (prevent loops)
            // But wait, the instant switch sets loading: true and videos: []
            // So we should fetch.
            fetchChannelData(data.url, 1, 'videos');
        }
    }, [data?.url]); // Dependency on URL ensures check happens

    const startDownload = (ids, titlePlaceholder) => {
        const newTasks = {};
        ids.forEach(id => {
            const taskId = typeof id === 'string' && id.includes('-') ? id : `task_${Date.now()}_${Math.random()}`; // Simple ID gen if needed, but backend often generates task_ids for single downloads?
            // The ChannelFilter generates task IDs via batch endpoint.
            // VideoOptions (single download) needs handling.
            // Actually VideoOptions receives onDownloadStarted which passes taskIds.
        });
        setActiveTab('processing');
    };

    const handleBatchStarted = (taskIds, batchTitle) => {
        const newTasks = { ...tasks };
        taskIds.forEach(id => {
            newTasks[id] = {
                status: 'queued',
                progress: 0,
                thumbnail: null, // Could look up from data.videos
                title: 'Queued Video', // Placeholder until update
                taskId: id
            };
        });
        setTasks(newTasks);
        setActiveTab('processing');
    };

    const handleSingleDownloadStarted = (taskId, title, thumbnail) => {
        setTasks(prev => ({
            ...prev,
            [taskId]: {
                status: 'queued',
                progress: 0,
                thumbnail: thumbnail, // Could be improved
                title: title, // Passed from Options
                taskId: taskId
            }
        }));
        setActiveTab('processing');
    };

    return (
        <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden md:flex flex-col rounded-4xl w-64 bg-black/40 backdrop-blur-xl border-r border-white/5 h-full fixed left-0 top-0 z-50">
                <div className="p-8 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
                    <div className="flex items-center gap-2 text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                        <Zap className="text-red-500 fill-red-500 " /> <span className='font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500'>YtDown</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <button
                        align="left"
                        onClick={() => setActiveTab('dashboard')}
                        className={`w-full flex items-center cursor-pointer gap-4 px-4 py-3 rounded-xl transition-all duration-300 font-medium
                        ${activeTab === 'dashboard' ? 'bg-white/10 text-white shadow-lg shadow-white/5' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <LayoutDashboard size={20} /> Dashboard
                    </button>
                    <button
                        align="left"
                        onClick={() => setActiveTab('processing')}
                        className={`w-full flex items-center cursor-pointer gap-4 px-4 py-3 rounded-xl transition-all duration-300 font-medium
                        ${activeTab === 'processing' ? 'bg-blue-500/10 text-blue-400 shadow-lg shadow-blue-500/10' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <Activity size={20} />
                        <span className="flex-1 text-left">Downloads</span>
                        {Object.values(tasks).filter(t => t.status === 'downloading' || t.status === 'optimizing').length > 0 && (
                            <span className="bg-blue-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {Object.values(tasks).filter(t => t.status === 'downloading' || t.status === 'optimizing').length}
                            </span>
                        )}
                    </button>
                </nav>

                <div className="p-4 border-t border-white/5">
                    <div className="text-xs text-gray-500 text-center">
                        Made by <a href="https://github.com/helo-ayush" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">helo-ayush</a>
                    </div>
                </div>
            </div>

            {/* Mobile Content Wrapper (mb-16 for bottom nav) */}
            <main className="flex-1 md:ml-64 h-full overflow-hidden relative pb-20 md:pb-0">
                {/* Background ambient lighting */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-red-600/5 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
                </div>

                {/* Content Area */}
                <div className="h-full overflow-y-auto custom-scrollbar relative z-10 p-4 md:p-8">
                    {activeTab === 'dashboard' && (
                        !data ? (
                            <Home onInfoFetched={(info) => { setData(info); }} />
                        ) : (
                            data.type === 'playlist' || data.type === 'channel' ? (
                                <ChannelFilter
                                    data={data}
                                    onBack={() => setData(null)}
                                    onBatchDownload={handleBatchStarted}
                                    onFetchPage={fetchChannelData}
                                />
                            ) : (
                                <VideoOptions
                                    data={data}
                                    onBack={() => setData(null)}
                                    onDownloadStarted={handleSingleDownloadStarted}
                                />
                            )
                        )
                    )}

                    {activeTab === 'processing' && (
                        <ProcessingTab
                            tasks={tasks}
                            markAsDownloaded={(tid) => setTasks(prev => ({ ...prev, [tid]: { ...prev[tid], downloaded: true } }))}
                        />
                    )}
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 flex items-center justify-around h-20 z-50 pb-2">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'dashboard' ? 'text-white' : 'text-gray-500'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-white/10' : ''}`}>
                        <LayoutDashboard size={24} />
                    </div>
                    <span className="text-[10px] font-medium">Home</span>
                </button>

                <button
                    onClick={() => setActiveTab('processing')}
                    className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'processing' ? 'text-blue-400' : 'text-gray-500'}`}
                >
                    <div className={`relative p-1.5 rounded-xl transition-all ${activeTab === 'processing' ? 'bg-blue-500/20' : ''}`}>
                        <Activity size={24} />
                        {Object.values(tasks).filter(t => t.status === 'downloading' || t.status === 'optimizing').length > 0 && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-pulse" />
                        )}
                    </div>
                    <span className="text-[10px] font-medium">Downloads</span>
                </button>
            </div>
        </div>
    );
}

export default App;
