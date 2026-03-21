import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search,
    Loader2,
    AlertCircle,
    ChevronDown,
    ZoomIn,
    ZoomOut,
    Clock,
    Globe,
    Shield,
    Activity,
    GitBranch,
    RefreshCw,
    Info,
} from 'lucide-react';
import { cn } from '../lib/utils';
import apiService from '../services/api';
import type { GscixEntity, GscixRelation, InfluenceGraphData } from '../types/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_TYPE_LABELS: Record<string, string> = {
    'x-geo-strategic-actor': 'Geo-Strategic Actor',
    'x-strategic-objective': 'Strategic Objective',
    'x-hybrid-campaign': 'Hybrid Campaign',
    'x-influence-vector': 'Influence Vector',
    'x-strategic-impact': 'Strategic Impact',
    'x-strategic-assessment': 'Strategic Assessment',
};

const GEO_LANE_TYPES = new Set([
    'x-geo-strategic-actor',
    'x-strategic-objective',
    'x-strategic-assessment',
]);

const CYBER_LANE_TYPES = new Set([
    'x-influence-vector',
    'x-hybrid-campaign',
    'x-strategic-impact',
]);

const TYPE_COLOR: Record<string, { border: string; text: string; bg: string; connector: string }> = {
    'x-geo-strategic-actor':    { border: 'border-amber-400 dark:border-amber-500',   text: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30',    connector: '#f59e0b' },
    'x-strategic-objective':    { border: 'border-amber-300 dark:border-amber-600',   text: 'text-amber-500 dark:text-amber-300',   bg: 'bg-amber-50/60 dark:bg-amber-950/20', connector: '#fbbf24' },
    'x-strategic-assessment':   { border: 'border-orange-400 dark:border-orange-500', text: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-950/30',  connector: '#f97316' },
    'x-influence-vector':       { border: 'border-cyan-400 dark:border-cyan-500',     text: 'text-cyan-600 dark:text-cyan-400',     bg: 'bg-cyan-50 dark:bg-cyan-950/30',      connector: '#06b6d4' },
    'x-hybrid-campaign':        { border: 'border-primary dark:border-primary',       text: 'text-primary',                         bg: 'bg-cyan-50/70 dark:bg-cyan-950/20',   connector: '#0891b2' },
    'x-strategic-impact':       { border: 'border-rose-400 dark:border-rose-500',     text: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-50 dark:bg-rose-950/30',      connector: '#f43f5e' },
};

const DEFAULT_COLOR = {
    border: 'border-slate-300 dark:border-slate-600',
    text: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-800/40',
    connector: '#64748b',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEntityDate(e: GscixEntity): Date | null {
    const raw = e.first_seen || e.gsciAttributes?.first_seen;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

function formatDateLabel(d: Date): string {
    return d.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
}

function getConfidenceLabel(confidence?: number): string {
    if (confidence === undefined || confidence === null) return 'N/A';
    return `${Math.round(confidence)}% CONF`;
}

function getTypeShortLabel(type: string): string {
    const map: Record<string, string> = {
        'x-geo-strategic-actor':  'Actor',
        'x-strategic-objective':  'Objective',
        'x-hybrid-campaign':      'Campaign',
        'x-influence-vector':     'Inf. Vector',
        'x-strategic-impact':     'Impact',
        'x-strategic-assessment': 'Assessment',
    };
    return map[type] || type;
}

function lerp(min: number, max: number, t: number): number {
    return min + (max - min) * t;
}

// ─── Timeline Card ────────────────────────────────────────────────────────────

const TimelineCard: React.FC<{ entity: GscixEntity }> = ({ entity }) => {
    const colors = TYPE_COLOR[entity.type] || DEFAULT_COLOR;
    const confidence = entity.confidence ?? entity.gsciAttributes?.hybrid_pressure_index;
    const dateStr = entity.first_seen || entity.gsciAttributes?.first_seen;
    const date = dateStr ? new Date(dateStr) : null;

    return (
        <div className={cn(
            'bg-white dark:bg-slate-900 p-4 rounded-xl shadow-md border w-56',
            'hover:shadow-lg transition-all cursor-pointer relative z-20 flex-shrink-0',
            colors.border,
        )}>
            <div className="flex justify-between items-start mb-2 gap-1">
                <span className={cn('text-[9px] font-mono uppercase font-bold tracking-widest leading-tight', colors.text)}>
                    {getTypeShortLabel(entity.type)}
                </span>
                {confidence !== undefined && confidence !== null && (
                    <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0', colors.text, colors.bg, colors.border)}>
                        {getConfidenceLabel(confidence)}
                    </span>
                )}
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1 leading-tight line-clamp-2">
                {entity.name}
            </h4>
            {date && (
                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mb-1">
                    {date.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                </p>
            )}
            {entity.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                    {entity.description}
                </p>
            )}
        </div>
    );
};

// ─── Activity Log Row ─────────────────────────────────────────────────────────

const ActivityLogRow: React.FC<{
    relation: GscixRelation;
    entities: GscixEntity[];
    index: number;
}> = ({ relation, entities, index }) => {
    const source = entities.find(e => e.stixId === relation.source_ref);
    const target = entities.find(e => e.stixId === relation.target_ref);
    const palette = [
        { color: 'text-primary',   bgColor: 'bg-primary/10',   badge: 'STATUS' },
        { color: 'text-risk-high', bgColor: 'bg-risk-high/10', badge: 'ALERT'  },
        { color: 'text-amber-500', bgColor: 'bg-amber-500/10', badge: 'INFO'   },
    ];
    const p = palette[index % palette.length];

    return (
        <div className="flex items-center gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span className={cn('text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase', p.color, p.bgColor)}>
                {p.badge}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 flex-1 truncate">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {source?.name || relation.source_ref.slice(0, 20)}
                </span>
                {' '}
                <span className="font-mono text-[10px] text-slate-400">
                    —[{relation.relationship_type}]→
                </span>
                {' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {target?.name || relation.target_ref.slice(0, 20)}
                </span>
            </span>
            {relation.confidence !== undefined && (
                <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                    {Math.round(relation.confidence)}%
                </span>
            )}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface EntityExplorerTimelineProps {
    initialEntityId?: string;
}

export const EntityExplorerTimeline: React.FC<EntityExplorerTimelineProps> = ({ initialEntityId }) => {
    // State
    const [allEntities, setAllEntities] = useState<GscixEntity[]>([]);
    const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(initialEntityId);
    const [graphDepth, setGraphDepth] = useState<number>(2);
    const [graphData, setGraphData] = useState<InfluenceGraphData | null>(null);
    const [loadingEntities, setLoadingEntities] = useState(true);
    const [loadingGraph, setLoadingGraph] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [entitySearch, setEntitySearch] = useState('');
    const [showEntityDropdown, setShowEntityDropdown] = useState(false);
    const [zoom, setZoom] = useState(1);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    // ── Fetch all entities for the selector ──
    useEffect(() => {
        setLoadingEntities(true);
        apiService.getEntities()
            .then(entities => {
                setAllEntities(entities);
                if (!selectedEntityId && entities.length > 0) {
                    setSelectedEntityId(entities[0].stixId);
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoadingEntities(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Sync initialEntityId prop ──
    useEffect(() => {
        if (initialEntityId) {
            setSelectedEntityId(initialEntityId);
        }
    }, [initialEntityId]);

    // ── Fetch graph when entity or depth changes ──
    useEffect(() => {
        if (!selectedEntityId) return;
        setLoadingGraph(true);
        setError(null);
        apiService.getInfluenceGraph(selectedEntityId, graphDepth)
            .then(data => setGraphData(data))
            .catch(err => setError(err.message))
            .finally(() => setLoadingGraph(false));
    }, [selectedEntityId, graphDepth]);

    // ── Close dropdown on outside click ──
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowEntityDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Derived data ──
    const selectedEntity = useMemo(
        () => allEntities.find(e => e.stixId === selectedEntityId),
        [allEntities, selectedEntityId],
    );

    const filteredEntities = useMemo(() => {
        if (!entitySearch) return allEntities;
        const q = entitySearch.toLowerCase();
        return allEntities.filter(e =>
            e.name.toLowerCase().includes(q) ||
            (ENTITY_TYPE_LABELS[e.type] || e.type).toLowerCase().includes(q),
        );
    }, [allEntities, entitySearch]);

    const graphEntities = useMemo(() => graphData?.entities || [], [graphData]);
    const graphRelations = useMemo(() => graphData?.relations || [], [graphData]);

    const { geoEntities, cyberEntities } = useMemo(() => {
        const geo: GscixEntity[] = [];
        const cyber: GscixEntity[] = [];
        for (const e of graphEntities) {
            if (GEO_LANE_TYPES.has(e.type)) geo.push(e);
            else if (CYBER_LANE_TYPES.has(e.type)) cyber.push(e);
        }
        const sortByDate = (a: GscixEntity, b: GscixEntity) => {
            const da = getEntityDate(a)?.getTime() ?? 0;
            const db = getEntityDate(b)?.getTime() ?? 0;
            return da - db;
        };
        return { geoEntities: geo.sort(sortByDate), cyberEntities: cyber.sort(sortByDate) };
    }, [graphEntities]);

    const { minDate, maxDate, dateMarkers, totalTimelineWidth } = useMemo(() => {
        const allDates = graphEntities
            .map(e => getEntityDate(e))
            .filter((d): d is Date => d !== null);

        if (allDates.length === 0) {
            const now = new Date();
            const past = new Date(now);
            past.setMonth(now.getMonth() - 12);
            return { minDate: past, maxDate: now, dateMarkers: [past, now], totalTimelineWidth: 2000 };
        }

        const times = allDates.map(d => d.getTime());
        const rawMin = new Date(Math.min(...times));
        const rawMax = new Date(Math.max(...times));
        const span = rawMax.getTime() - rawMin.getTime() || 1000 * 60 * 60 * 24 * 30;
        const paddedMin = new Date(rawMin.getTime() - span * 0.1);
        const paddedMax = new Date(rawMax.getTime() + span * 0.1);

        const markers: Date[] = [];
        for (let i = 0; i <= 5; i++) {
            markers.push(new Date(lerp(paddedMin.getTime(), paddedMax.getTime(), i / 5)));
        }
        const width = Math.max(2000, (geoEntities.length + cyberEntities.length) * 300);

        return { minDate: paddedMin, maxDate: paddedMax, dateMarkers: markers, totalTimelineWidth: width };
    }, [graphEntities, geoEntities.length, cyberEntities.length]);

    const dateToX = (date: Date | null, totalWidth: number): number => {
        if (!date) return totalWidth / 2;
        const t = (date.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime());
        return Math.round(lerp(80, totalWidth - 80, Math.max(0, Math.min(1, t))));
    };

    // Stats
    const totalSignals = graphData?.nodeCount ?? 0;
    const maxHPI = useMemo(() => {
        const vals = graphEntities
            .map(e => e.gsciAttributes?.hybrid_pressure_index ?? 0)
            .filter(v => v > 0);
        return vals.length > 0 ? Math.max(...vals) : null;
    }, [graphEntities]);

    const riskLabel = maxHPI !== null
        ? maxHPI > 7 ? 'CRIT' : maxHPI > 4 ? 'HIGH' : 'MED'
        : 'N/A';

    // Correlation matrix
    const correlationData = useMemo(() => {
        if (!selectedEntity?.gsciAttributes) return [];
        const a = selectedEntity.gsciAttributes;
        return [
            { label: 'Cyber-Geopolitical Coupling', value: a.cyber_geopolitical_coupling_index },
            { label: 'Political Destabilization', value: a.political_destabilization_index },
            { label: 'Economic Disruption', value: a.economic_disruption_index },
            { label: 'Alliance Fragmentation', value: a.alliance_fragmentation_score },
            { label: 'Deterrence Signal', value: a.deterrence_signal_strength },
            { label: 'Narrative Penetration', value: a.narrative_penetration_score },
        ].filter((i): i is { label: string; value: number } => i.value !== undefined && i.value !== null);
    }, [selectedEntity]);

    // Correlation lines (SVG, connect closest geo↔cyber pairs)
    const scaledWidth = totalTimelineWidth * zoom;
    const correlationLines = useMemo(() => {
        if (geoEntities.length === 0 || cyberEntities.length === 0) return [];
        const lines: { x1: number; x2: number; color: string }[] = [];
        for (const geo of geoEntities.slice(0, 4)) {
            const geoDate = getEntityDate(geo);
            if (!geoDate) continue;
            let closest: GscixEntity | null = null;
            let minDiff = Infinity;
            for (const cyber of cyberEntities) {
                const cd = getEntityDate(cyber);
                if (!cd) continue;
                const diff = Math.abs(geoDate.getTime() - cd.getTime());
                if (diff < minDiff) { minDiff = diff; closest = cyber; }
            }
            if (closest) {
                lines.push({
                    x1: dateToX(geoDate, scaledWidth),
                    x2: dateToX(getEntityDate(closest), scaledWidth),
                    color: TYPE_COLOR[geo.type]?.connector || '#06b6d4',
                });
            }
        }
        return lines;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geoEntities, cyberEntities, scaledWidth, minDate, maxDate]);

    // Zoom controls
    const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 2));
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));

    // Refresh handler
    const handleRefresh = () => {
        if (!selectedEntityId) return;
        setLoadingGraph(true);
        apiService.getInfluenceGraph(selectedEntityId, graphDepth)
            .then(d => setGraphData(d))
            .catch(e => setError(e.message))
            .finally(() => setLoadingGraph(false));
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark">
            <div className="max-w-screen-2xl mx-auto px-6 py-8">

                {/* ───── Context Header ───── */}
                <div className="flex flex-col gap-6 mb-8">
                    <div className="flex items-end justify-between flex-wrap gap-4">
                        {/* Left: selector + depth */}
                        <div className="flex flex-col gap-2">
                            {/* Breadcrumb */}
                            <div className="flex items-center gap-2">
                                <span className="bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-mono font-semibold rounded uppercase tracking-wider border border-primary/20">
                                    {selectedEntity ? (ENTITY_TYPE_LABELS[selectedEntity.type] || selectedEntity.type) : 'Entity Root'}
                                </span>
                                {selectedEntity && (
                                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        // STRATEGIC HYBRID TIMELINE
                                    </span>
                                )}
                            </div>

                            {/* Entity selector + depth + refresh */}
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Dropdown */}
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => setShowEntityDropdown(v => !v)}
                                        className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100 hover:text-primary dark:hover:text-primary transition-colors"
                                        disabled={loadingEntities}
                                    >
                                        {loadingEntities ? (
                                            <Loader2 size={20} className="animate-spin text-primary" />
                                        ) : (
                                            <>
                                                <span className="truncate max-w-[300px]">
                                                    {selectedEntity?.name || 'Select Entity...'}
                                                </span>
                                                <ChevronDown size={18} className={cn('transition-transform', showEntityDropdown && 'rotate-180')} />
                                            </>
                                        )}
                                    </button>

                                    {showEntityDropdown && (
                                        <div className="absolute top-full mt-2 left-0 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-border-light dark:border-border-dark z-50 overflow-hidden">
                                            <div className="p-3 border-b border-border-light dark:border-border-dark">
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Search entities..."
                                                        value={entitySearch}
                                                        onChange={e => setEntitySearch(e.target.value)}
                                                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-slate-200"
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {filteredEntities.length === 0 ? (
                                                    <p className="text-xs text-slate-400 text-center py-6">No entities found</p>
                                                ) : filteredEntities.map(e => (
                                                    <button
                                                        key={e.stixId}
                                                        onClick={() => {
                                                            setSelectedEntityId(e.stixId);
                                                            setShowEntityDropdown(false);
                                                            setEntitySearch('');
                                                        }}
                                                        className={cn(
                                                            'w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                                                            selectedEntityId === e.stixId && 'bg-primary/5 dark:bg-primary/10',
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            'text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded flex-shrink-0',
                                                            TYPE_COLOR[e.type]?.text || 'text-slate-500',
                                                            TYPE_COLOR[e.type]?.bg || 'bg-slate-100',
                                                        )}>
                                                            {getTypeShortLabel(e.type)}
                                                        </span>
                                                        <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{e.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Depth selector */}
                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 border border-border-light dark:border-border-dark">
                                    <GitBranch size={13} className="text-slate-400" />
                                    <span className="text-[10px] font-mono uppercase text-slate-400 tracking-widest">Depth</span>
                                    {[1, 2, 3, 4, 5].map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setGraphDepth(d)}
                                            className={cn(
                                                'w-6 h-6 rounded text-[11px] font-bold font-mono transition-all',
                                                graphDepth === d
                                                    ? 'bg-primary text-white shadow'
                                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
                                            )}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>

                                {/* Refresh */}
                                <button
                                    onClick={handleRefresh}
                                    disabled={loadingGraph}
                                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-border-light dark:border-border-dark"
                                    title="Refresh timeline"
                                >
                                    <RefreshCw size={14} className={cn(loadingGraph && 'animate-spin')} />
                                </button>
                            </div>
                        </div>

                        {/* Right: stats */}
                        <div className="flex gap-3">
                            <div className="bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-xl p-4 flex flex-col min-w-[110px] shadow-sm">
                                <span className="text-[9px] font-mono uppercase text-slate-400 tracking-widest mb-1">Total Signals</span>
                                <span className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                                    {loadingGraph ? '\u2014' : totalSignals.toLocaleString()}
                                </span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-xl p-4 flex flex-col min-w-[110px] shadow-sm">
                                <span className="text-[9px] font-mono uppercase text-slate-400 tracking-widest mb-1">Risk Index</span>
                                <span className={cn(
                                    'text-2xl font-bold font-mono',
                                    riskLabel === 'CRIT' ? 'text-risk-high' :
                                    riskLabel === 'HIGH' ? 'text-amber-500' :
                                    riskLabel === 'MED'  ? 'text-yellow-500' :
                                    'text-slate-400',
                                )}>
                                    {loadingGraph ? '\u2014' : riskLabel}
                                </span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-xl p-4 flex flex-col min-w-[110px] shadow-sm">
                                <span className="text-[9px] font-mono uppercase text-slate-400 tracking-widest mb-1">Relations</span>
                                <span className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                                    {loadingGraph ? '\u2014' : (graphData?.edgeCount ?? 0)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* STIX coordinate line */}
                    {selectedEntity && (
                        <p className="text-[10px] font-mono tracking-wide text-slate-400 dark:text-slate-500">
                            STIX_ID: {selectedEntity.stixId} // ENTITY_EXPLORER_TIMELINE // DEPTH:{graphDepth}
                        </p>
                    )}
                </div>

                {/* ───── Error ───── */}
                {error && (
                    <div className="mb-6 p-4 bg-risk-high/10 border border-risk-high/20 rounded-xl flex items-center gap-3 text-risk-high text-sm">
                        <AlertCircle size={16} />
                        <span className="font-mono">{error}</span>
                    </div>
                )}

                {/* ───── Timeline Panel ───── */}
                <div className="relative border border-border-light dark:border-border-dark rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm mb-8">

                    {/* Loading overlay */}
                    {loadingGraph && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                            <Loader2 className="animate-spin text-primary mb-3" size={36} />
                            <span className="text-xs font-mono uppercase text-slate-400 tracking-widest">Loading Timeline...</span>
                        </div>
                    )}

                    {/* No entity selected */}
                    {!loadingGraph && !selectedEntityId && (
                        <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600">
                            <Clock size={48} className="mb-4 opacity-40" />
                            <p className="text-sm font-mono">Select an entity to explore its timeline</p>
                        </div>
                    )}

                    {/* Empty graph */}
                    {!loadingGraph && selectedEntityId && graphEntities.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600">
                            <Info size={48} className="mb-4 opacity-40" />
                            <p className="text-sm font-mono">No connected entities found at depth {graphDepth}</p>
                            <p className="text-xs font-mono mt-1 opacity-60">Try increasing the depth level</p>
                        </div>
                    )}

                    {/* Timeline content */}
                    {!loadingGraph && graphEntities.length > 0 && (
                        <div className="flex">
                            {/* Lane Labels (sticky left) */}
                            <div className="w-20 flex-shrink-0 flex flex-col z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-border-light dark:border-border-dark">
                                <div className="flex-1 flex items-center justify-center border-b border-border-light dark:border-border-dark py-6">
                                    <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold font-mono uppercase tracking-[0.35em] text-amber-500 dark:text-amber-400 flex items-center justify-center">
                                        <Globe size={14} className="mb-2 rotate-90" />
                                        <span className="bg-amber-50 dark:bg-amber-950/40 px-1 py-3 rounded">Geopolitical</span>
                                    </div>
                                </div>
                                <div className="flex-1 flex items-center justify-center py-6">
                                    <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold font-mono uppercase tracking-[0.35em] text-cyan-500 dark:text-cyan-400 flex items-center justify-center">
                                        <Shield size={14} className="mb-2 rotate-90" />
                                        <span className="bg-cyan-50 dark:bg-cyan-950/40 px-1 py-3 rounded">Cyber</span>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Timeline */}
                            <div
                                className="flex-1 overflow-x-auto overflow-y-hidden"
                                style={{ maskImage: 'linear-gradient(to right, transparent, black 4%, black 96%, transparent)' }}
                                ref={timelineRef}
                            >
                                <div
                                    className="relative"
                                    style={{ width: `${scaledWidth}px`, height: '600px', transition: 'width 0.3s ease' }}
                                >
                                    {/* Central axis */}
                                    <div
                                        className="absolute left-0 right-0 bg-slate-300 dark:bg-slate-600"
                                        style={{ top: '50%', height: '2px', transform: 'translateY(-50%)', zIndex: 10 }}
                                    >
                                        {dateMarkers.map((date, i) => {
                                            const pct = (i / (dateMarkers.length - 1)) * 100;
                                            return (
                                                <div
                                                    key={i}
                                                    className="absolute flex flex-col items-center"
                                                    style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
                                                >
                                                    <div className="h-4 w-0.5 bg-slate-400 dark:bg-slate-500 mt-[-6px]" />
                                                    <span className="mt-2 text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded shadow-sm border border-border-light dark:border-border-dark whitespace-nowrap">
                                                        {formatDateLabel(date)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* TOP LANE (Geo) */}
                                    <div className="absolute left-0 right-0 flex items-end" style={{ top: 0, height: '50%', paddingBottom: '60px' }}>
                                        {geoEntities.map((entity, i) => {
                                            const date = getEntityDate(entity);
                                            const x = dateToX(date, scaledWidth);
                                            const offset = i % 2 === 0 ? 0 : 40;
                                            return (
                                                <div
                                                    key={entity.stixId}
                                                    className="absolute flex flex-col items-center"
                                                    style={{ left: `${x}px`, transform: 'translateX(-50%)', bottom: 0 }}
                                                >
                                                    <div style={{ marginBottom: `${offset + 64}px` }}>
                                                        <TimelineCard entity={entity} />
                                                    </div>
                                                    <div
                                                        className="w-0.5"
                                                        style={{
                                                            height: `${offset + 64}px`,
                                                            background: `linear-gradient(to top, ${TYPE_COLOR[entity.type]?.connector || '#64748b'}60, ${TYPE_COLOR[entity.type]?.connector || '#64748b'}20)`,
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* BOTTOM LANE (Cyber) */}
                                    <div className="absolute left-0 right-0 flex items-start" style={{ top: '50%', height: '50%', paddingTop: '60px' }}>
                                        {cyberEntities.map((entity, i) => {
                                            const date = getEntityDate(entity);
                                            const x = dateToX(date, scaledWidth);
                                            const offset = i % 2 === 0 ? 0 : 40;
                                            return (
                                                <div
                                                    key={entity.stixId}
                                                    className="absolute flex flex-col items-center"
                                                    style={{ left: `${x}px`, transform: 'translateX(-50%)', top: 0 }}
                                                >
                                                    <div
                                                        className="w-0.5"
                                                        style={{
                                                            height: `${offset + 64}px`,
                                                            background: `linear-gradient(to bottom, ${TYPE_COLOR[entity.type]?.connector || '#64748b'}60, ${TYPE_COLOR[entity.type]?.connector || '#64748b'}20)`,
                                                        }}
                                                    />
                                                    <div style={{ marginTop: `${offset}px` }}>
                                                        <TimelineCard entity={entity} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* SVG correlation overlay */}
                                    {correlationLines.length > 0 && (
                                        <svg
                                            className="absolute inset-0 pointer-events-none"
                                            style={{ width: '100%', height: '100%', opacity: 0.25, zIndex: 5 }}
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            {correlationLines.map((line, i) => (
                                                <path
                                                    key={i}
                                                    d={`M ${line.x1} ${300 - 120} Q ${(line.x1 + line.x2) / 2} 300 ${line.x2} ${300 + 120}`}
                                                    fill="none"
                                                    stroke={line.color}
                                                    strokeDasharray="6 5"
                                                    strokeWidth="2"
                                                />
                                            ))}
                                        </svg>
                                    )}
                                </div>
                            </div>

                            {/* Zoom controls */}
                            <div className="w-10 flex-shrink-0 flex flex-col items-center justify-center gap-2 border-l border-border-light dark:border-border-dark bg-white/95 dark:bg-slate-900/95 py-4">
                                <button
                                    onClick={handleZoomIn}
                                    disabled={zoom >= 2}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-30"
                                    title="Zoom in"
                                >
                                    <ZoomIn size={15} />
                                </button>
                                <span className="text-[9px] font-mono text-slate-400">{Math.round(zoom * 100)}%</span>
                                <button
                                    onClick={handleZoomOut}
                                    disabled={zoom <= 0.5}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-30"
                                    title="Zoom out"
                                >
                                    <ZoomOut size={15} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ───── Bottom Grid ───── */}
                {!loadingGraph && graphEntities.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Correlation Matrix */}
                        <div className="bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-2xl p-6 shadow-sm">
                            <h5 className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 mb-5 flex items-center gap-2">
                                <Activity size={12} />
                                Correlation Matrix
                            </h5>
                            {correlationData.length === 0 ? (
                                <p className="text-xs text-slate-400 font-mono text-center py-6">No correlation data available</p>
                            ) : (
                                <div className="space-y-4">
                                    {correlationData.map(({ label, value }) => {
                                        const pct = Math.min(100, Math.max(0, value * 10));
                                        const barColor = pct >= 70 ? 'bg-primary' : pct >= 40 ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600';
                                        const txtColor = pct >= 70 ? 'text-primary' : pct >= 40 ? 'text-amber-500' : 'text-slate-400';
                                        return (
                                            <div key={label}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate pr-2">{label}</span>
                                                    <span className={cn('text-[10px] font-mono flex-shrink-0', txtColor)}>
                                                        {value.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                    <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Activity Log */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-5">
                                <h5 className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                    <Clock size={12} />
                                    Activity Log
                                </h5>
                                <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-border-light dark:border-border-dark">
                                    {graphRelations.length} relations
                                </span>
                            </div>
                            {graphRelations.length === 0 ? (
                                <p className="text-xs text-slate-400 font-mono text-center py-6">No relations detected at this depth</p>
                            ) : (
                                <div className="space-y-0 max-h-48 overflow-y-auto pr-1">
                                    {graphRelations.slice(0, 20).map((rel, i) => (
                                        <ActivityLogRow key={rel.id} relation={rel} entities={graphEntities} index={i} />
                                    ))}
                                    {graphRelations.length > 20 && (
                                        <p className="text-[10px] font-mono text-slate-400 text-center pt-2">
                                            + {graphRelations.length - 20} more relations...
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ───── Floating Legend ───── */}
            <div className="fixed bottom-6 right-6 flex flex-col gap-2 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-xl border border-border-light dark:border-border-dark z-50">
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400 mb-1">Legend</p>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-sm bg-amber-400" />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Geopolitical</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-sm bg-primary" />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Cyber</span>
                </div>
                <div className="mt-2 pt-2 border-t border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3">
                        <svg width="16" height="8" className="flex-shrink-0">
                            <line x1="0" y1="4" x2="16" y2="4" stroke="#06b6d4" strokeDasharray="4 3" strokeWidth="2" />
                        </svg>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">Correlation</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EntityExplorerTimeline;
