import { useState, useEffect } from 'react';
import { LayoutDashboard, Activity, Zap } from 'lucide-react';
import io from 'socket.io-client';
import Home from './components/Home';
import ChannelFilter from './components/ChannelFilter';
import ProcessingTab from './components/ProcessingTab';
import VideoOptions from './components/VideoOptions';

const socket = io('http://localhost:5000');

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
                status: 'starting',
                progress: 0,
                title: title,
                thumbnail: thumbnail,
                taskId: taskId
            }
        }));
        setActiveTab('processing');
    };

    const markAsDownloaded = (taskId) => {
        setTasks(prev => ({
            ...prev,
            [taskId]: { ...prev[taskId], downloaded: true }
        }));
    };

    return (
        <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0a0a0a] text-white selection:bg-red-500/30">

            {/* Dynamic Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* Richer, darker background base */}
                <div className="absolute inset-0 bg-[#050505]" />

                {/* Animated Gradient Orbs */}
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[120px] animate-pulse-glow mix-blend-screen" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-glow mix-blend-screen" style={{ animationDelay: '3s' }} />
                <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-900/5 rounded-full blur-[150px] animate-pulse-glow mix-blend-screen" style={{ animationDelay: '5s' }} />

                {/* Noise Texture */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150 mix-blend-overlay" />
            </div>

            {/* Fixed Navbar */}
            <nav className="flex-shrink-0 relative z-50 glass-panel border-b border-white/5 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-red-600 to-red-800 rounded-xl shadow-lg shadow-red-900/50">
                        <Zap className="text-white fill-current" size={24} />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Tube<span className="text-red-500">Rip</span> Pro
                    </h1>
                </div>

                <div className="flex bg-black/40 rounded-xl p-1.5 border border-white/5">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300
                  ${activeTab === 'dashboard' ? 'bg-white/10 text-white shadow-lg backdrop-blur-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <LayoutDashboard size={18} />
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('processing')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 relative
                  ${activeTab === 'processing' ? 'bg-white/10 text-white shadow-lg backdrop-blur-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Activity size={18} />
                        Processing
                        {Object.values(tasks).some(t => t.status === 'downloading' || t.status === 'optimizing') && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        )}
                    </button>
                </div>
            </nav>

            {/* Main Content Area - Non-scrolling container */}
            <main className="flex-1 relative z-10 overflow-hidden flex flex-col">
                {activeTab === 'dashboard' ? (
                    !data ? (
                        <Home onInfoFetched={setData} />
                    ) : (
                        data.type === 'video' ? (
                            <VideoOptions
                                data={data}
                                onBack={() => setData(null)}
                                onDownloadStarted={handleSingleDownloadStarted}
                            />
                        ) : (
                            <ChannelFilter
                                data={data}
                                onBack={() => setData(null)}
                                onBatchDownloadStarted={handleBatchStarted}
                                onFetchPage={fetchChannelData}
                            />
                        )
                    )
                ) : (
                    <ProcessingTab
                        tasks={tasks}
                        markAsDownloaded={markAsDownloaded}
                    />
                )}
            </main>
        </div>
    );
}

export default App;
