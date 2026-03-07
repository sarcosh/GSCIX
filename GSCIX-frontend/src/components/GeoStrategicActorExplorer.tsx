import { useState, useEffect, useMemo } from 'react';
import {
    Search,
    Plus,
    Download,
    TrendingUp,
    Share2,
    ShieldCheck,
    MoreVertical,
    Box,
    AlertCircle,
    Loader2,
    RefreshCw,
    Trash2,
    History,
    Activity
} from 'lucide-react';
import { cn } from '../lib/utils';
import apiService from '../services/api';
import type { GscixEntity, HpiAnalytics, HpiTrendPoint } from '../types/api';
import { ResponsiveContainer, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Line, ComposedChart } from 'recharts';

const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-4 shadow-sm relative overflow-hidden group">
        <div className={cn("absolute right-0 top-0 h-full w-1", colorClass)}></div>
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
            <Icon className={cn("text-lg opacity-80", colorClass.replace('bg-', 'text-'))} size={20} />
        </div>
        <div className="text-2xl font-bold dark:text-white">{value}</div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtext}</p>
    </div>
);

const CommandCenterHPI = ({ actor, analytics, loading }: { actor: GscixEntity; analytics?: import('../types/api').HpiAnalytics; loading: boolean }) => {
    if (loading) {
        return (
            <div className="w-full flex flex-col justify-center">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-6">Hybrid Pressure Index (HPI) Analysis</h3>
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            </div>
        );
    }

    const hpi = analytics?.current_hpi ?? actor.gsciAttributes?.hybrid_pressure_index ?? 0;
    const isHigh = hpi > 7.0;
    const isLow = hpi < 4.0;
    // Green (<4.0), Yellow (4.0-7.0), Red (>7.0).
    const colorClass = isHigh ? "text-risk-high" : isLow ? "text-emerald-500" : "text-amber-500";

    const confidence = analytics?.avg_confidence_score ?? actor.gsciAttributes?.confidence_score ?? 0;

    const breakdown = analytics?.pressure_breakdown || {};
    const sortedBreakdown = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    const hasBreakdown = sortedBreakdown.length > 0;
    const predominant = analytics?.predominant_vector || (hasBreakdown ? sortedBreakdown[0][0] : "None");

    return (
        <div className="w-full flex flex-col justify-center h-full">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-6">Hybrid Pressure Index (HPI) Analysis</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Command Center Main Display */}
                <div className="relative group bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] overflow-hidden cursor-default">
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3 z-10">Threat Pressure Level</div>

                    {/* Glowing HPI Text */}
                    <div className={cn("text-7xl font-black font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(currentcolor,0.4)] z-10", colorClass)}>
                        {hpi.toFixed(1)}
                    </div>

                    {/* Confidence Sub-indicator */}
                    <div className="mt-4 flex flex-col items-center z-10">
                        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Confidence Score</div>
                        <div className="text-xs font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded mt-1 border border-slate-700 shadow-inner">
                            {confidence.toFixed(1)}%
                        </div>
                    </div>

                    {/* Hover Tooltip Overlay (Analytical Breakdown) */}
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col justify-center items-stretch opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-slate-700 z-20">
                        <div className="text-xs font-mono text-slate-400 uppercase mb-3 border-b border-slate-800 pb-2 text-left tracking-widest flex items-center justify-between">
                            <span className="flex items-center gap-2"><Activity size={14} className="text-slate-500" /> Vector Breakdown</span>
                            {hasBreakdown && <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">Predominant: {predominant}</span>}
                        </div>
                        <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                            {hasBreakdown ? (
                                sortedBreakdown.map(([nature, count]) => {
                                    const isPredominant = nature.toLowerCase() === predominant.toLowerCase();
                                    return (
                                        <div key={nature} className="flex justify-between items-center text-sm font-mono">
                                            <span className={cn("capitalize", isPredominant ? "text-amber-400 font-bold" : "text-slate-300")}>{nature}</span>
                                            <span className={cn("font-bold px-2 py-0.5 rounded", isPredominant ? "text-amber-400 bg-amber-400/10" : "text-primary bg-primary/10")}>{count}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-xs text-slate-500 font-mono text-center flex flex-col items-center justify-center h-full pt-4">
                                    <span className="opacity-50">No vector data available</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Historical Data & Spike (Keep existing style) */}
                <div className="flex flex-col gap-4 justify-center">
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-border-light dark:border-border-dark flex justify-between items-center transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                        <div>
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Historical Avg (10y)</div>
                            <div className="text-2xl font-bold dark:text-slate-200 mt-1">
                                {analytics?.historical_avg ? analytics.historical_avg.toFixed(1) : '—'}
                            </div>
                        </div>
                        <History className="text-slate-300 dark:text-slate-600" size={32} />
                    </div>

                    {analytics?.spike_detected ? (
                        <div className="bg-risk-high/10 rounded-xl p-4 border border-risk-high/30 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                            <AlertCircle className="text-risk-high shrink-0 mt-0.5" size={24} />
                            <div>
                                <div className="text-sm font-bold text-risk-high uppercase">Escalation Spike Detected</div>
                                <div className="text-xs text-risk-high/80 mt-1 leading-relaxed">Cyber-geopolitical coupling index surged by &gt;2.0 points in the last 30 days.</div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20 flex items-start gap-3 shadow-sm">
                            <ShieldCheck className="text-emerald-500 shrink-0 mt-0.5" size={24} />
                            <div>
                                <div className="text-sm font-bold text-emerald-500 uppercase">Stable Baseline</div>
                                <div className="text-xs text-emerald-500/80 mt-1 leading-relaxed">No anomalous escalation in cyber-geopolitical intensity detected recently.</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const HPITrendChart = ({ analytics, loading }: { analytics?: HpiAnalytics; loading: boolean }) => {
    const trendData = useMemo(() => {
        if (!analytics?.trend_data || analytics.trend_data.length === 0) return [];
        return analytics.trend_data.map((point: HpiTrendPoint) => ({
            date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            hpi: point.hpi,
            drift: point.drift,
        }));
    }, [analytics?.trend_data]);

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">HPI Temporal Evolution</h3>
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            </div>
        );
    }

    if (trendData.length === 0) {
        return (
            <div className="w-full h-full flex flex-col">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">HPI Temporal Evolution</h3>
                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center">
                    <span className="text-xs text-slate-600 font-mono">No trend data available</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">HPI Temporal Evolution</h3>
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] overflow-hidden relative">
                {/* Grid background */}
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="hpiGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                                <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="hpiStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#f97316" />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                            axisLine={{ stroke: '#334155' }}
                            tickLine={{ stroke: '#334155' }}
                        />
                        <YAxis
                            domain={[0, 10]}
                            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                            axisLine={{ stroke: '#334155' }}
                            tickLine={{ stroke: '#334155' }}
                        />
                        <RechartsTooltip
                            contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                color: '#e2e8f0',
                            }}
                            labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: 4 }}
                        />
                        <Legend
                            wrapperStyle={{ fontFamily: 'monospace', fontSize: '10px', paddingTop: '8px' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="hpi"
                            name="HPI Real-Time"
                            stroke="url(#hpiStrokeGradient)"
                            strokeWidth={2.5}
                            fill="url(#hpiGradient)"
                            dot={{ fill: '#f97316', stroke: '#0f172a', strokeWidth: 2, r: 3 }}
                            activeDot={{ r: 5, fill: '#f97316', stroke: '#f97316', strokeWidth: 2, filter: 'drop-shadow(0 0 6px #f97316)' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="drift"
                            name="Decadal Strategic Drift"
                            stroke="#22d3ee"
                            strokeWidth={1.5}
                            strokeDasharray="6 3"
                            dot={false}
                            activeDot={{ r: 4, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 2 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};


export const GeoStrategicActorExplorer: React.FC = () => {
    const [actors, setActors] = useState<GscixEntity[]>([]);
    const [selectedActor, setSelectedActor] = useState<GscixEntity | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [actorAnalytics, setActorAnalytics] = useState<Record<string, HpiAnalytics>>({});
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    const fetchActors = async () => {
        try {
            setLoading(true);
            const data = await apiService.getActors();
            setActors(data);
            if (data.length > 0 && !selectedActor) {
                setSelectedActor(data[0]);
            }
            setError(null);

            // Fetch analytics
            setLoadingAnalytics(true);
            const analyticsMap: Record<string, HpiAnalytics> = {};
            await Promise.all(data.map(async (actor) => {
                try {
                    const analytics = await apiService.getActorAnalytics(actor.stixId);
                    analyticsMap[actor.stixId] = analytics;
                } catch {
                    // Fail silently for individual actors
                    console.debug('No analytics for', actor.stixId);
                }
            }));
            setActorAnalytics(analyticsMap);
            setLoadingAnalytics(false);

        } catch (err: any) {
            console.error('Failed to fetch actors:', err);
            setError('Could not connect to GSCIX backend. Please ensure the backend is running.');
            setLoadingAnalytics(false);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, stixId: string) => {
        e.stopPropagation(); // Prevent row click
        if (window.confirm('Are you sure you want to delete this actor and all its associated relations? This action cannot be undone.')) {
            try {
                setLoading(true);
                await apiService.deleteEntity(stixId);
                if (selectedActor?.stixId === stixId) {
                    setSelectedActor(null);
                }
                await fetchActors();
            } catch (err) {
                console.error('Delete failed:', err);
                setError('Failed to delete actor.');
            } finally {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchActors();
    }, []);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const filteredActors = actors.filter(actor =>
        actor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        actor.gsciAttributes?.geopolitical_doctrine?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Just now';
        try {
            return new Date(dateString).toISOString().split('T')[0];
        } catch {
            return dateString;
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark transition-colors duration-200">

            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold dark:text-white tracking-tight">Geo-Strategic Actor Explorer</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time identification and behavioral tracking of revisionist entities.</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="btn-secondary gap-2">
                            <Download size={18} />
                            Export STIX
                        </button>
                        <button className="btn-primary gap-2">
                            <Plus size={18} />
                            New Actor
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard title="Active Revisionists" value={actors.length.toString()} subtext="Verified in database" icon={AlertCircle} colorClass="bg-risk-high" />
                    <StatCard title="Escalation Events" value="84" subtext="High probability shifts" icon={TrendingUp} colorClass="bg-secondary" />
                    <StatCard title="Linked Cyber Units" value="156" subtext="Attributed via OpenCTI" icon={Share2} colorClass="bg-primary" />
                    <StatCard title="Intelligence Confidence" value="92%" subtext="STIX Correlation" icon={ShieldCheck} colorClass="bg-emerald-500" />
                </div>

                {/* Main Content Area */}
                <div className="flex flex-col gap-8">
                    {/* Top: Table Section */}
                    <div className="w-full flex flex-col gap-6">
                        {/* Toolbar */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center glass-panel p-2 rounded-lg">
                            <div className="relative w-full sm:max-w-md">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search size={18} className="text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by name, doctrine or region..."
                                    className="block w-full pl-10 pr-3 py-2 border border-border-light dark:border-border-dark rounded-md bg-white dark:bg-slate-900 dark:text-white text-sm focus:ring-primary focus:border-primary outline-none transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => fetchActors()}
                                    disabled={loading}
                                    className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
                                    title="Refresh"
                                >
                                    <RefreshCw size={16} className={cn(loading && "animate-spin")} />
                                </button>
                                <button className="px-3 py-1.5 text-xs font-semibold rounded bg-primary text-white">All Focus</button>
                                <button className="px-3 py-1.5 text-xs font-semibold rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">High Risk</button>
                                <button className="px-3 py-1.5 text-xs font-semibold rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Revisionist</button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="glass-panel rounded-xl overflow-hidden min-h-[400px]">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-[400px] text-slate-500">
                                    <Loader2 className="animate-spin mb-2" size={32} />
                                    <span>Syncing with GSCIX Backend...</span>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center h-[400px] text-center px-8">
                                    <AlertCircle className="text-risk-high mb-2" size={32} />
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{error}</span>
                                    <button onClick={fetchActors} className="mt-4 text-primary hover:underline text-sm font-medium">Try Again</button>
                                </div>
                            ) : filteredActors.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-[400px] text-slate-500">
                                    <Box className="mb-2 opacity-20" size={48} />
                                    <span>No actors found in database.</span>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-border-light dark:border-border-dark">
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Identified Actor</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Alignment</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Core Doctrine</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">HPI Score</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">First Seen</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Last Seen</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                        {filteredActors.map((actor) => (
                                            <tr
                                                key={actor.stixId}
                                                onClick={() => setSelectedActor(actor)}
                                                className={cn(
                                                    "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group",
                                                    selectedActor?.stixId === actor.stixId && "bg-primary/5 dark:bg-primary/10"
                                                )}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors font-bold text-xs">
                                                            {actor.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold dark:text-white">{actor.name}</div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">ID: {actor.stixId.substring(0, 12)}...</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={cn(
                                                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                                                        actor.gsciAttributes?.strategic_alignment === 'NATO' && "bg-blue-500/10 text-blue-600 border border-blue-500/20",
                                                        actor.gsciAttributes?.strategic_alignment === 'BRICS' && "bg-orange-500/10 text-orange-600 border border-orange-500/20",
                                                        actor.gsciAttributes?.strategic_alignment === 'Non-Aligned' && "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
                                                        actor.gsciAttributes?.strategic_alignment === 'EU' && "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20",
                                                        actor.gsciAttributes?.strategic_alignment === 'Revisionist' && "bg-risk-high/10 text-risk-high border border-risk-high/20",
                                                        (!actor.gsciAttributes?.strategic_alignment || actor.gsciAttributes?.strategic_alignment === 'Other') && "bg-slate-500/10 text-slate-600 border border-slate-500/20"
                                                    )}>
                                                        {actor.gsciAttributes?.strategic_alignment || 'Unknown'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm dark:text-slate-300 font-medium">
                                                        {actor.gsciAttributes?.geopolitical_doctrine || actor.gsciAttributes?.power_projection || 'Not informed'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {loadingAnalytics ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 max-w-[60px] overflow-hidden">
                                                                <div className="h-full bg-slate-300 dark:bg-slate-600 animate-pulse w-full"></div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 max-w-[60px]">
                                                                <div
                                                                    className={cn("h-1.5 rounded-full",
                                                                        (actorAnalytics[actor.stixId]?.current_hpi || actor.gsciAttributes?.hybrid_pressure_index || 0) > 7 ? "bg-risk-high" :
                                                                            (actorAnalytics[actor.stixId]?.current_hpi || actor.gsciAttributes?.hybrid_pressure_index || 0) > 4 ? "bg-secondary" : "bg-primary"
                                                                    )}
                                                                    style={{ width: `${Math.min(100, (actorAnalytics[actor.stixId]?.current_hpi || actor.gsciAttributes?.hybrid_pressure_index || 0) * 10)}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className={cn(
                                                                "text-sm font-bold",
                                                                (actorAnalytics[actor.stixId]?.current_hpi || actor.gsciAttributes?.hybrid_pressure_index || 0) > 7 ? "text-risk-high" : "text-primary"
                                                            )}>
                                                                {(actorAnalytics[actor.stixId]?.current_hpi || actor.gsciAttributes?.hybrid_pressure_index || 0).toFixed(1)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 font-mono">
                                                    {formatDate(actor.gsciAttributes?.first_seen)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 font-mono">
                                                    {formatDate(actor.gsciAttributes?.last_seen)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="relative flex justify-end">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setOpenMenuId(openMenuId === actor.stixId ? null : actor.stixId);
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-all"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>

                                                        {openMenuId === actor.stixId && (
                                                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-border-light dark:border-border-dark z-50 overflow-hidden animate-in fade-in zoom-in duration-150 py-1">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                                                >
                                                                    Edit Actor Profile
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        handleDelete(e, actor.stixId);
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                                                                >
                                                                    <Trash2 size={14} />
                                                                    Delete Actor
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Bottom: Detailed Panel */}
                    <div className="w-full">
                        {selectedActor ? (
                            <div className="mt-6 border border-border-light dark:border-border-dark rounded-xl bg-surface-light dark:bg-surface-dark shadow-lg overflow-hidden flex flex-col md:flex-row">
                                <div className="p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-slate-900/50">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="h-12 w-12 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-risk-high text-xl font-bold">
                                            {selectedActor.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold">{selectedActor.name}</h2>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono uppercase">
                                                {selectedActor.gsciAttributes?.strategic_alignment || 'Unknown'} Actor
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Strategic Objective</label>
                                            <p className="text-sm mt-1 dark:text-slate-300">{selectedActor.gsciAttributes?.objective_type || 'General Objectives'}</p>
                                        </div>
                                        <div className="mb-2">
                                            <label className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Revisionist Index</label>
                                            <div className="mt-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-risk-high/10 text-risk-high border border-risk-high/20">
                                                {selectedActor.gsciAttributes?.revisionist_index || '0.0'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">Description</label>
                                            <p className="text-sm mt-1 text-slate-500 dark:text-slate-400 leading-relaxed">
                                                {selectedActor.description || 'Global strategic threat actor operating in multi-domain conflict zones.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 md:w-2/3 flex flex-col gap-6">
                                    <CommandCenterHPI
                                        actor={selectedActor}
                                        analytics={actorAnalytics[selectedActor.stixId]}
                                        loading={loadingAnalytics}
                                    />
                                    <div className="min-h-[280px]">
                                        <HPITrendChart
                                            analytics={actorAnalytics[selectedActor.stixId]}
                                            loading={loadingAnalytics}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="glass-panel rounded-xl aspect-[3/4] flex flex-col items-center justify-center text-slate-500 p-8 text-center border-dashed border-2">
                                <Box className="mb-4 opacity-20" size={64} />
                                <h3 className="text-lg font-semibold mb-1">No Actor Selected</h3>
                                <p className="text-sm">Select an entity from the list to view advanced strategic insights and technical telemetry.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};
