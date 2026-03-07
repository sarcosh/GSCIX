import { useState, useEffect } from 'react';
import {
    Globe,
    Search,
    Plus,
    Download,
    TrendingUp,
    Share2,
    ShieldCheck,
    MoreVertical,
    Activity,
    Box,
    History,
    AlertCircle,
    Loader2,
    RefreshCw,
    Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import apiService from '../services/api';
import type { GscixEntity } from '../types/api';

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

export const GeoStrategicActorExplorer: React.FC = () => {
    const [actors, setActors] = useState<GscixEntity[]>([]);
    const [selectedActor, setSelectedActor] = useState<GscixEntity | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchActors = async () => {
        try {
            setLoading(true);
            const data = await apiService.getActors();
            setActors(data);
            if (data.length > 0 && !selectedActor) {
                setSelectedActor(data[0]);
            }
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch actors:', err);
            setError('Could not connect to GSCIX backend. Please ensure the backend is running.');
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

    const filteredActors = actors.filter(actor =>
        actor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        actor.gsciAttributes?.geopolitical_doctrine?.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: Table Section */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
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
                                                    <div className="text-sm dark:text-slate-300 font-medium">{actor.gsciAttributes?.geopolitical_doctrine || 'Not defined'}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{actor.gsciAttributes?.power_projection || 'N/A'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 max-w-[60px]">
                                                            <div
                                                                className={cn("h-2 rounded-full", (actor.gsciAttributes?.hybrid_pressure_index || 0) > 7 ? "bg-risk-high" : "bg-primary")}
                                                                style={{ width: `${(actor.gsciAttributes?.hybrid_pressure_index || 0) * 10}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-xs font-bold dark:text-slate-300">{actor.gsciAttributes?.hybrid_pressure_index || '0.0'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={(e) => handleDelete(e, actor.stixId)}
                                                            className="p-1.5 text-slate-400 hover:text-risk-high hover:bg-risk-high/10 rounded transition-all"
                                                            title="Delete Actor"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-all">
                                                            <MoreVertical size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Right: Detailed Panel */}
                    <div className="lg:col-span-4">
                        {selectedActor ? (
                            <div className="glass-panel rounded-xl overflow-hidden sticky top-24">
                                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white border-b border-white/5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="px-3 py-1 bg-risk-high/20 text-risk-high rounded text-[10px] font-bold uppercase tracking-widest border border-risk-high/30">
                                            Priority Threat
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                            <span className="text-[10px] font-bold text-emerald-500 uppercase">Analyzing</span>
                                        </div>
                                    </div>
                                    <h2 className="text-2xl font-bold">{selectedActor.name}</h2>
                                    <p className="text-slate-400 text-sm mt-1">{selectedActor.description || 'Global strategic threat actor operating in multi-domain conflict zones.'}</p>
                                </div>

                                <div className="p-6 space-y-6 bg-surface-light dark:bg-surface-dark">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-border-light dark:border-border-dark">
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">Modernization Rate</div>
                                            <div className="text-lg font-bold dark:text-white">{(selectedActor.gsciAttributes?.technological_modernization_rate || 0) * 100}%</div>
                                        </div>
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-border-light dark:border-border-dark">
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">Ambigity Score</div>
                                            <div className="text-lg font-bold dark:text-white">{selectedActor.gsciAttributes?.strategic_ambiguity_score || '0.0'}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Activity size={14} className="text-primary" />
                                            Active Strategic Objectives
                                        </h4>
                                        <div className="space-y-3">
                                            <div className="flex gap-3">
                                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0"></div>
                                                <div>
                                                    <div className="text-sm font-semibold dark:text-slate-200">{selectedActor.gsciAttributes?.objective_type || 'General Objectives'}</div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Time Horizon: {selectedActor.gsciAttributes?.time_horizon || 'Unknown'}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-risk-high shrink-0"></div>
                                                <div>
                                                    <div className="text-sm font-semibold dark:text-slate-200">Revisionist Alignment</div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Index: {selectedActor.gsciAttributes?.revisionist_index || '0.0'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-border-light dark:border-border-dark">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                            <History size={14} className="text-primary" />
                                            Recent Technical Activity
                                        </h4>
                                        <div className="bg-slate-900 rounded-lg p-3 font-mono text-[10px] text-blue-400 space-y-1">
                                            <div>{">"} correlation_start --actor={selectedActor.stixId.substring(0, 8)}</div>
                                            <div className="text-slate-500">[2024-03-07 08:34] Fetching STIX from OpenCTI...</div>
                                            <div className="text-emerald-500">[2024-03-07 08:35] Identified linked cyber units via ElasticSearch</div>
                                            <div className="text-amber-500">[2024-03-07 08:35] Warning: High Strategic Ambigity detected</div>
                                            <div>{">"} build_report --format=pdf_gscix</div>
                                        </div>
                                    </div>

                                    <button className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-lg font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2">
                                        <Globe size={18} />
                                        Interactive Influence Map
                                    </button>
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
