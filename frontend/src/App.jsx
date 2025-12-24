import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Activity, Zap, Settings, Save, X } from 'lucide-react';
import io from 'socket.io-client';
import Home from './components/Home';
import ChannelFilter from './components/ChannelFilter';
import ProcessingTab from './components/ProcessingTab';
import VideoOptions from './components/VideoOptions';

function App() {
    // Persistent State for API URL
    const [apiUrl, setApiUrl] = useState(() => {
        return localStorage.getItem('API_BASE_URL') || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    });
    const [showSettings, setShowSettings] = useState(false);

    // Socket State
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const [activeTab, setActiveTab] = useState('dashboard');
    const [data, setData] = useState(null);
    const [tasks, setTasks] = useState({});

    // Initialize Socket when apiUrl changes
    useEffect(() => {
        // Disconnect previous
        if (socket) socket.disconnect();

        console.log(`Connecting to socket at: ${apiUrl}`);
        const newSocket = io(apiUrl);

        newSocket.on('connect', () => {
            console.log("Socket connected:", newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => setIsConnected(false));

        newSocket.on('progress', (msg) => {
            setTasks(prev => ({
                ...prev,
                [msg.taskId]: { ...prev[msg.taskId], ...msg }
            }));
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [apiUrl]);

    // Function to update API URL
    const updateApiUrl = (newUrl) => {
        let cleaned = newUrl.replace(/\/$/, ""); // Remove trailing slash
        setApiUrl(cleaned);
        localStorage.setItem('API_BASE_URL', cleaned);
        setShowSettings(false);
        // Reset data/tabs on switch? Maybe not needed.
    };

    const fetchChannelData = async (url, page = 1, tab = 'videos') => {
        setData(prev => ({
            ...prev,
            loading: true,
            url: url,
            current_tab: tab,
            page: page
        }));

        setActiveTab('dashboard');

        try {
            const response = await fetch(`${apiUrl}/api/info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, page, tab })
            });

            const result = await response.json();
            if (result.error) throw new Error(result.error);

            setData(prev => ({
                ...result,
                loading: false,
                current_tab: tab,
                page: page
            }));
        } catch (e) {
            console.error("Fetch failed", e);
            setData(prev => ({ ...prev, loading: false }));
            // Maybe show a toast error? "Failed to connect to backend"
        }
    };

    useEffect(() => {
        if (data && data.loading && data.url && (!data.videos || data.videos.length === 0)) {
            fetchChannelData(data.url, 1, 'videos');
        }
    }, [data?.url]);

    const handleBatchStarted = (taskIds, batchTitle) => {
        const newTasks = { ...tasks };
        taskIds.forEach(id => {
            newTasks[id] = {
                status: 'queued',
                progress: 0,
                thumbnail: null,
                title: 'Queued Video',
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
                thumbnail: thumbnail,
                title: title,
                taskId: taskId
            }
        }));
        setActiveTab('processing');
    };

    return (
        <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Settings size={20} className="text-gray-400" /> Settings
                            </h3>
                            <button onClick={() => setShowSettings(false)} className="bg-white/5 p-2 rounded-full hover:bg-white/10 transition">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Backend API URL</label>
                                <form onSubmit={(e) => { e.preventDefault(); updateApiUrl(e.target.url.value); }}>
                                    <input
                                        name="url"
                                        defaultValue={apiUrl}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition text-white"
                                        placeholder="https://your-backend.hf.space"
                                    />
                                    <div className="text-[10px] text-gray-500 mt-2 flex items-center gap-2">
                                        Status: {isConnected ? <span className="text-green-500">Video Server Connected</span> : <span className="text-red-500">Disconnected</span>}
                                    </div>
                                    <button type="submit" className="w-full mt-4 btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                                        <Save size={18} /> Save & Reconnect
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

                <div className="p-4 border-t border-white/5 space-y-2">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all text-sm font-medium"
                    >
                        <Settings size={18} /> Backend Settings
                    </button>
                    <div className="text-xs text-gray-500 text-center pt-2">
                        Made by <a href="https://github.com/helo-ayush" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">helo-ayush</a>
                    </div>
                </div>
            </div>

            {/* Mobile Content Wrapper */}
            <main className="flex-1 md:ml-64 h-full overflow-hidden relative pb-20 md:pb-0">
                {/* Background ambient lighting */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-red-600/5 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
                </div>

                {/* Content Area */}
                <div className="h-full overflow-y-auto custom-scrollbar relative z-10 p-4 md:p-8">
                    {/* Mobile Settings Button (Top Right) */}
                    <button
                        onClick={() => setShowSettings(true)}
                        className="md:hidden absolute top-4 right-4 z-50 p-2 bg-black/50 backdrop-blur-md rounded-full text-gray-400 border border-white/10"
                    >
                        <Settings size={20} />
                    </button>

                    {activeTab === 'dashboard' && (
                        !data ? (
                            <Home onInfoFetched={(info) => { setData(info); }} />
                        ) : (
                            data.type === 'playlist' || data.type === 'channel' ? (
                                <ChannelFilter
                                    data={data}
                                    onBack={() => setData(null)}
                                    onBatchDownloadStarted={handleBatchStarted}
                                    onFetchPage={fetchChannelData}
                                    socket={socket} // Pass socket
                                    apiUrl={apiUrl} // Pass apiUrl
                                />
                            ) : (
                                <VideoOptions
                                    data={data}
                                    onBack={() => setData(null)}
                                    onDownloadStarted={handleSingleDownloadStarted}
                                    socket={socket} // Pass socket
                                    apiUrl={apiUrl} // Pass apiUrl
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
