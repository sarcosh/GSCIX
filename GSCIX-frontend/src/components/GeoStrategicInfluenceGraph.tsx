import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    X, Download, Zap,
    Globe, Flag, Megaphone, Bug, Plus, Minus,
    Maximize2, RefreshCw, AlertTriangle, ExternalLink,
    Share2, Activity, ChevronLeft, Layers, Users
} from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { cn } from '../lib/utils';
import apiService from '../services/api';
import type { GscixEntity, GscixRelation, HpiAnalytics } from '../types/api';

// --- Type map for node styling ---
const NODE_CONFIG: Record<string, { color: string; border: string; path: string; label: string }> = {
    'x-geo-strategic-actor': { color: '#06b6d4', border: '#0891b2', path: 'M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z', label: 'Geo-Strategic Actor' },
    'x-strategic-objective': { color: '#f59e0b', border: '#d97706', path: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7', label: 'Strategic Objective' },
    'x-hybrid-campaign': { color: '#ef4444', border: '#dc2626', path: 'm3 11 18-5v12L3 14v-3z M11.6 16.8a3 3 0 1 1-5.8-1.6', label: 'Hybrid Campaign' },
    'x-influence-vector': { color: '#8b5cf6', border: '#7c3aed', path: 'M4.9 19.1C1 15.2 1 8.8 4.9 4.9 M19.1 4.9c3.9 3.9 3.9 10.2 0 14.1 M8.5 15.5c-1.9-1.9-1.9-5.1 0-7 M15.5 8.5c1.9 1.9 1.9 5.1 0 7 M12 12h.01', label: 'Influence Vector' },
    'x-strategic-impact': { color: '#6366f1', border: '#4f46e5', path: 'M12 3v18 M3 7h18 M3 7l-2 9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2z M15 7l-2 9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2z', label: 'Strategic Impact' },
    'x-strategic-assessment': { color: '#10b981', border: '#059669', path: 'M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3', label: 'Strategic Assessment' },
    'intrusion-set': { color: '#64748b', border: '#475569', path: 'M12 2L2 7l10 5l10-5L12 2z M2 17l10 5l10-5 M2 12l10 5l10-5', label: 'Intrusion Set' },
    'threat-actor': { color: '#94a3b8', border: '#64748b', path: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 7a4 4 0 1 0 0-8a4 4 0 0 0 0 8z', label: 'Threat Actor' },
};

const LAYER_FILTERS = [
    { key: 'x-geo-strategic-actor', label: 'Geo-Strategic Actors', icon: Globe, color: 'text-cyan-500 bg-cyan-500/10' },
    { key: 'x-strategic-objective', label: 'Strategic Objectives', icon: Flag, color: 'text-amber-500 bg-amber-500/10' },
    { key: 'x-hybrid-campaign', label: 'Hybrid Campaigns', icon: Megaphone, color: 'text-red-500 bg-red-500/10' },
    { key: 'x-influence-vector', label: 'Influence Vectors', icon: Share2, color: 'text-purple-500 bg-purple-500/10' },
    { key: 'x-strategic-impact', label: 'Strategic Impacts', icon: Activity, color: 'text-indigo-500 bg-indigo-500/10' },
    { key: 'x-strategic-assessment', label: 'Assessments', icon: Zap, color: 'text-emerald-500 bg-emerald-500/10' },
    { key: 'intrusion-set', label: 'Intrusion Sets', icon: Layers, color: 'text-slate-500 bg-slate-500/10' },
    { key: 'threat-actor', label: 'Threat Actors', icon: Users, color: 'text-slate-400 bg-slate-400/10' },
];

interface InfluenceGraphProps {
    initialActorId?: string;
}

export const GeoStrategicInfluenceGraph: React.FC<InfluenceGraphProps> = ({ initialActorId }) => {
    const [entities, setEntities] = useState<GscixEntity[]>([]);
    const [relations, setRelations] = useState<GscixRelation[]>([]);
    const [loading, setLoading] = useState(true);
    const [rootActor, setRootActor] = useState<GscixEntity | null>(null);
    const [selectedAnalytics, setSelectedAnalytics] = useState<HpiAnalytics | null>(null);
    const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
    const [panelVisible, setPanelVisible] = useState(true);
    const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
        'x-geo-strategic-actor': true,
        'x-strategic-objective': true,
        'x-hybrid-campaign': true,
        'x-strategic-assessment': true,
        'x-influence-vector': true,
        'x-strategic-impact': true,
        'intrusion-set': true,
        'threat-actor': true,
    });
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [openctiBaseUrl, setOpenctiBaseUrl] = useState<string>('');
    const graphRef = useRef<any>(null);
    const initialZoomDone = useRef(false);
    const d3ForcesConfigured = useRef(false);

    // Fetch subgraph from backend
    const fetchGraph = useCallback(async (rootId?: string) => {
        if (!rootId) {
            setEntities([]);
            setRelations([]);
            setRootActor(null);
            setHighlightedConnectionId(null);
            setPanelVisible(true);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            console.log('Fetching graph for rootId:', rootId);
            const data = await apiService.getInfluenceGraph(rootId, 2);
            console.log('Graph data received:', data);
            setEntities(data.entities);
            setRelations(data.relations);

            // Auto-select root actor and init date range
            if (rootId) {
                const actor = data.entities.find(e => e.stixId === rootId);
                if (actor) {
                    setRootActor(actor);
                    setPanelVisible(true);
                    fetchAnalytics(actor);
                    
                    // Reset flags for new actor so initial zoomToFit + force config run once
                    initialZoomDone.current = false;
                    d3ForcesConfigured.current = false;

                    // Initialize date range: From = actor's first_seen (root or gsci), To = Today
                    const today = new Date().toISOString().split('T')[0];
                    const firstSeen = actor.first_seen || actor.gsciAttributes?.first_seen;
                    
                    const fromDate = firstSeen ? firstSeen.split('T')[0] : today;
                    setDateRange({ from: fromDate, to: today });
                }
            }
        } catch (err) {
            console.error('Failed to fetch graph data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGraph(initialActorId);
    }, [initialActorId, fetchGraph]);

    // Fetch OpenCTI base URL once on mount
    useEffect(() => {
        apiService.getOpenctiUrl()
            .then(url => setOpenctiBaseUrl(url.replace(/\/$/, '')))
            .catch(() => setOpenctiBaseUrl(''));
    }, []);

    const fetchAnalytics = async (entity: GscixEntity) => {
        if (entity.type !== 'x-geo-strategic-actor') {
            setSelectedAnalytics(null);
            return;
        }
        try {
            const data = await apiService.getActorAnalytics(entity.stixId);
            setSelectedAnalytics(data);
        } catch {
            setSelectedAnalytics(null);
        }
    };

    // When clicking a node: toggle highlight on its pill in the sidebar.
    // The root actor header + Strategic Metrics always stay visible.
    const handleNodeClick = useCallback((node: any) => {
        if (!node.entity) return;
        const entity = node.entity as GscixEntity;

        // Ensure the panel is visible
        setPanelVisible(true);

        // Toggle highlight: click same node again → deselect
        const newId = highlightedConnectionId === entity.stixId ? null : entity.stixId;
        setHighlightedConnectionId(newId);

        if (newId) {
            setTimeout(() => {
                document.getElementById(`conn-${entity.stixId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    }, [highlightedConnectionId]);

    // Build visual graph data from the backend-provided entities/relations + client layer filters
    const graphData = useMemo(() => {
        // Step 1: Preliminary filter (Layers + Dates). Root actor is NEVER filtered locally.
        const candidateEntities = entities.filter(e => {
            if (e.stixId === initialActorId) return true;
            // If the type has an explicit toggle, respect it; unknown types default to visible
            if (activeLayers[e.type] !== undefined && !activeLayers[e.type]) return false;

            if (dateRange.from || dateRange.to) {
                const fsStr = e.first_seen || e.gsciAttributes?.first_seen;
                const lsStr = e.last_seen || e.gsciAttributes?.last_seen;

                const firstSeen = fsStr ? new Date(fsStr) : null;
                const lastSeen = lsStr ? new Date(lsStr) : (firstSeen || null);

                if (dateRange.from) {
                    const fromDate = new Date(dateRange.from);
                    if (lastSeen && lastSeen < fromDate) return false;
                }
                if (dateRange.to) {
                    const toDate = new Date(dateRange.to);
                    if (firstSeen && firstSeen > toDate) return false;
                }
            }
            return true;
        });

        const candidateIds = new Set(candidateEntities.map(e => e.stixId));
        const reachableIds = new Set<string>();
        if (initialActorId && candidateIds.has(initialActorId)) {
            reachableIds.add(initialActorId);

            // Step 2: Recursive Connectivity (BFS)
            // We only show items that have a connection path to the root
            let currentNodes = [initialActorId];
            
            while (currentNodes.length > 0) {
                const nextNodes: string[] = [];
                for (const nodeId of currentNodes) {
                    const neighbors = relations
                        .filter(r => r.source_ref === nodeId || r.target_ref === nodeId)
                        .map(r => r.source_ref === nodeId ? r.target_ref : r.source_ref);
                    
                    for (const neighborId of neighbors) {
                        if (candidateIds.has(neighborId) && !reachableIds.has(neighborId)) {
                            reachableIds.add(neighborId);
                            nextNodes.push(neighborId);
                        }
                    }
                }
                currentNodes = nextNodes;
            }
        }

        // Step 3: Final assembly
        const finalEntities = entities.filter(e => reachableIds.has(e.stixId));
        const nodes = finalEntities.map(e => ({
            id: e.stixId,
            name: e.name,
            type: e.type,
            val: e.type === 'x-geo-strategic-actor' ? 20 : e.type === 'x-strategic-objective' ? 12 : 8,
            entity: e,
        }));

        const links = relations
            .filter(r => reachableIds.has(r.source_ref) && reachableIds.has(r.target_ref))
            .map(r => ({
                source: r.source_ref,
                target: r.target_ref,
                relType: r.relationship_type,
            }));

        return { nodes, links };
    }, [entities, relations, activeLayers, dateRange, initialActorId]);

    // Use a ref so paintNode doesn't need rootActor in its dependency array (avoids graph re-init)
    const rootActorRef = useRef<GscixEntity | null>(null);
    useEffect(() => { rootActorRef.current = rootActor; }, [rootActor]);

    const highlightedConnectionIdRef = useRef<string | null>(null);
    useEffect(() => { highlightedConnectionIdRef.current = highlightedConnectionId; }, [highlightedConnectionId]);

    // Canvas node renderer — stable callback (no rootActor dependency, uses refs)
    const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        // Defensive check for non-finite coordinates (avoids createRadialGradient crash)
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;

        const cfg = NODE_CONFIG[node.type] || { color: '#64748b', border: '#475569', path: '', label: 'Unknown' };

        const r = 12;

        const isHighlighted = highlightedConnectionIdRef.current === node.id;
        const isSelected = rootActorRef.current?.stixId === node.id;

        // Outer glow
        if (isSelected || isHighlighted) {
            const glowColor = cfg.color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 8, 0, 2 * Math.PI);
            ctx.fillStyle = glowColor + '30';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
            ctx.fillStyle = glowColor + '15';
            ctx.fill();
        }

        // Main circle node background
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = '#0f172a'; // Deep slate background for nodes
        ctx.fill();

        // Soft glowing inner fill
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
        gradient.addColorStop(0, cfg.color + '40');
        gradient.addColorStop(1, cfg.color + '10');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Outline stroke — always uses the node's own color
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw Icon Path (centered)
        if (cfg.path) {
            const boxSize = r * 1.1; // Size of the icon bounding box inside circle
            const scale = boxSize / 24; // Lucide icons are 24x24

            ctx.save();
            ctx.translate(node.x - boxSize / 2, node.y - boxSize / 2);
            ctx.scale(scale, scale);

            ctx.lineWidth = 1.6 / scale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#ffffff'; // Crisp white icon

            const p2d = new Path2D(cfg.path);
            ctx.stroke(p2d);

            ctx.restore();
        }


        // Label below — white text with dark outline for readability
        if (globalScale > 0.4) {
            const label = node.name.length > 25 ? node.name.substring(0, 23) + '…' : node.name;
            const labelFontSize = Math.max(4, 11 / globalScale);
            ctx.font = `600 ${labelFontSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const labelY = node.y + r + 6;

            // Dark outline for contrast
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.lineWidth = 3 / globalScale;
            ctx.lineJoin = 'round';
            ctx.strokeText(label, node.x, labelY);

            // White text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, node.x, labelY);
        }
    }, []);

    // One-time zoomToFit after initial actor load.
    // Uses a timeout to let the simulation settle, then fits once.
    const initialZoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!initialZoomDone.current && graphData.nodes.length > 0 && graphRef.current) {
            // Clear any pending timer (e.g. if graphData updated rapidly)
            if (initialZoomTimer.current) clearTimeout(initialZoomTimer.current);
            initialZoomTimer.current = setTimeout(() => {
                if (graphRef.current && !initialZoomDone.current) {
                    graphRef.current.zoomToFit(400, 80);
                    initialZoomDone.current = true;
                }
            }, 800); // Wait for simulation to settle
        }
        return () => {
            if (initialZoomTimer.current) clearTimeout(initialZoomTimer.current);
        };
    }, [graphData]);

    // Configure d3 forces ONCE per actor load.
    useEffect(() => {
        if (graphRef.current && !d3ForcesConfigured.current) {
            graphRef.current.d3Force('link')?.distance(120);
            graphRef.current.d3Force('charge')?.strength(-350).distanceMax(500);
            graphRef.current.d3Force('center')?.strength(0.05);
            d3ForcesConfigured.current = true;
        }
    }, [graphData]);

    // When graphData changes due to filters (not a new actor load), preserve the
    // current zoom & pan so the user sees no visual jump.
    const savedZoom = useRef<number | null>(null);
    const savedCenter = useRef<{ x: number; y: number } | null>(null);

    // Snapshot zoom/center BEFORE the graphData useMemo runs (i.e. when filters change).
    // We capture this on every render where initialZoomDone is true.
    useEffect(() => {
        if (initialZoomDone.current && graphRef.current) {
            savedZoom.current = graphRef.current.zoom();
            savedCenter.current = graphRef.current.centerAt();
        }
    });

    // After graphData changes from a filter, restore saved zoom/center and pin nodes.
    useEffect(() => {
        if (!initialZoomDone.current || !graphRef.current) return;
        if (savedZoom.current === null || savedCenter.current === null) return;

        const z = savedZoom.current;
        const c = savedCenter.current;

        // Pin nodes to their current positions so reheat doesn't scatter them
        graphData.nodes.forEach((n: any) => {
            if (Number.isFinite(n.x) && Number.isFinite(n.y)) {
                n.fx = n.x;
                n.fy = n.y;
            }
        });

        // Restore zoom & center instantly
        graphRef.current.zoom(z, 0);
        graphRef.current.centerAt(c.x, c.y, 0);

        // Unpin nodes after the simulation has processed the change
        const timer = setTimeout(() => {
            graphData.nodes.forEach((n: any) => {
                n.fx = undefined;
                n.fy = undefined;
            });
        }, 100);

        return () => clearTimeout(timer);
    }, [graphData]);

    const toggleLayer = (key: string) => {
        setActiveLayers(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const nodeCount = graphData.nodes.length;
    const edgeCount = graphData.links.length;

    if (!initialActorId && entities.length === 0 && !loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-[calc(100vh-64px)] w-full bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 flex flex-col items-center max-w-sm text-center border border-slate-100 dark:border-slate-700">
                    <Globe size={48} className="text-cyan-500 mb-4 opacity-80" strokeWidth={1.5} />
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 tracking-tight">Geo-Strategic Graph</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                        Visualize multi-domain hybrid campaigns, infrastructure, and objectives.
                    </p>
                    <div className="bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 text-xs px-4 py-2.5 rounded-lg border border-cyan-100 dark:border-cyan-500/20 font-medium w-full shadow-inner">
                        Select an actor in the Explorer to begin.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-64px)] flex overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* ── Left Sidebar ── */}
            <aside className="w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.08)]">
                {/* Graph Layers */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Graph Layers</h3>
                        <button
                            onClick={() => setActiveLayers({
                                'x-geo-strategic-actor': true,
                                'x-strategic-objective': true,
                                'x-hybrid-campaign': true,
                                'x-strategic-assessment': true,
                                'x-influence-vector': true,
                                'x-strategic-impact': true,
                                'intrusion-set': true,
                                'threat-actor': true,
                            })}
                            className="text-[10px] text-cyan-500 hover:underline font-medium"
                        >
                            Reset
                        </button>
                    </div>
                    <div className="space-y-2">
                        {LAYER_FILTERS.map(layer => (
                            <label key={layer.key} className="flex items-center justify-between group cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-8 h-8 rounded-md flex items-center justify-center", layer.color)}>
                                        <layer.icon size={16} />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{layer.label}</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={activeLayers[layer.key] ?? false}
                                    onChange={() => toggleLayer(layer.key)}
                                    className="rounded text-cyan-500 border-slate-300 focus:ring-cyan-500 h-4 w-4"
                                />
                            </label>
                        ))}
                    </div>
                </div>
                {/* Temporal Filters */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Temporal Filters</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">From</label>
                            <input
                                type="date"
                                value={dateRange.from}
                                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-cyan-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">To</label>
                            <input
                                type="date"
                                value={dateRange.to}
                                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-cyan-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={() => {
                                const today = new Date().toISOString().split('T')[0];
                                const firstSeen = rootActor?.first_seen || rootActor?.gsciAttributes?.first_seen;
                                const from = firstSeen ? firstSeen.split('T')[0] : today;
                                setDateRange({ from, to: today });
                            }}
                            className="text-[10px] text-cyan-500 hover:underline font-medium w-full text-center"
                        >
                            Clear Dates
                        </button>
                    </div>
                </div>

                {/* HPI Alert (bottom) */}
                <div className="p-4 mt-auto">
                    {rootActor && selectedAnalytics && selectedAnalytics.spike_detected && (
                        <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-lg border border-amber-200 dark:border-amber-500/30 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="bg-white dark:bg-slate-800 p-1 rounded-full shadow-sm">
                                    <AlertTriangle className="text-amber-500" size={14} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">HPI Alert: High</p>
                                    <p className="text-[11px] text-amber-700 dark:text-amber-500/80 leading-snug">
                                        Hybrid Pressure Index spike detected for <span className="font-bold underline decoration-amber-400/50">{rootActor.name}</span>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* ── Central Graph Canvas ── */}
            <div className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-slate-950 cursor-move"
                style={{
                    backgroundImage: 'linear-gradient(rgba(148,163,184,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}>

                {/* Zoom controls */}
                <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
                    <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex flex-col gap-1">
                        <button onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.3, 300)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-cyan-500 transition-colors text-slate-500" title="Zoom In">
                            <Plus size={18} />
                        </button>
                        <div className="h-px w-full bg-slate-100 dark:bg-slate-700"></div>
                        <button onClick={() => graphRef.current?.zoom(graphRef.current.zoom() / 1.3, 300)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-cyan-500 transition-colors text-slate-500" title="Zoom Out">
                            <Minus size={18} />
                        </button>
                        <div className="h-px w-full bg-slate-100 dark:bg-slate-700"></div>
                        <button onClick={() => graphRef.current?.zoomToFit(400, 80)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-cyan-500 transition-colors text-slate-500" title="Fit to Screen">
                            <Maximize2 size={18} />
                        </button>
                    </div>
                </div>

                <div className="absolute inset-0 z-0">
                    <ForceGraph2D
                        ref={graphRef}
                        graphData={graphData}
                        nodeCanvasObject={paintNode}
                        onNodeClick={handleNodeClick}
                        linkColor={() => 'rgba(148,163,184,0.4)'}
                        linkWidth={1.8}
                        linkDirectionalArrowLength={7}
                        linkDirectionalArrowRelPos={0.85}
                        linkDirectionalArrowColor={() => 'rgba(148,163,184,0.6)'}
                        linkLineDash={[4, 2]}
                        linkCanvasObjectMode={() => 'after'}
                        linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                            if (globalScale < 0.4) return; // Same threshold as node labels
                            const label = link.relType;
                            if (!label) return;

                            const source = link.source;
                            const target = link.target;
                            if (!source || !target) return;
                            if (!Number.isFinite(source.x) || !Number.isFinite(target.x)) return;

                            const midX = (source.x + target.x) / 2;
                            const midY = (source.y + target.y) / 2;

                            // Same font size as node labels
                            const fontSize = Math.max(4, 11 / globalScale);
                            ctx.font = `500 ${fontSize}px Inter, sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';

                            const textWidth = ctx.measureText(label).width;
                            const padX = 4 / globalScale;
                            const padY = 2.5 / globalScale;
                            const boxX = midX - textWidth / 2 - padX;
                            const boxY = midY - fontSize / 2 - padY;
                            const boxW = textWidth + padX * 2;
                            const boxH = fontSize + padY * 2;
                            const borderRadius = 3 / globalScale;

                            // Rounded rectangle background
                            ctx.beginPath();
                            ctx.roundRect(boxX, boxY, boxW, boxH, borderRadius);
                            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                            ctx.fill();
                            ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
                            ctx.lineWidth = 1 / globalScale;
                            ctx.stroke();

                            // Text
                            ctx.fillStyle = 'rgba(203, 213, 225, 0.95)';
                            ctx.fillText(label, midX, midY);
                        }}
                        enableNodeDrag={true}
                        enableZoomInteraction={false}
                        enablePanInteraction={true}
                        cooldownTicks={200}
                        warmupTicks={50}
                        backgroundColor="rgba(0,0,0,0)"
                        nodeRelSize={6}
                        d3AlphaDecay={0.02}
                        d3VelocityDecay={0.3}
                    />
                </div>

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm z-10 transition-all">
                        <div className="text-center">
                            <RefreshCw className="animate-spin text-cyan-500 mx-auto mb-3" size={32} />
                            <p className="text-sm text-slate-500 font-medium">Loading influence graph...</p>
                        </div>
                    </div>
                )}

                {/* Status bar */}
                <div className="absolute bottom-6 left-6 z-10 flex gap-3">
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-md flex items-center gap-3">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                        </span>
                        <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
                            Live Stream: <span className="text-cyan-500">Active</span>
                        </span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-md flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
                            Nodes: {nodeCount} | Edges: {edgeCount}
                        </span>
                    </div>
                </div>

                {/* Sidebar Recovery Button (visible when panel is hidden) */}
                {!panelVisible && rootActor && (
                    <div className="absolute top-1/2 -right-1 -translate-y-1/2 z-10">
                        <button
                            onClick={() => setPanelVisible(true)}
                            className="flex items-center justify-center w-8 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-l-xl shadow-lg text-slate-400 hover:text-cyan-500 transition-all group"
                            title="Restore Details Panel"
                        >
                            <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                )}
            </div>

            {/* ── Right Detail Panel ── */}
            {panelVisible && rootActor && (
                <aside className="w-96 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-20 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.08)] overflow-y-auto shrink-0 [scrollbar-gutter:stable]">
                    {/* Header — always shows the root Geo-Strategic Actor */}
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-500 border border-cyan-500/20 px-2 py-0.5 rounded-full bg-cyan-500/5">
                                {NODE_CONFIG[rootActor.type]?.label || rootActor.type}
                            </span>
                            <button onClick={() => setPanelVisible(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-slate-900 shadow-sm border border-slate-700 flex items-center justify-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d={NODE_CONFIG[rootActor.type]?.path || 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'} />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{rootActor.name}</h2>
                                <p className="text-xs text-slate-500 font-mono">{rootActor.stixId?.substring(0, 24)}...</p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-3 flex-wrap">
                            {rootActor.gsciAttributes?.revisionist_index !== undefined && (rootActor.gsciAttributes.revisionist_index > 7) && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20">
                                    High Revisionist
                                </span>
                            )}
                            {rootActor.gsciAttributes?.strategic_alignment && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                                    {rootActor.gsciAttributes.strategic_alignment}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Body Content */}
                    <div className="flex-1 p-6 space-y-8">
                        {/* Strategic Metrics — always visible for the root actor */}
                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                Strategic Metrics
                            </h3>
                            <div className="space-y-5">
                                {/* Revisionist Index */}
                                <div>
                                    <div className="flex justify-between items-end mb-1.5">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Revisionist Index</span>
                                        <span className={cn(
                                            "text-sm font-mono font-bold px-1.5 rounded",
                                            (rootActor.gsciAttributes?.revisionist_index || 0) > 7 ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10" :
                                                (rootActor.gsciAttributes?.revisionist_index || 0) > 4 ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10" :
                                                    "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                                        )}>
                                            {(rootActor.gsciAttributes?.revisionist_index || 0).toFixed(1)}/10
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-orange-400 to-red-500 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, (rootActor.gsciAttributes?.revisionist_index || 0) * 10)}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Doctrine-Capacity Divergence */}
                                {selectedAnalytics && (
                                    <div>
                                        <div className="flex justify-between items-end mb-1.5">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Doctrine-Capacity Divergence</span>
                                            <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 rounded">
                                                {selectedAnalytics.max_divergence_score?.toFixed(1) || '0.0'}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                            <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (selectedAnalytics.max_divergence_score || 0) * 10)}%` }}></div>
                                        </div>
                                    </div>
                                )}

                                {/* Strategic Ambiguity */}
                                <div>
                                    <div className="flex justify-between items-end mb-1.5">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Strategic Ambiguity</span>
                                        <span className={cn(
                                            "text-sm font-mono font-bold px-1.5 rounded",
                                            (rootActor.gsciAttributes?.strategic_ambiguity_score || 0) > 7 ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10" :
                                                (rootActor.gsciAttributes?.strategic_ambiguity_score || 0) > 4 ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10" :
                                                    "text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-500/10"
                                        )}>
                                            {(rootActor.gsciAttributes?.strategic_ambiguity_score || 0) > 7 ? 'High' :
                                                (rootActor.gsciAttributes?.strategic_ambiguity_score || 0) > 4 ? 'Medium' : 'Low'}
                                        </span>
                                    </div>
                                    <div className="flex gap-1 mt-1">
                                        <div className={cn("h-2 w-full rounded-sm", (rootActor.gsciAttributes?.strategic_ambiguity_score || 0) >= 1 ? "bg-cyan-500" : "bg-slate-200 dark:bg-slate-700")}></div>
                                        <div className={cn("h-2 w-full rounded-sm", (rootActor.gsciAttributes?.strategic_ambiguity_score || 0) >= 4 ? "bg-cyan-500" : "bg-slate-200 dark:bg-slate-700")}></div>
                                        <div className={cn("h-2 w-full rounded-sm", (rootActor.gsciAttributes?.strategic_ambiguity_score || 0) >= 7 ? "bg-cyan-500" : "bg-slate-200 dark:bg-slate-700")}></div>
                                    </div>
                                </div>

                                {/* HPI */}
                                {selectedAnalytics && selectedAnalytics.current_hpi !== undefined && (
                                    <div>
                                        <div className="flex justify-between items-end mb-1.5">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Hybrid Pressure Index</span>
                                            <span className={cn(
                                                "text-sm font-mono font-bold px-1.5 rounded",
                                                selectedAnalytics.current_hpi > 7 ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10" :
                                                    selectedAnalytics.current_hpi > 4 ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10" :
                                                        "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10"
                                            )}>
                                                {(selectedAnalytics.current_hpi || 0).toFixed(1)}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-500",
                                                    selectedAnalytics.current_hpi > 7 ? "bg-gradient-to-r from-orange-400 to-red-500" :
                                                        selectedAnalytics.current_hpi > 4 ? "bg-gradient-to-r from-yellow-400 to-amber-500" :
                                                            "bg-gradient-to-r from-emerald-400 to-cyan-500"
                                                )}
                                                style={{ width: `${Math.min(100, (selectedAnalytics.current_hpi || 0) * 10)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tactical Linkage (OpenCTI) */}
                        {rootActor.metadata?.openctiInternalId && (
                            <div>
                                <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    Tactical Linkage (OpenCTI)
                                </h3>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 text-sm border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <Bug className="text-slate-400" size={16} />
                                            <span className="font-bold text-slate-800 dark:text-white">{rootActor.name}</span>
                                        </div>
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded font-mono">Linked</span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                                        {rootActor.description || 'Linked threat actor from OpenCTI platform.'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700">
                                            <span className="block text-[10px] text-slate-400 mb-0.5">Source</span>
                                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">OpenCTI</span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700">
                                            <span className="block text-[10px] text-slate-400 mb-0.5">Last Seen</span>
                                            <span className="font-mono text-slate-700 dark:text-slate-300">
                                                {rootActor.gsciAttributes?.last_seen ? new Date(rootActor.gsciAttributes.last_seen).toLocaleDateString() : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                    <button className="w-full py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-cyan-500 hover:text-cyan-500 rounded-md text-slate-600 dark:text-slate-400 transition-all shadow-sm flex items-center justify-center gap-1">
                                        View in OpenCTI <ExternalLink size={12} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Graph Elements — pills with expandable details for each entity */}
                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span>Graph Elements</span>
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{graphData.nodes.length}</span>
                            </h3>
                            <ul className="space-y-2">
                                {graphData.nodes
                                    .map((n: any) => {
                                        const nodeEntity = n.entity as GscixEntity;
                                        const isHighlighted = highlightedConnectionId === n.id;

                                        return (
                                            <li key={n.id}
                                                id={`conn-${n.id}`}
                                                className={cn(
                                                    "flex flex-col rounded-lg border transition-all duration-300 cursor-pointer overflow-hidden",
                                                    isHighlighted
                                                        ? "bg-cyan-500/10 dark:bg-cyan-500/15 border-cyan-500 shadow-[0_0_12px_-3px_rgba(6,182,212,0.4)] ring-1 ring-cyan-500/30"
                                                        : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-cyan-500/50"
                                                )}
                                                onClick={() => {
                                                    setHighlightedConnectionId(isHighlighted ? null : n.id);
                                                }}
                                            >
                                                {/* Header / Pill */}
                                                <div className="flex items-center justify-between text-xs p-2.5">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="shrink-0 w-6 h-6 rounded flex items-center justify-center bg-slate-900 shadow-inner">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d={NODE_CONFIG[n.type]?.path || ''} />
                                                            </svg>
                                                        </div>
                                                        <span className={cn(
                                                            "font-medium truncate",
                                                            isHighlighted ? "text-cyan-700 dark:text-cyan-300" : "text-slate-700 dark:text-slate-300"
                                                        )}>{n.name}</span>
                                                    </div>

                                                </div>

                                                {/* Expanded Accordion Content */}
                                                <div className={cn(
                                                    "px-3 transition-all duration-300 ease-in-out overflow-hidden",
                                                    isHighlighted ? "pb-3 max-h-[1000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                                                )}>
                                                    <div className="pt-2 border-t border-cyan-500/20 space-y-3">
                                                        {nodeEntity.description && (
                                                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                                                {nodeEntity.description}
                                                            </p>
                                                        )}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {nodeEntity.gsciAttributes?.phase && (
                                                                <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                    <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Phase</span>
                                                                    <span className="text-[10px] text-slate-300 font-mono">{nodeEntity.gsciAttributes.phase}</span>
                                                                </div>
                                                            )}
                                                            {nodeEntity.gsciAttributes?.hybrid_pressure_index !== undefined && (
                                                                <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                    <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">HPI Index</span>
                                                                    <span className="text-[10px] text-cyan-400 font-bold font-mono">{(nodeEntity.gsciAttributes.hybrid_pressure_index ?? 0).toFixed(1)}</span>
                                                                </div>
                                                            )}
                                                            {(nodeEntity.gsciAttributes?.confidence_score !== undefined || nodeEntity.type === 'x-influence-vector') && (
                                                                <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                    <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Confidence</span>
                                                                    <span className="text-[10px] text-emerald-400 font-bold font-mono">{(nodeEntity.gsciAttributes?.confidence_score ?? 0)}%</span>
                                                                </div>
                                                            )}
                                                            {(nodeEntity.first_seen || nodeEntity.gsciAttributes?.first_seen) && (
                                                                <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                    <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">First Seen</span>
                                                                    <span className="text-[10px] text-slate-300 font-mono">{(nodeEntity.first_seen || nodeEntity.gsciAttributes?.first_seen || '').split('T')[0]}</span>
                                                                </div>
                                                            )}
                                                            {nodeEntity.threat_actor_types && nodeEntity.threat_actor_types.length > 0 && (
                                                                <div className="col-span-2 bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                    <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Actor Types</span>
                                                                    <span className="text-[10px] text-indigo-400 font-bold">{nodeEntity.threat_actor_types.join(', ')}</span>
                                                                </div>
                                                            )}
                                                            <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Type</span>
                                                                <span className="text-[10px] text-amber-500 font-bold">{NODE_CONFIG[n.type]?.label || n.type}</span>
                                                            </div>

                                                            {/* Intrusion Set specific fields */}
                                                            {nodeEntity.type === 'intrusion-set' && (
                                                                <>
                                                                    {nodeEntity.aliases && nodeEntity.aliases.length > 0 && (
                                                                        <div className="col-span-2 bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Aliases</span>
                                                                            <span className="text-[10px] text-slate-300">{nodeEntity.aliases.join(', ')}</span>
                                                                        </div>
                                                                    )}
                                                                    {nodeEntity.goals && nodeEntity.goals.length > 0 && (
                                                                        <div className="col-span-2 bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Goals</span>
                                                                            <span className="text-[10px] text-slate-300">{nodeEntity.goals.join(', ')}</span>
                                                                        </div>
                                                                    )}
                                                                    {nodeEntity.resource_level && (
                                                                        <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Resource Level</span>
                                                                            <span className="text-[10px] text-orange-400 font-bold">{nodeEntity.resource_level}</span>
                                                                        </div>
                                                                    )}
                                                                    {nodeEntity.primary_motivation && (
                                                                        <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Motivation</span>
                                                                            <span className="text-[10px] text-rose-400 font-bold">{nodeEntity.primary_motivation}</span>
                                                                        </div>
                                                                    )}
                                                                    {nodeEntity.last_seen && (
                                                                        <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Last Seen</span>
                                                                            <span className="text-[10px] text-slate-300 font-mono">{nodeEntity.last_seen.split('T')[0]}</span>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}

                                                            {/* Custom Attributes for Influence Vector */}
                                                            {nodeEntity.type === 'x-influence-vector' && (
                                                                <>
                                                                    {nodeEntity.gsciAttributes?.channel && (
                                                                        <div className="col-span-2 bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Channel</span>
                                                                            <span className="text-[10px] text-purple-400 font-medium">{nodeEntity.gsciAttributes.channel}</span>
                                                                        </div>
                                                                    )}
                                                                    {nodeEntity.gsciAttributes?.target_audience && (
                                                                        <div className="col-span-2 bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Target Audience</span>
                                                                            <span className="text-[10px] text-slate-300">{nodeEntity.gsciAttributes.target_audience}</span>
                                                                        </div>
                                                                    )}
                                                                    {nodeEntity.gsciAttributes?.narrative && (
                                                                        <div className="col-span-2 bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Narrative</span>
                                                                            <p className="text-[10px] text-slate-400 leading-tight italic line-clamp-3">{nodeEntity.gsciAttributes.narrative}</p>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}

                                                            {/* Custom Attributes for Strategic Impact */}
                                                            {nodeEntity.type === 'x-strategic-impact' && (
                                                                <>
                                                                    {nodeEntity.gsciAttributes?.political_destabilization_index !== undefined && (
                                                                        <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Pol. Destab.</span>
                                                                            <span className="text-[10px] text-red-400 font-bold font-mono">{(nodeEntity.gsciAttributes.political_destabilization_index ?? 0).toFixed(1)}</span>
                                                                        </div>
                                                                    )}
                                                                    {nodeEntity.gsciAttributes?.economic_disruption_index !== undefined && (
                                                                        <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Econ. Disrup.</span>
                                                                            <span className="text-[10px] text-amber-500 font-bold font-mono">{(nodeEntity.gsciAttributes.economic_disruption_index ?? 0).toFixed(1)}</span>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                        {nodeEntity.gsciAttributes?.nature && nodeEntity.gsciAttributes.nature.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {nodeEntity.gsciAttributes.nature.map((nat, idx) => (
                                                                    <span key={idx} className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                                                        {nat}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {(nodeEntity.type === 'intrusion-set' || nodeEntity.type === 'threat-actor') && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const base = openctiBaseUrl || 'http://localhost:8080';
                                                                    const openctiId = nodeEntity.metadata?.openctiInternalId;
                                                                    const dashPath = nodeEntity.type === 'intrusion-set'
                                                                        ? 'threats/intrusion_sets'
                                                                        : 'threats/threat_actors_individual';
                                                                    const url = openctiId
                                                                        ? `${base}/dashboard/${dashPath}/${openctiId}`
                                                                        : `${base}/dashboard/search/${encodeURIComponent(nodeEntity.name)}`;
                                                                    window.open(url, '_blank', 'noopener,noreferrer');
                                                                }}
                                                                className="w-full py-1.5 text-[10px] font-bold bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5"
                                                            >
                                                                <ExternalLink size={11} /> View in OpenCTI
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 mt-auto shrink-0">
                        <button className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm text-sm font-semibold transition-colors text-slate-700 dark:text-slate-300">
                            <Download size={16} /> Export
                        </button>
                        <button className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 text-white text-sm font-semibold transition-colors shadow-lg">
                            <Zap size={16} /> Analyze
                        </button>
                    </div>
                </aside>
            )
            }
        </div >
    );
};
