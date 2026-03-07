import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    X, Download, Zap,
    Globe, Flag, Megaphone, Bug, Plus, Minus,
    Maximize2, RefreshCw, AlertTriangle, ExternalLink
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
    'intrusion-set': { color: '#64748b', border: '#475569', path: 'M8 2v4 M16 2v4 M11.9 7v4 M8 9h8 M8 13h8 M12 13c-2.4 0-4.3 2-4.3 4.5S9.6 22 12 22s4.3-2 4.3-4.5S14.4 13 12 13z', label: 'Intrusion Set' },
    'threat-actor': { color: '#64748b', border: '#475569', path: 'M8 2v4 M16 2v4 M11.9 7v4 M8 9h8 M8 13h8 M12 13c-2.4 0-4.3 2-4.3 4.5S9.6 22 12 22s4.3-2 4.3-4.5S14.4 13 12 13z', label: 'Threat Actor' },
};

const LAYER_FILTERS = [
    { key: 'x-geo-strategic-actor', label: 'Geo-Strategic Actors', icon: Globe, color: 'text-cyan-500 bg-cyan-500/10' },
    { key: 'x-strategic-objective', label: 'Strategic Objectives', icon: Flag, color: 'text-amber-500 bg-amber-500/10' },
    { key: 'x-hybrid-campaign', label: 'Hybrid Campaigns', icon: Megaphone, color: 'text-red-500 bg-red-500/10' },
    { key: 'x-strategic-assessment', label: 'Assessments', icon: Zap, color: 'text-emerald-500 bg-emerald-500/10' },
];

interface InfluenceGraphProps {
    initialActorId?: string;
}

