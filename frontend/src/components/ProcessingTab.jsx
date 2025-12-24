import { useEffect, useState } from 'react';
import { Download, Loader, CheckCircle, AlertCircle, File, Clock, Wifi, Box, ArrowRight, Play, Zap } from 'lucide-react';

const ProcessingTab = ({ tasks, markAsDownloaded }) => {
    const taskList = Object.values(tasks);
    const activeTasks = taskList.filter(t => t.status === 'downloading' || t.status === 'optimizing' || t.status === 'queued').length;
    const completedTasks = taskList.filter(t => t.status === 'finished').length;

    // Calculate precise total speed
    const [totalSpeed, setTotalSpeed] = useState('0 KB/s');
    useEffect(() => {
        let speedVal = 0;
        taskList.forEach(t => {
            if (t.status === 'downloading' && t.speed) {
                // Robust parsing using Regex to handle variations like "2.5MiB/s", " 2.5 MiB/s"
                const match = t.speed.match(/([\d.]+)\s*([a-zA-Z]+)/);
                if (match) {
                    let val = parseFloat(match[1]);
                    const unit = match[2].toUpperCase(); // Normalize unit case

                    if (unit.includes('M')) val *= 1024;
                    else if (unit.includes('K')) val *= 1;
                    else if (unit.includes('G')) val *= 1024 * 1024; // Handle Gigabytes just in case

                    if (!isNaN(val)) speedVal += val;
                }
            }
        });
        setTotalSpeed(speedVal > 1024 ? `${(speedVal / 1024).toFixed(1)} MB/s` : `${speedVal.toFixed(1)} KB/s`);
    }, [tasks]);

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
        <div className="h-full flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-8 py-8">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900/20 to-black border border-blue-500/20 p-6 group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap size={64} />
                    </div>
                    <div className="relative z-10">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Active Tasks</div>
                        <div className="text-4xl font-black text-white tracking-tight flex items-baseline gap-2">
                            {activeTasks}
                            <span className="text-sm font-medium text-blue-400">Processing</span>
                        </div>
                    </div>
                    {/* Animated Glow */}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-transparent" />
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-900/20 to-black border border-green-500/20 p-6 group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircle size={64} />
                    </div>
                    <div className="relative z-10">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Completed</div>
                        <div className="text-4xl font-black text-white tracking-tight flex items-baseline gap-2">
                            {completedTasks}
                            <span className="text-sm font-medium text-green-400">Saved</span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-transparent" />
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/20 to-black border border-purple-500/20 p-6 group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wifi size={64} />
                    </div>
                    <div className="relative z-10">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Network Speed</div>
                        <div className="text-4xl font-black text-white tracking-tight flex items-baseline gap-2">
                            {totalSpeed}
                            <span className="text-sm font-medium text-purple-400">Total</span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-transparent" />
                </div>
            </div>

            {/* Task List Header */}
            <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Task Queue</h2>
                <div className="h-px bg-white/10 flex-1 ml-4" />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar -mr-2 pr-2 space-y-3 pb-20">
                {taskList.map((task) => (
                    <div
                        key={task.taskId}
                        className={`group relative rounded-xl border transition-all duration-300 overflow-hidden
                        ${task.status === 'finished'
                                ? 'bg-black/30 border-white/5 opacity-75 hover:opacity-100'
                                : 'bg-black/40 border-white/10 hover:border-blue-500/30 hover:bg-blue-900/5'}`}
                    >
                        {/* Status Line Indicator */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-300
                            ${task.status === 'finished' ? 'bg-green-500' :
                                task.status === 'error' ? 'bg-red-500' :
                                    task.status === 'optimizing' ? 'bg-yellow-500' :
                                        'bg-blue-500'}`}
                        />

                        {/* Background Progress Fill */}
                        {(task.status === 'downloading' || task.status === 'optimizing') && (
                            <div
                                className="absolute inset-0 bg-blue-500/5 pointer-events-none transition-all duration-300 z-0 origin-left"
                                style={{ transform: `scaleX(${task.progress / 100})` }}
                            />
                        )}

                        <div className="p-4 pl-6 flex items-center gap-5 relative z-10">

                            {/* Visual Status Icon */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-inset transition-all
                                ${task.status === 'finished' ? 'ring-green-500/20 bg-green-500/10 text-green-400' :
                                    task.status === 'error' ? 'ring-red-500/20 bg-red-500/10 text-red-500' :
                                        'ring-blue-500/20 bg-blue-500/10 text-blue-400 animate-pulse-slow'}`}>
                                {task.status === 'finished' ? <CheckCircle size={18} /> :
                                    task.status === 'error' ? <AlertCircle size={18} /> :
                                        task.status === 'queued' ? <Clock size={18} /> :
                                            <Loader size={18} className="animate-spin" />}
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-base text-gray-200 truncate pr-8 group-hover:text-white transition-colors" title={task.title || task.filename}>
                                        {task.title && task.title !== 'Queued Video' ? task.title :
                                            task.filename ? task.filename :
                                                <span className="italic opacity-50">Waiting for details...</span>}
                                    </h4>

                                    {task.status === 'finished' ? (
                                        <span className="text-[10px] font-bold text-green-500 bg-green-900/10 px-3 py-1 rounded-full border border-green-500/10">
                                            COMPLETED
                                        </span>
                                    ) : (
                                        <div className="font-mono font-bold text-sm text-blue-400 tabular-nums">
                                            {task.status === 'optimizing' ? '99%' : `${Math.round(task.progress)}%`}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between text-xs font-medium text-gray-500">
                                    <div className="flex items-center gap-4">
                                        <span className={`uppercase tracking-wider font-bold
                                            ${task.status === 'finished' ? 'text-green-500' :
                                                task.status === 'optimizing' ? 'text-yellow-500' :
                                                    task.status === 'error' ? 'text-red-500' :
                                                        'text-blue-500'}`}>
                                            {task.status === 'optimizing' ? 'FINALIZING...' : task.status}
                                        </span>

                                        {(task.status === 'downloading' || task.status === 'optimizing') && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-gray-700" />
                                                <span className="flex items-center gap-1.5 text-gray-400 font-mono">
                                                    <Wifi size={12} /> {task.speed || '0 KB/s'}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-gray-700" />
                                                <span className="flex items-center gap-1.5 text-gray-400 font-mono">
                                                    <File size={12} />
                                                    {task.downloaded_bytes && task.total_bytes
                                                        ? `${formatBytes(task.downloaded_bytes)} / ${formatBytes(task.total_bytes)}`
                                                        : 'Calculating...'}
                                                </span>
                                            </>
                                        )}

                                        {task.status === 'finished' && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-gray-700" />
                                                <span className="text-gray-500">{task.filename}</span>
                                            </>
                                        )}
                                    </div>

                                    {/* Progress Bar Line for active details */}
                                    <div className="w-32 h-1 bg-gray-800 rounded-full overflow-hidden ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className={`h-full rounded-full ${task.status === 'finished' ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${task.progress}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProcessingTab;
