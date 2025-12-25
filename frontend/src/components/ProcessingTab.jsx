import { useEffect, useState } from 'react';
import { Download, Loader, CheckCircle, AlertCircle, File, Clock, Wifi, Box, ArrowRight, Play, Zap, Database, MoreVertical, Pause } from 'lucide-react';

const ProcessingTab = ({ tasks, markAsDownloaded }) => {
    const taskList = Object.values(tasks);
    const activeTasks = taskList.filter(t => t.status === 'downloading' || t.status === 'optimizing' || t.status === 'queued').length;
    const completedTasks = taskList.filter(t => t.status === 'finished').length;
    const [scrolled, setScrolled] = useState(false);

    // Calculate precise total speed
    const [totalSpeed, setTotalSpeed] = useState('0 KB/s');
    useEffect(() => {
        let speedVal = 0;
        taskList.forEach(t => {
            if (t.status === 'downloading' && t.speed) {
                const match = t.speed.match(/([\d.]+)\s*([a-zA-Z]+)/);
                if (match) {
                    let val = parseFloat(match[1]);
                    const unit = match[2].toUpperCase();
                    if (unit.includes('M')) val *= 1024;
                    else if (unit.includes('K')) val *= 1;
                    else if (unit.includes('G')) val *= 1024 * 1024;
                    if (!isNaN(val)) speedVal += val;
                }
            }
        });
        setTotalSpeed(speedVal > 1024 ? `${(speedVal / 1024).toFixed(1)} MB/s` : `${speedVal.toFixed(1)} KB/s`);
    }, [tasks]);

    // Handle scroll for minimizing/hiding header if needed
    const handleScroll = (e) => {
        setScrolled(e.target.scrollTop > 20);
    };

    // Format bytes helper
    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    // Auto-download effect
    useEffect(() => {
        taskList.forEach(task => {
            if (task.status === 'finished' && !task.downloaded) {
                const downloadUrl = `http://localhost:5000/api/file/${encodeURIComponent(task.filename)}`;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', task.filename);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                markAsDownloaded(task.taskId);
            }
        });
    }, [tasks, markAsDownloaded]);

    if (taskList.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-fade-in relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                <div className="w-32 h-32 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(59,130,246,0.2)] animate-pulse-slow">
                    <Box size={40} className="text-blue-400 opacity-80" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">System Ready</h3>
                <p className="max-w-xs mx-auto text-sm text-gray-400 font-medium">Waiting for influx of new media tasks...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col w-full relative overflow-hidden bg-[#050505af] rounded-3xl" onScroll={handleScroll}>
            {/* Floating Cylindrical Stats Widget with Premium Glass Effect */}
            <div className={`absolute top-4 bg-gradient-to-br from-[#181818] to-[#050505] rounded-full right-4 z-30 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${scrolled ? 'transform translate-x-2' : ''}`}>
                <div className={`
                    glass-panel rounded-full flex items-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10
                    bg-black/40 backdrop-blur-xl transition-all duration-300
                    ${scrolled ? 'px-3 py-1.5' : 'px-5 py-2.5'}
               `}>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            {!scrolled && <span className="text-[10px] font-bold text-gray-400 tracking-wider">ACTIVE</span>}
                            <span className={`font-mono font-bold text-white ${scrolled ? 'text-xs' : 'text-sm'}`}>{activeTasks}</span>
                        </div>
                        <div className="w-px h-3 bg-white/10"></div>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            {!scrolled && <span className="text-[10px] font-bold text-gray-400 tracking-wider">SAVED</span>}
                            <span className={`font-mono font-bold text-white ${scrolled ? 'text-xs' : 'text-sm'}`}>{completedTasks}</span>
                        </div>
                        <div className="w-px h-3 bg-white/10"></div>
                        <div className="flex items-center gap-2 text-cyan-400">
                            <Wifi size={scrolled ? 10 : 12} />
                            <span className={`font-mono font-bold ${scrolled ? 'text-xs' : 'text-sm'}`}>{totalSpeed}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrolling Task List Container */}
            <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-20 overflow-y-auto custom-scrollbar">
                <div className="space-y-5">
                    {taskList.map((task) => (
                        <div
                            key={task.taskId}
                            className={`group relative rounded-2xl overflow-hidden transition-all duration-500
                            ${task.status === 'finished'
                                    ? 'bg-gradient-to-br from-[#222222] to-[#050505] border border-white/5 opacity-80 hover:opacity-100'
                                    : 'bg-gradient-to-br from-[#121212] to-[#080808] border border-white/10 shadow-2xl hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]'}`}
                        >
                            {/* Animated Gradient Glow Effect (Background) */}
                            {task.status === 'downloading' && (
                                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-500" />
                            )}

                            {/* Card Content */}
                            <div className="p-5 md:p-6 relative z-10 w-full">
                                {/* Top Row: Title + Meta */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex gap-4 min-w-0 md:items-center items-start w-full">

                                        {/* Text Info */}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-base md:text-lg font-bold text-white leading-tight truncate pr-4 group-hover:text-blue-100 transition-colors" title={task.title || task.filename}>
                                                {task.title || task.filename || 'Analyzing Video...'}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase
                                                    ${task.status === 'downloading' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                                        task.status === 'finished' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                                            task.status === 'optimizing' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                                                                'bg-gray-800 border-gray-700 text-gray-400'
                                                    }`}>
                                                    {task.status}
                                                </span>
                                                <span className="text-xs text-gray-500 font-medium hidden md:inline-block">
                                                    ID: <span className="font-mono text-gray-400">{task.taskId.slice(-4)}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress Section */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end text-xs font-medium">
                                        <div className="flex items-center gap-3 text-gray-400">
                                            {task.status === 'downloading' ? (
                                                <>
                                                    <span className="font-mono text-blue-400">{task.speed || '0 KB/s'}</span>
                                                    <span className="hidden md:inline text-gray-600">•</span>
                                                    <span className="font-mono text-gray-400">
                                                        {task.downloaded_bytes && task.total_bytes
                                                            ? `${formatBytes(task.downloaded_bytes)} / ${formatBytes(task.total_bytes)}`
                                                            : 'Calculating size...'}
                                                    </span>
                                                </>
                                            ) : task.status === 'finished' ? (
                                                <span className="text-green-500">
                                                    Download Complete
                                                </span>
                                            ) : (
                                                <span>Processing...</span>
                                            )}
                                        </div>
                                        <div className={`font-mono font-bold text-sm ${task.status === 'finished' ? 'text-green-400' : 'text-blue-400'}`}>
                                            {task.status === 'optimizing' ? '99%' : `${Math.round(task.progress)}%`}
                                        </div>
                                    </div>

                                    {/* Modern Progress Bar */}
                                    <div className="h-2 w-full bg-[#1a1a1a] rounded-full overflow-hidden relative shadow-inner border border-white/5">
                                        <div
                                            className={`h-full rounded-full transition-all duration-300 relative
                                                ${task.status === 'finished' ? 'bg-gradient-to-r from-green-600 to-green-400' :
                                                    task.status === 'error' ? 'bg-red-500' :
                                                        'bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400'}`}
                                            style={{ width: `${task.progress}%` }}
                                        >
                                            {/* Glowing Leading Edge */}
                                            {task.status === 'downloading' && (
                                                <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="h-32 md:h-20" /> {/* Spacer */}
            </div>
        </div>
    );
};

export default ProcessingTab;