export const GeoStrategicInfluenceGraph: React.FC<InfluenceGraphProps> = ({ initialActorId }) => {
    const [entities, setEntities] = useState<GscixEntity[]>([]);
    const [relations, setRelations] = useState<GscixRelation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState<GscixEntity | null>(null);
    const [selectedAnalytics, setSelectedAnalytics] = useState<HpiAnalytics | null>(null);
    const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
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
    const [revisionistFilter, setRevisionistFilter] = useState(0);
    const graphRef = useRef<any>(null);

    // Fetch subgraph from backend
    const fetchGraph = useCallback(async (rootId?: string) => {
        if (!rootId) {
            setEntities([]);
            setRelations([]);
            setSelectedNode(null);
            setHighlightedConnectionId(null);
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

            // Auto-select root actor
            if (rootId) {
                const actor = data.entities.find(e => e.stixId === rootId);
                if (actor) {
                    setSelectedNode(actor);
                    fetchAnalytics(actor);
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

    // When clicking a node: actors → select & show detail; non-actors → highlight in Connections list
    const handleNodeClick = useCallback((node: any) => {
        if (!node.entity) return;
        const entity = node.entity as GscixEntity;

        if (entity.type === 'x-geo-strategic-actor') {
            // Clicking an actor: select it as the main node
            setSelectedNode(entity);
            setHighlightedConnectionId(null);
            fetchAnalytics(entity);
        } else {
            // Clicking a non-actor: highlight it in the Connections list of the current actor
            setHighlightedConnectionId(entity.stixId);
            setTimeout(() => {
                document.getElementById(`conn-${entity.stixId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }

        if (graphRef.current) {
            graphRef.current.centerAt(node.x, node.y, 500);
        }
    }, [fetchAnalytics]);

    // Build visual graph data from the backend-provided entities/relations + client layer filters
    const graphData = useMemo(() => {
        const filteredEntities = entities.filter(e => {
            if (!activeLayers[e.type]) return false;
            if (revisionistFilter > 0 && e.type === 'x-geo-strategic-actor') {
                return (e.gsciAttributes?.revisionist_index || 0) >= revisionistFilter;
            }
            return true;
        });

        const entityIds = new Set(filteredEntities.map(e => e.stixId));

        const nodes = filteredEntities.map(e => ({
            id: e.stixId,
            name: e.name,
            type: e.type,
            val: e.type === 'x-geo-strategic-actor' ? 20 : e.type === 'x-strategic-objective' ? 12 : 8,
            entity: e,
        }));

        const links = relations
            .filter(r => entityIds.has(r.source_ref) && entityIds.has(r.target_ref))
            .map(r => ({
                source: r.source_ref,
                target: r.target_ref,
                relType: r.relationship_type,
            }));

        return { nodes, links };
    }, [entities, relations, activeLayers, revisionistFilter]);

    // Use a ref so paintNode doesn't need selectedNode in its dependency array (avoids graph re-init)
    const selectedNodeRef = useRef<GscixEntity | null>(null);
    useEffect(() => { selectedNodeRef.current = selectedNode; }, [selectedNode]);

    const highlightedConnectionIdRef = useRef<string | null>(null);
    useEffect(() => { highlightedConnectionIdRef.current = highlightedConnectionId; }, [highlightedConnectionId]);

    // Canvas node renderer — stable callback (no selectedNode dependency)
    const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        // Defensive check for non-finite coordinates (avoids createRadialGradient crash)
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;

        const cfg = NODE_CONFIG[node.type] || { color: '#64748b', border: '#475569', path: '', label: 'Unknown' };

        let r = 8;
        if (node.type === 'x-geo-strategic-actor') r = 16;
        else if (node.type === 'x-strategic-objective') r = 12;
        else if (node.type === 'x-hybrid-campaign') r = 11;
        else if (node.type === 'x-strategic-impact') r = 10;
        else if (node.type === 'intrusion-set' || node.type === 'threat-actor') r = 10;

        const isSelected = selectedNodeRef.current?.stixId === node.id;
        const isHighlighted = highlightedConnectionIdRef.current === node.id;

        // Outer glow
        if (isSelected || isHighlighted) {
            const glowColor = isSelected ? cfg.color : '#06b6d4'; // Cyan for highlights
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

        // Outline stroke
        ctx.strokeStyle = isHighlighted && !isSelected ? '#06b6d4' : cfg.color;
        ctx.lineWidth = isSelected || isHighlighted ? 2.5 : 1.5;
        ctx.stroke();

        // Draw Icon Path (centered)
        if (cfg.path) {
            const boxSize = r * 1.35; // Size of the icon bounding box inside circle
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

    // Configure d3 forces after the graph mounts to increase spacing
    const handleEngineStop = useCallback(() => {
        graphRef.current?.zoomToFit(400, 80);
    }, []);

    useEffect(() => {
        if (graphRef.current) {
            graphRef.current.d3Force('link')?.distance(120);
            graphRef.current.d3Force('charge')?.strength(-350).distanceMax(500);
            graphRef.current.d3Force('center')?.strength(0.05);
        }
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
                            onClick={() => setActiveLayers(Object.fromEntries(LAYER_FILTERS.map(l => [l.key, true])))}
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

                {/* Analytical Filters */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Analytical Filters</h3>
                    <div className="space-y-5">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Revisionist Index</label>
                                <span className="text-xs text-cyan-500 font-mono font-bold bg-cyan-500/10 px-1.5 rounded">
                                    {revisionistFilter > 0 ? `> ${revisionistFilter.toFixed(1)}` : 'All'}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="10"
                                step="0.5"
                                value={revisionistFilter}
                                onChange={(e) => setRevisionistFilter(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                            <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                                <span>Low</span>
                                <span>Critical</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* HPI Alert (bottom) */}
                <div className="p-4 mt-auto">
                    {selectedNode && selectedAnalytics && selectedAnalytics.spike_detected && (
                        <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-lg border border-amber-200 dark:border-amber-500/30 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="bg-white dark:bg-slate-800 p-1 rounded-full shadow-sm">
                                    <AlertTriangle className="text-amber-500" size={14} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">HPI Alert: High</p>
                                    <p className="text-[11px] text-amber-700 dark:text-amber-500/80 leading-snug">
                                        Hybrid Pressure Index spike detected for <span className="font-bold underline decoration-amber-400/50">{selectedNode.name}</span>.
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

                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm z-10 transition-all">
                        <div className="text-center">
                            <RefreshCw className="animate-spin text-cyan-500 mx-auto mb-3" size={32} />
                            <p className="text-sm text-slate-500 font-medium">Loading influence graph...</p>
                        </div>
                    </div>
                ) : (
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
                            enableNodeDrag={true}
                            cooldownTicks={200}
                            warmupTicks={50}
                            onEngineStop={handleEngineStop}
                            backgroundColor="rgba(0,0,0,0)"
                            nodeRelSize={6}
                            d3AlphaDecay={0.02}
                            d3VelocityDecay={0.3}
                        />
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
            </div>

            {/* ── Right Detail Panel ── */}
            {selectedNode && (
                <aside className="w-96 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-20 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.08)] overflow-y-auto shrink-0">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-500 border border-cyan-500/20 px-2 py-0.5 rounded-full bg-cyan-500/5">
                                {NODE_CONFIG[selectedNode.type]?.label || selectedNode.type}
                            </span>
                            <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-slate-900 shadow-sm border border-slate-700 flex items-center justify-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d={NODE_CONFIG[selectedNode.type]?.path || 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'} />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{selectedNode.name}</h2>
                                <p className="text-xs text-slate-500 font-mono">{selectedNode.stixId?.substring(0, 24)}...</p>
                            </div>
                        </div>
                        {selectedNode.type === 'x-geo-strategic-actor' && (
                            <div className="flex gap-2 mt-3 flex-wrap">
                                {selectedNode.gsciAttributes?.revisionist_index !== undefined && (selectedNode.gsciAttributes.revisionist_index > 7) && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20">
                                        High Revisionist
                                    </span>
                                )}
                                {selectedNode.gsciAttributes?.strategic_alignment && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                                        {selectedNode.gsciAttributes.strategic_alignment}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Body Content */}
                    <div className="flex-1 p-6 space-y-8">
                        {/* Strategic Metrics (actors only) */}
                        {selectedNode.type === 'x-geo-strategic-actor' && (
                            <div>
                                <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    📊 Strategic Metrics
                                </h3>
                                <div className="space-y-5">
                                    {/* Revisionist Index */}
                                    <div>
                                        <div className="flex justify-between items-end mb-1.5">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Revisionist Index</span>
                                            <span className={cn(
                                                "text-sm font-mono font-bold px-1.5 rounded",
                                                (selectedNode.gsciAttributes?.revisionist_index || 0) > 7 ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10" :
                                                    (selectedNode.gsciAttributes?.revisionist_index || 0) > 4 ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10" :
                                                        "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                                            )}>
                                                {(selectedNode.gsciAttributes?.revisionist_index || 0).toFixed(1)}/10
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-orange-400 to-red-500 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, (selectedNode.gsciAttributes?.revisionist_index || 0) * 10)}%` }}
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
                                                (selectedNode.gsciAttributes?.strategic_ambiguity_score || 0) > 7 ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10" :
                                                    (selectedNode.gsciAttributes?.strategic_ambiguity_score || 0) > 4 ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10" :
                                                        "text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-500/10"
                                            )}>
                                                {(selectedNode.gsciAttributes?.strategic_ambiguity_score || 0) > 7 ? 'High' :
                                                    (selectedNode.gsciAttributes?.strategic_ambiguity_score || 0) > 4 ? 'Medium' : 'Low'}
                                            </span>
                                        </div>
                                        <div className="flex gap-1 mt-1">
                                            <div className={cn("h-2 w-full rounded-sm", (selectedNode.gsciAttributes?.strategic_ambiguity_score || 0) >= 1 ? "bg-cyan-500" : "bg-slate-200 dark:bg-slate-700")}></div>
                                            <div className={cn("h-2 w-full rounded-sm", (selectedNode.gsciAttributes?.strategic_ambiguity_score || 0) >= 4 ? "bg-cyan-500" : "bg-slate-200 dark:bg-slate-700")}></div>
                                            <div className={cn("h-2 w-full rounded-sm", (selectedNode.gsciAttributes?.strategic_ambiguity_score || 0) >= 7 ? "bg-cyan-500" : "bg-slate-200 dark:bg-slate-700")}></div>
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
                        )}

                        {/* Tactical Linkage (OpenCTI) - for actors */}
                        {selectedNode.type === 'x-geo-strategic-actor' && selectedNode.metadata?.openctiInternalId && (
                            <div>
                                <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    🔗 Tactical Linkage (OpenCTI)
                                </h3>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 text-sm border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <Bug className="text-slate-400" size={16} />
                                            <span className="font-bold text-slate-800 dark:text-white">{selectedNode.name}</span>
                                        </div>
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded font-mono">Linked</span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                                        {selectedNode.description || 'Linked threat actor from OpenCTI platform.'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700">
                                            <span className="block text-[10px] text-slate-400 mb-0.5">Source</span>
                                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">OpenCTI</span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700">
                                            <span className="block text-[10px] text-slate-400 mb-0.5">Last Seen</span>
                                            <span className="font-mono text-slate-700 dark:text-slate-300">
                                                {selectedNode.gsciAttributes?.last_seen ? new Date(selectedNode.gsciAttributes.last_seen).toLocaleDateString() : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                    <button className="w-full py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-cyan-500 hover:text-cyan-500 rounded-md text-slate-600 dark:text-slate-400 transition-all shadow-sm flex items-center justify-center gap-1">
                                        View in OpenCTI <ExternalLink size={12} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Entity description / details for non-actors */}
                        {selectedNode.type !== 'x-geo-strategic-actor' && (
                            <div>
                                <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    📄 Details
                                </h3>
                                <div className="space-y-3">
                                    {selectedNode.description && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{selectedNode.description}</p>
                                    )}
                                    {selectedNode.gsciAttributes?.phase && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Phase</span>
                                            <span className="font-mono font-semibold text-slate-700 dark:text-white">{selectedNode.gsciAttributes.phase}</span>
                                        </div>
                                    )}
                                    {selectedNode.gsciAttributes?.nature && Array.isArray(selectedNode.gsciAttributes.nature) && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Nature</span>
                                            <span className="font-mono font-semibold text-slate-700 dark:text-white">{selectedNode.gsciAttributes.nature.join(', ')}</span>
                                        </div>
                                    )}
                                    {selectedNode.gsciAttributes?.hybrid_pressure_index !== undefined && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">HPI</span>
                                            <span className="font-mono font-semibold text-slate-700 dark:text-white">{selectedNode.gsciAttributes.hybrid_pressure_index.toFixed(1)}</span>
                                        </div>
                                    )}
                                    {selectedNode.gsciAttributes?.confidence_score !== undefined && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Confidence</span>
                                            <span className="font-mono font-semibold text-slate-700 dark:text-white">{selectedNode.gsciAttributes.confidence_score}%</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Connected entities */}
                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                🕸️ Connections
                            </h3>
                            <ul className="space-y-2">
                                {relations
                                    .filter(r => r.source_ref === selectedNode.stixId || r.target_ref === selectedNode.stixId)
                                    .slice(0, 12)
                                    .map((r, i) => {
                                        const otherId = r.source_ref === selectedNode.stixId ? r.target_ref : r.source_ref;
                                        const otherEntity = entities.find(e => e.stixId === otherId);
                                        const isHighlighted = highlightedConnectionId === otherId;
                                        return (
                                            <li key={i}
                                                id={`conn-${otherId}`}
                                                className={cn(
                                                    "flex items-center justify-between text-xs p-2.5 rounded-lg border transition-all duration-300 cursor-pointer",
                                                    isHighlighted
                                                        ? "bg-cyan-500/10 dark:bg-cyan-500/15 border-cyan-500 shadow-[0_0_12px_-3px_rgba(6,182,212,0.4)] ring-1 ring-cyan-500/30"
                                                        : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-cyan-500/50"
                                                )}
                                                onClick={() => {
                                                    setHighlightedConnectionId(otherId);
                                                    // Center graph on that node
                                                    const gNode = graphData.nodes.find((n: any) => n.id === otherId);
                                                    if (gNode && graphRef.current) {
                                                        graphRef.current.centerAt((gNode as any).x, (gNode as any).y, 500);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {/* Node shape representation in the list */}
                                                    <div className="shrink-0 w-6 h-6 rounded flex items-center justify-center bg-slate-900 shadow-inner">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d={NODE_CONFIG[otherEntity?.type || '']?.path || ''} />
                                                        </svg>
                                                    </div>
                                                    <span className={cn(
                                                        "font-medium truncate",
                                                        isHighlighted ? "text-cyan-700 dark:text-cyan-300" : "text-slate-700 dark:text-slate-300"
                                                    )}>{otherEntity?.name || otherId.substring(0, 20)}</span>
                                                </div>
                                                <span className={cn(
                                                    "font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 ml-2",
                                                    isHighlighted
                                                        ? "text-cyan-700 dark:text-cyan-300 bg-cyan-500/20"
                                                        : "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10"
                                                )}>{r.relationship_type}</span>
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
