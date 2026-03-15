import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    X, Download, Zap,
    Globe, Flag, Megaphone, Bug, Plus, Minus,
    Maximize2, RefreshCw, AlertTriangle, ExternalLink,
    Radio, Scale, BarChart3, ChevronLeft, ChevronDown, ChevronRight, Layers, Users,
    PlusSquare, GitBranch, Save, ArrowLeft, Trash2, ToggleLeft, ToggleRight, Pencil
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
    { key: 'x-strategic-objective', label: 'Strategic Objectives', icon: Flag, color: 'text-amber-500 bg-amber-500/10' },
    { key: 'x-hybrid-campaign', label: 'Hybrid Campaigns', icon: Megaphone, color: 'text-red-500 bg-red-500/10' },
    { key: 'x-influence-vector', label: 'Influence Vectors', icon: Radio, color: 'text-purple-500 bg-purple-500/10' },
    { key: 'x-strategic-impact', label: 'Strategic Impacts', icon: Scale, color: 'text-indigo-500 bg-indigo-500/10' },
    { key: 'x-strategic-assessment', label: 'Assessments', icon: BarChart3, color: 'text-emerald-500 bg-emerald-500/10' },
    { key: 'intrusion-set', label: 'Intrusion Sets', icon: Layers, color: 'text-slate-500 bg-slate-500/10' },
    { key: 'threat-actor', label: 'Threat Actors', icon: Users, color: 'text-slate-400 bg-slate-400/10' },
];

interface InfluenceGraphProps {
    initialActorId?: string;
}

export const GeoStrategicInfluenceGraph: React.FC<InfluenceGraphProps> = ({ initialActorId }) => {
    const [entities, setEntities] = useState<GscixEntity[]>([]);
    const [relations, setRelations] = useState<GscixRelation[]>([]);
    const [allEntities, setAllEntities] = useState<GscixEntity[]>([]);
    const [loading, setLoading] = useState(true);
    const [rootActor, setRootActor] = useState<GscixEntity | null>(null);
    const [selectedAnalytics, setSelectedAnalytics] = useState<HpiAnalytics | null>(null);
    const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
    const [panelVisible, setPanelVisible] = useState(true);
    const [leftPanelVisible, setLeftPanelVisible] = useState(true);
    const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
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
    const [graphMode, setGraphMode] = useState<'view' | 'add-entity' | 'add-relation' | 'edit-relation' | 'edit-entity'>('view');
    const [saving, setSaving] = useState(false);
    const [newEntity, setNewEntity] = useState<Record<string, any>>({ type: 'x-strategic-objective', name: '', description: '' });
    const [newRelation, setNewRelation] = useState({ source_ref: '', relationship_type: 'attributed-to', target_ref: '' });
    const [deleteTarget, setDeleteTarget] = useState<{ entity: GscixEntity; childCount: number; relationCount: number } | null>(null);
    const [deleteRelationTarget, setDeleteRelationTarget] = useState<GscixRelation | null>(null);
    const [editingRelation, setEditingRelation] = useState<GscixRelation | null>(null);
    const [editingEntity, setEditingEntity] = useState<GscixEntity | null>(null);
    const [editEntityForm, setEditEntityForm] = useState<Record<string, any>>({});
    const [highlightedRelationId, setHighlightedRelationId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [openctiEntities, setOpenctiEntities] = useState<GscixEntity[]>([]);
    const graphRef = useRef<any>(null);
    const initialZoomDone = useRef(false);
    const d3ForcesConfigured = useRef(false);
    const [connectionsCollapsed, setConnectionsCollapsed] = useState(true);

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
            const data = await apiService.getInfluenceGraph(rootId, 5);
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

    const refreshAllEntities = useCallback(async () => {
        try {
            const all = await apiService.getEntities();
            setAllEntities(all);
        } catch (err) {
            console.error('Failed to fetch all entities:', err);
        }
    }, []);

    useEffect(() => {
        fetchGraph(initialActorId);
        refreshAllEntities();
    }, [initialActorId, fetchGraph, refreshAllEntities]);

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
    // If in edit mode, cancel the edit and return to view mode.
    const handleNodeClick = useCallback((node: any) => {
        if (!node.entity) return;
        const entity = node.entity as GscixEntity;

        // If in edit mode, cancel editing and return to view, then continue to select
        if (graphMode === 'edit-relation' || graphMode === 'edit-entity') {
            setEditingRelation(null);
            setEditingEntity(null);
            setEditEntityForm({});
            setGraphMode('view');
        }

        // Ensure the panel is visible
        setPanelVisible(true);

        // Select the clicked entity (no toggle when coming from edit mode)
        const newId = highlightedConnectionId === entity.stixId && graphMode === 'view' ? null : entity.stixId;
        setHighlightedConnectionId(newId);
        // Deselect any highlighted relation
        setHighlightedRelationId(null);

        if (newId) {
            setTimeout(() => {
                document.getElementById(`conn-${entity.stixId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    }, [highlightedConnectionId, graphMode]);

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

                const now = new Date();
                // Default: entities without first_seen are assumed to have started now
                // (they won't appear in historical ranges, which is correct)
                const firstSeen = fsStr ? new Date(fsStr) : now;
                // Default: entities without last_seen are assumed still active (today)
                const lastSeen = lsStr ? new Date(lsStr) : now;

                if (dateRange.from) {
                    const fromDate = new Date(dateRange.from);
                    if (lastSeen < fromDate) return false;
                }
                if (dateRange.to) {
                    const toDate = new Date(dateRange.to);
                    // Set to end of day (23:59:59.999) so that "today" includes the full day
                    toDate.setHours(23, 59, 59, 999);
                    if (firstSeen > toDate) return false;
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
                id: r.id,
                source: r.source_ref,
                target: r.target_ref,
                relType: r.relationship_type,
                relation: r,
            }));

        return { nodes, links };
    }, [entities, relations, activeLayers, dateRange, initialActorId]);

    // Use a ref so paintNode doesn't need rootActor in its dependency array (avoids graph re-init)
    const rootActorRef = useRef<GscixEntity | null>(null);
    useEffect(() => { rootActorRef.current = rootActor; }, [rootActor]);

    const highlightedConnectionIdRef = useRef<string | null>(null);
    useEffect(() => { highlightedConnectionIdRef.current = highlightedConnectionId; }, [highlightedConnectionId]);

    const highlightedRelationIdRef = useRef<string | null>(null);
    useEffect(() => { highlightedRelationIdRef.current = highlightedRelationId; }, [highlightedRelationId]);

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

            // "Unlinked" badge for intrusion-set / threat-actor without OpenCTI ID
            const entity = node.entity;
            if (entity && (entity.type === 'intrusion-set' || entity.type === 'threat-actor') && !entity.metadata?.openctiInternalId) {
                const badgeText = '\u26A0 Unlinked';
                const badgeFontSize = Math.max(3, 8 / globalScale);
                ctx.font = `700 ${badgeFontSize}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                const badgeY = labelY + labelFontSize + 3 / globalScale;
                const badgeW = ctx.measureText(badgeText).width;
                const bPadX = 3 / globalScale;
                const bPadY = 1.5 / globalScale;
                const bRadius = 2 / globalScale;

                // Badge background
                ctx.beginPath();
                ctx.roundRect(node.x - badgeW / 2 - bPadX, badgeY - bPadY, badgeW + bPadX * 2, badgeFontSize + bPadY * 2, bRadius);
                ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
                ctx.lineWidth = 0.8 / globalScale;
                ctx.stroke();

                // Badge text
                ctx.fillStyle = 'rgba(245, 158, 11, 1)';
                ctx.fillText(badgeText, node.x, badgeY);
            }
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

    // Compute cascade impact: BFS from entityId following outgoing relations.
    // A child is included in the deletion set only if all its incoming relations
    // come from nodes already in the deletion set (i.e. it would be orphaned).
    const computeCascadeImpact = useCallback((entityId: string) => {
        const toDelete = new Set<string>([entityId]);
        const queue = [entityId];
        const affectedRelations = new Set<string>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            // Outgoing relations from current node
            const outgoing = relations.filter(r => r.source_ref === currentId);
            for (const r of outgoing) {
                affectedRelations.add(r.id || `${r.source_ref}-${r.target_ref}`);
                const childId = r.target_ref;
                if (toDelete.has(childId)) continue;

                // Check if child has any incoming relations from outside the deletion set
                const childIncoming = relations.filter(ir => ir.target_ref === childId);
                const hasExternalParent = childIncoming.some(ir => !toDelete.has(ir.source_ref));

                if (!hasExternalParent) {
                    toDelete.add(childId);
                    queue.push(childId);
                }
            }
            // Also count incoming relations to current node (they'll be deleted too)
            const incoming = relations.filter(r => r.target_ref === currentId);
            for (const r of incoming) {
                affectedRelations.add(r.id || `${r.source_ref}-${r.target_ref}`);
            }
        }

        return { entityCount: toDelete.size, relationCount: affectedRelations.size };
    }, [relations]);

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
            {leftPanelVisible && (
            <aside className="w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.08)]">
                {/* Graph Layers */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Graph Layers</h3>
                        <div className="flex items-center gap-2">
                        {(() => {
                            const allActive = LAYER_FILTERS.every(l => activeLayers[l.key]);
                            return (
                                <button
                                    onClick={() => {
                                        const newState: Record<string, boolean> = {};
                                        LAYER_FILTERS.forEach(l => { newState[l.key] = !allActive; });
                                        setActiveLayers(newState);
                                    }}
                                    className={cn(
                                        "flex items-center gap-1 text-[10px] font-medium transition-colors",
                                        allActive ? "text-slate-400 hover:text-red-400" : "text-cyan-500 hover:text-cyan-400"
                                    )}
                                    title={allActive ? "Deselect all layers" : "Select all layers"}
                                >
                                    {allActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                    {allActive ? 'None' : 'All'}
                                </button>
                            );
                        })()}
                        <button onClick={() => setLeftPanelVisible(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors" title="Hide filters">
                            <X size={14} />
                        </button>
                        </div>
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
            )}

            {/* ── Central Graph Canvas ── */}
            <div className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-slate-950 cursor-move"
                style={{
                    backgroundImage: 'linear-gradient(rgba(148,163,184,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}>

                {/* Left sidebar recovery button */}
                {!leftPanelVisible && (
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 z-10">
                        <button
                            onClick={() => setLeftPanelVisible(true)}
                            className="flex items-center justify-center w-8 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-xl shadow-lg text-slate-400 hover:text-cyan-500 transition-all group"
                            title="Show Filters"
                        >
                            <ChevronLeft size={20} className="rotate-180 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                )}

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
                    <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex flex-col gap-1">
                        <button
                            onClick={() => { setGraphMode(graphMode === 'add-entity' ? 'view' : 'add-entity'); setPanelVisible(true); }}
                            className={cn("p-2 rounded transition-colors", graphMode === 'add-entity' ? "bg-cyan-500/20 text-cyan-500" : "hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-cyan-500 text-slate-500")}
                            title="Add Entity"
                        >
                            <PlusSquare size={18} />
                        </button>
                        <div className="h-px w-full bg-slate-100 dark:bg-slate-700"></div>
                        <button
                            onClick={() => { setGraphMode(graphMode === 'add-relation' ? 'view' : 'add-relation'); setPanelVisible(true); }}
                            className={cn("p-2 rounded transition-colors", graphMode === 'add-relation' ? "bg-cyan-500/20 text-cyan-500" : "hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-cyan-500 text-slate-500")}
                            title="Add Relation"
                        >
                            <GitBranch size={18} />
                        </button>
                    </div>
                </div>

                <div className="absolute inset-0 z-0">
                    <ForceGraph2D
                        ref={graphRef}
                        graphData={graphData}
                        nodeCanvasObject={paintNode}
                        onNodeClick={handleNodeClick}
                        onLinkClick={(link: any) => {
                            const wasEditing = graphMode === 'edit-relation' || graphMode === 'edit-entity';
                            // If in edit mode, cancel editing and return to view, then continue to select
                            if (wasEditing) {
                                setEditingRelation(null);
                                setEditingEntity(null);
                                setEditEntityForm({});
                                setGraphMode('view');
                            }
                            const linkId = link.id;
                            if (!linkId) return;
                            // Select the clicked link (no toggle when coming from edit mode)
                            const newId = highlightedRelationId === linkId && !wasEditing ? null : linkId;
                            setHighlightedRelationId(newId);
                            // Deselect any highlighted node
                            setHighlightedConnectionId(null);
                            setPanelVisible(true);
                            if (newId) {
                                // Auto-expand Connections section if collapsed
                                setConnectionsCollapsed(false);
                                setTimeout(() => {
                                    document.getElementById(`rel-${linkId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }, 150);
                            }
                        }}
                        linkColor={(link: any) => link.id === highlightedRelationIdRef.current ? 'rgba(6,182,212,0.9)' : 'rgba(148,163,184,0.4)'}
                        linkWidth={() => 1.8}
                        linkDirectionalArrowLength={7}
                        linkDirectionalArrowRelPos={0.85}
                        linkDirectionalArrowColor={(link: any) => link.id === highlightedRelationIdRef.current ? 'rgba(6,182,212,0.9)' : 'rgba(148,163,184,0.6)'}
                        linkLineDash={() => [4, 2]}
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

                            const isHighlightedLink = link.id === highlightedRelationIdRef.current;

                            // Rounded rectangle background — opaque to occlude the link line beneath
                            ctx.beginPath();
                            ctx.roundRect(boxX, boxY, boxW, boxH, borderRadius);
                            ctx.fillStyle = isHighlightedLink ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.85)';
                            ctx.fill();
                            ctx.strokeStyle = isHighlightedLink ? 'rgba(6, 182, 212, 0.8)' : 'rgba(148, 163, 184, 0.4)';
                            ctx.lineWidth = (isHighlightedLink ? 1.5 : 1) / globalScale;
                            ctx.stroke();

                            // Text
                            ctx.fillStyle = isHighlightedLink ? 'rgba(6, 182, 212, 1)' : 'rgba(203, 213, 225, 0.95)';
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

                {/* ── Delete Confirmation Modal ── */}
                {deleteTarget && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-50">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-96 overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                                        <Trash2 className="text-red-500" size={20} />
                                    </div>
                                    <button onClick={() => setDeleteTarget(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                        <X size={18} />
                                    </button>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Delete Entity</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">"{deleteTarget.entity.name}"</span>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                                    This action cannot be undone. The following will be permanently deleted:
                                </p>
                                <div className="bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 rounded-lg p-3 space-y-1.5 mb-4">
                                    <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                                        1 entity (this node)
                                    </div>
                                    {deleteTarget.childCount > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                                            {deleteTarget.childCount} child {deleteTarget.childCount === 1 ? 'entity' : 'entities'} (orphaned after deletion)
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                                        {deleteTarget.relationCount} {deleteTarget.relationCount === 1 ? 'relation' : 'relations'}
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="py-2.5 px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={deleting}
                                    onClick={async () => {
                                        try {
                                            setDeleting(true);
                                            await apiService.deleteEntityCascade(deleteTarget.entity.stixId);
                                            setDeleteTarget(null);
                                            setHighlightedConnectionId(null);
                                            await fetchGraph(initialActorId);
                                            await refreshAllEntities();
                                        } catch (err) {
                                            console.error('Failed to delete entity:', err);
                                        } finally {
                                            setDeleting(false);
                                        }
                                    }}
                                    className="py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {deleting ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Delete Relation Confirmation Modal ── */}
                {deleteRelationTarget && (() => {
                    const srcEntity = entities.find(e => e.stixId === deleteRelationTarget.source_ref);
                    const tgtEntity = entities.find(e => e.stixId === deleteRelationTarget.target_ref);
                    return (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-50">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-96 overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                                            <Trash2 className="text-red-500" size={20} />
                                        </div>
                                        <button onClick={() => setDeleteRelationTarget(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Relation</h3>
                                    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 mb-4">
                                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                            <span className="font-semibold truncate max-w-[120px]">{srcEntity?.name || 'Unknown'}</span>
                                            <span className="text-cyan-500 font-mono shrink-0">&mdash;{deleteRelationTarget.relationship_type}&rarr;</span>
                                            <span className="font-semibold truncate max-w-[120px]">{tgtEntity?.name || 'Unknown'}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        This will permanently remove the connection between these two entities. The entities themselves will not be deleted.
                                    </p>
                                </div>
                                <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setDeleteRelationTarget(null)}
                                        className="py-2.5 px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        disabled={deleting}
                                        onClick={async () => {
                                            try {
                                                setDeleting(true);
                                                await apiService.deleteRelation(deleteRelationTarget.id);
                                                setDeleteRelationTarget(null);
                                                setHighlightedRelationId(null);
                                                await fetchGraph(initialActorId);
                                                await refreshAllEntities();
                                            } catch (err) {
                                                console.error('Failed to delete relation:', err);
                                            } finally {
                                                setDeleting(false);
                                            }
                                        }}
                                        className="py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {deleting ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* ── Right Detail Panel ── */}
            {panelVisible && (graphMode !== 'view' || rootActor) && (
                <aside className="w-96 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-20 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.08)] overflow-y-auto shrink-0 [scrollbar-gutter:stable]">

                {/* ── ADD ENTITY FORM ── */}
                {graphMode === 'add-entity' && (
                    <>
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-500 border border-cyan-500/20 px-2 py-0.5 rounded-full bg-cyan-500/5 flex items-center gap-1">
                                <PlusSquare size={12} /> New Entity
                            </span>
                            <button onClick={() => setGraphMode('view')} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Add Entity</h2>
                        <p className="text-xs text-slate-500 mt-1">Create a new entity in the knowledge graph.</p>
                    </div>
                    <div className="flex-1 p-6 space-y-5 overflow-y-auto">
                        {/* Type */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Type *</label>
                            <select
                                value={newEntity.type}
                                onChange={(e) => {
                                    const newType = e.target.value;
                                    setNewEntity({ type: newType, name: '', description: '' });
                                    if (newType === 'intrusion-set' || newType === 'threat-actor') {
                                        apiService.getEntitiesByType(newType).then(setOpenctiEntities).catch(() => setOpenctiEntities([]));
                                    } else {
                                        setOpenctiEntities([]);
                                    }
                                }}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            >
                                {Object.entries(NODE_CONFIG).filter(([key]) => key !== 'x-geo-strategic-actor').map(([key, cfg]) => (
                                    <option key={key} value={key}>{cfg.label}</option>
                                ))}
                            </select>
                            <div className="mt-2 flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: NODE_CONFIG[newEntity.type]?.color || '#64748b' }}></div>
                                <span className="text-[10px] text-slate-400 font-mono">{newEntity.type}</span>
                            </div>
                        </div>
                        {/* Name — combo for intrusion-set/threat-actor, text input for others */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Name *</label>
                            {(newEntity.type === 'intrusion-set' || newEntity.type === 'threat-actor') ? (
                                <select
                                    value={newEntity._openctiStixId || ''}
                                    onChange={(e) => {
                                        const selected = openctiEntities.find(ent => ent.stixId === e.target.value);
                                        if (selected) {
                                            // OpenCTI uses sentinel values for unset dates:
                                            //   first_seen = 1970-01-01T00:00:00.000Z (epoch 0)
                                            //   last_seen  = 5138-11-16T09:46:40.000Z (far future)
                                            // Treat these as empty (not set).
                                            const isSentinel = (d?: string) => {
                                                if (!d) return true;
                                                const ms = new Date(d).getTime();
                                                // year 2200 threshold to catch any far-future sentinel
                                                return ms <= 0 || ms >= new Date('2200-01-01').getTime();
                                            };
                                            setNewEntity(prev => ({
                                                ...prev,
                                                name: selected.name,
                                                description: selected.description || '',
                                                first_seen: isSentinel(selected.first_seen) ? '' : selected.first_seen!.split('T')[0],
                                                last_seen: isSentinel(selected.last_seen) ? '' : selected.last_seen!.split('T')[0],
                                                resource_level: selected.resource_level || '',
                                                primary_motivation: selected.primary_motivation || '',
                                                _openctiStixId: selected.stixId,
                                                _openctiInternalId: selected.metadata?.openctiInternalId || '',
                                            }));
                                        } else {
                                            setNewEntity(prev => ({ ...prev, name: '', _openctiStixId: '', _openctiInternalId: '' }));
                                        }
                                    }}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                >
                                    <option value="">Select from OpenCTI...</option>
                                    {openctiEntities.map(ent => (
                                        <option key={ent.stixId} value={ent.stixId}>{ent.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={newEntity.name || ''}
                                    onChange={(e) => setNewEntity(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Entity name"
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400"
                                />
                            )}
                        </div>
                        {/* Description */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Description</label>
                            <textarea
                                value={newEntity.description || ''}
                                onChange={(e) => setNewEntity(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Optional description"
                                rows={3}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400 resize-none"
                            />
                        </div>
                        {/* First Seen / Last Seen */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">First Seen</label>
                                <input type="date" value={newEntity.first_seen || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, first_seen: e.target.value }))}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Last Seen</label>
                                <input type="date" value={newEntity.last_seen || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, last_seen: e.target.value }))}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                            </div>
                        </div>
                        {/* Confidence */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Confidence (0-100)</label>
                            <input type="number" min="0" max="100" value={newEntity.confidence ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, confidence: e.target.value ? parseInt(e.target.value) : undefined }))}
                                placeholder="e.g. 85"
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400" />
                        </div>

                        {/* Dynamic GSCI fields based on type */}
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Type-specific Attributes</label>

                            {newEntity.type === 'x-geo-strategic-actor' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Strategic Alignment *</label>
                                        <select value={newEntity.strategic_alignment || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, strategic_alignment: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>NATO</option><option>BRICS</option><option>EU</option><option>Non-Aligned</option><option>Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Geopolitical Doctrine</label>
                                        <input type="text" value={newEntity.geopolitical_doctrine || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, geopolitical_doctrine: e.target.value }))}
                                            placeholder="e.g. Neo-Eurasianist expansionism"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Revisionist Index (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.revisionist_index ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, revisionist_index: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Strategic Ambiguity Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.strategic_ambiguity_score ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, strategic_ambiguity_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Doctrine Type</label>
                                        <select value={newEntity.doctrine_type || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, doctrine_type: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>Stability-Oriented</option><option>status-quo</option><option>revisionist</option><option>expansionist</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Technological Modernization Rate (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.technological_modernization_rate ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, technological_modernization_rate: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                </div>
                            )}

                            {newEntity.type === 'x-strategic-objective' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Objective Type *</label>
                                        <select value={newEntity.objective_type || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, objective_type: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>political</option><option>military</option><option>economic</option><option>societal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Priority Level</label>
                                        <select value={newEntity.priority_level || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, priority_level: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>critical</option><option>high</option><option>medium</option><option>low</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Time Horizon</label>
                                        <select value={newEntity.time_horizon || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, time_horizon: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>short-term</option><option>medium-term</option><option>long-term</option><option>decadal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2">Civil-Military Fusion</label>
                                        <select value={newEntity.civil_military_fusion === true ? 'true' : newEntity.civil_military_fusion === false ? 'false' : ''} onChange={(e) => setNewEntity(prev => ({ ...prev, civil_military_fusion: e.target.value === '' ? undefined : e.target.value === 'true' }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option value="true">Yes</option><option value="false">No</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {newEntity.type === 'x-hybrid-campaign' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Phase *</label>
                                        <select value={newEntity.phase || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, phase: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>pre-conflict</option><option>escalation</option><option>sustained-pressure</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Integration Level</label>
                                        <input type="text" value={newEntity.integration_level || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, integration_level: e.target.value }))} placeholder="e.g. high"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Geographic Scope</label>
                                        <input type="text" value={newEntity.geographic_scope || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, geographic_scope: e.target.value }))} placeholder="e.g. Eastern Europe"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Escalation Risk Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.escalation_risk_score ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, escalation_risk_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Velocity</label>
                                        <select value={newEntity.velocity || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, velocity: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>fast-spike</option><option>slow-drift</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nature (comma-separated)</label>
                                        <input type="text" value={Array.isArray(newEntity.nature) ? newEntity.nature.join(', ') : newEntity.nature || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, nature: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="e.g. cyber, economic, diplomatic"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                </div>
                            )}

                            {newEntity.type === 'x-influence-vector' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Narrative *</label>
                                        <textarea value={newEntity.narrative || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, narrative: e.target.value }))} rows={2} placeholder="Key narrative"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400 resize-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Channel</label>
                                        <input type="text" value={newEntity.channel || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, channel: e.target.value }))} placeholder="e.g. social-media"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Target Audience</label>
                                        <input type="text" value={newEntity.target_audience || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, target_audience: e.target.value }))} placeholder="e.g. Baltic civilian population"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                </div>
                            )}

                            {newEntity.type === 'x-strategic-impact' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Political Destabilization Index (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.political_destabilization_index ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, political_destabilization_index: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Economic Disruption Index (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.economic_disruption_index ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, economic_disruption_index: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Alliance Fragmentation Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.alliance_fragmentation_score ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, alliance_fragmentation_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Deterrence Signal Strength (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.deterrence_signal_strength ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, deterrence_signal_strength: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                </div>
                            )}

                            {newEntity.type === 'x-strategic-assessment' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Hybrid Pressure Index (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.hybrid_pressure_index ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, hybrid_pressure_index: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Escalation Probability Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.escalation_probability_score ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, escalation_probability_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Strategic Signaling Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.strategic_signaling_score ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, strategic_signaling_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Cyber-Geopolitical Coupling Index (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.cyber_geopolitical_coupling_index ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, cyber_geopolitical_coupling_index: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Narrative Penetration Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.narrative_penetration_score ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, narrative_penetration_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Doctrine-Capacity Divergence Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={newEntity.doctrine_capacity_divergence_score ?? ''} onChange={(e) => setNewEntity(prev => ({ ...prev, doctrine_capacity_divergence_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                                    </div>
                                </div>
                            )}

                            {(newEntity.type === 'intrusion-set' || newEntity.type === 'threat-actor') && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Resource Level</label>
                                        <select value={newEntity.resource_level || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, resource_level: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>individual</option><option>club</option><option>contest</option><option>team</option><option>organization</option><option>government</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Primary Motivation</label>
                                        <select value={newEntity.primary_motivation || ''} onChange={(e) => setNewEntity(prev => ({ ...prev, primary_motivation: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>accidental</option><option>coercion</option><option>dominance</option><option>ideology</option><option>notoriety</option><option>organizational-gain</option><option>personal-gain</option><option>personal-satisfaction</option><option>revenge</option><option>unpredictable</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Save / Cancel footer */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 mt-auto shrink-0">
                        <button onClick={() => setGraphMode('view')}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm text-sm font-semibold transition-colors text-slate-700 dark:text-slate-300">
                            <ArrowLeft size={16} /> Cancel
                        </button>
                        <button
                            disabled={!newEntity.name || saving}
                            onClick={async () => {
                                try {
                                    setSaving(true);
                                    const isOpenctiEntity = newEntity._openctiStixId;
                                    let savedEntityStixId = '';

                                    if (!isOpenctiEntity) {
                                        // Create new entity (custom GSCIX types)
                                        const { type, name, description, first_seen, last_seen, confidence, _openctiStixId, _openctiInternalId, ...gsciFields } = newEntity;
                                        const payload: any = { type, name, description };
                                        if (first_seen) payload.first_seen = first_seen + 'T00:00:00Z';
                                        if (last_seen) payload.last_seen = last_seen + 'T00:00:00Z';
                                        if (confidence !== undefined && confidence !== '') payload.confidence = confidence;
                                        const cleanGsci = Object.fromEntries(Object.entries(gsciFields).filter(([_, v]) => v !== '' && v !== undefined));
                                        if (Object.keys(cleanGsci).length > 0) {
                                            payload.gsciAttributes = cleanGsci;
                                            Object.assign(payload, cleanGsci);
                                        }
                                        const created = await apiService.createEntity(payload);
                                        savedEntityStixId = created.stixId;
                                    } else {
                                        // OpenCTI entity already exists — update with user-provided dates & fields
                                        savedEntityStixId = newEntity._openctiStixId;
                                        const { type, name, description, first_seen, last_seen, confidence: entityConfidence, resource_level, primary_motivation, _openctiStixId, _openctiInternalId } = newEntity;
                                        const payload: any = {
                                            stixId: _openctiStixId,
                                            type,
                                            name,
                                            description,
                                        };
                                        if (first_seen) payload.first_seen = first_seen.includes('T') ? first_seen : first_seen + 'T00:00:00Z';
                                        if (last_seen) payload.last_seen = last_seen.includes('T') ? last_seen : last_seen + 'T00:00:00Z';
                                        if (entityConfidence !== undefined && entityConfidence !== '') payload.confidence = entityConfidence;
                                        if (resource_level) payload.resource_level = resource_level;
                                        if (primary_motivation) payload.primary_motivation = primary_motivation;
                                        await apiService.createEntity(payload);
                                    }

                                    // Refresh graph and all entities list
                                    await fetchGraph(initialActorId);
                                    await refreshAllEntities();
                                    // Auto-switch to Add Relation so user can connect the entity
                                    setNewEntity({ type: 'x-strategic-objective', name: '', description: '' });
                                    setOpenctiEntities([]);
                                    setNewRelation({
                                        source_ref: savedEntityStixId,
                                        relationship_type: 'attributed-to',
                                        target_ref: '',
                                    });
                                    setGraphMode('add-relation');
                                } catch (err) {
                                    console.error('Failed to create entity:', err);
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />} Save
                        </button>
                    </div>
                    </>
                )}

                {/* ── ADD RELATION FORM ── */}
                {graphMode === 'add-relation' && (
                    <>
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-500 border border-cyan-500/20 px-2 py-0.5 rounded-full bg-cyan-500/5 flex items-center gap-1">
                                <GitBranch size={12} /> New Relation
                            </span>
                            <button onClick={() => setGraphMode('view')} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Add Relation</h2>
                        <p className="text-xs text-slate-500 mt-1">Create a connection between two entities.</p>
                    </div>
                    <div className="flex-1 p-6 space-y-5 overflow-y-auto">
                        {/* Source */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Source *</label>
                            <select value={newRelation.source_ref} onChange={(e) => setNewRelation(prev => ({ ...prev, source_ref: e.target.value }))}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                <option value="">Select source entity...</option>
                                {allEntities.map((e) => (
                                    <option key={e.stixId} value={e.stixId}>{NODE_CONFIG[e.type]?.label || e.type}: {e.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* Relation Type */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Relation Type *</label>
                            <select value={newRelation.relationship_type} onChange={(e) => setNewRelation(prev => ({ ...prev, relationship_type: e.target.value }))}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                {['attributed-to', 'pursues', 'executes', 'uses', 'deploys', 'generates', 'evaluates', 'associated-with', 'targets', 'indicates', 'mitigates'].map(rt => (
                                    <option key={rt} value={rt}>{rt}</option>
                                ))}
                            </select>
                        </div>
                        {/* Target */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Target *</label>
                            <select value={newRelation.target_ref} onChange={(e) => setNewRelation(prev => ({ ...prev, target_ref: e.target.value }))}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                <option value="">Select target entity...</option>
                                {allEntities.filter(e => e.stixId !== newRelation.source_ref).map((e) => (
                                    <option key={e.stixId} value={e.stixId}>{NODE_CONFIG[e.type]?.label || e.type}: {e.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* Confidence */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Confidence (0-100)</label>
                            <input type="number" min="0" max="100" value={(newRelation as any).confidence ?? ''} onChange={(e) => setNewRelation(prev => ({ ...prev, confidence: e.target.value ? parseInt(e.target.value) : undefined } as any))}
                                placeholder="e.g. 85"
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder:text-slate-400" />
                        </div>
                        {/* Visual preview */}
                        {newRelation.source_ref && newRelation.target_ref && (
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preview</p>
                                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                    <span className="font-semibold truncate max-w-[120px]">{allEntities.find(e => e.stixId === newRelation.source_ref)?.name}</span>
                                    <span className="text-cyan-500 font-mono shrink-0">—{newRelation.relationship_type}→</span>
                                    <span className="font-semibold truncate max-w-[120px]">{allEntities.find(e => e.stixId === newRelation.target_ref)?.name}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Save / Cancel footer */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 mt-auto shrink-0">
                        <button onClick={() => setGraphMode('view')}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm text-sm font-semibold transition-colors text-slate-700 dark:text-slate-300">
                            <ArrowLeft size={16} /> Cancel
                        </button>
                        <button
                            disabled={!newRelation.source_ref || !newRelation.target_ref || saving}
                            onClick={async () => {
                                try {
                                    setSaving(true);
                                    const relPayload: any = {
                                        source_ref: newRelation.source_ref,
                                        target_ref: newRelation.target_ref,
                                        relationship_type: newRelation.relationship_type,
                                    };
                                    if ((newRelation as any).confidence !== undefined) relPayload.confidence = (newRelation as any).confidence;
                                    await apiService.createRelation(relPayload);
                                    setNewRelation({ source_ref: '', relationship_type: 'attributed-to', target_ref: '' });
                                    setGraphMode('view');
                                    fetchGraph(initialActorId);
                                } catch (err) {
                                    console.error('Failed to create relation:', err);
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />} Save
                        </button>
                    </div>
                    </>
                )}

                {/* ── EDIT RELATION FORM ── */}
                {graphMode === 'edit-relation' && editingRelation && (
                    <>
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full bg-amber-500/5 flex items-center gap-1">
                                <Pencil size={12} /> Editing
                            </span>
                            <button onClick={() => { setGraphMode('view'); setEditingRelation(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Edit Relation</h2>
                        <p className="text-xs text-slate-500 mt-1">Modify the connection between entities.</p>
                    </div>
                    <div className="flex-1 p-6 space-y-5 overflow-y-auto">
                        {/* Source */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Source *</label>
                            <select value={newRelation.source_ref} onChange={(e) => setNewRelation(prev => ({ ...prev, source_ref: e.target.value }))}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                <option value="">Select source entity...</option>
                                {allEntities.map((e) => (
                                    <option key={e.stixId} value={e.stixId}>{NODE_CONFIG[e.type]?.label || e.type}: {e.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* Relation Type */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Relation Type *</label>
                            <select value={newRelation.relationship_type} onChange={(e) => setNewRelation(prev => ({ ...prev, relationship_type: e.target.value }))}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                {['attributed-to', 'pursues', 'executes', 'uses', 'deploys', 'generates', 'evaluates', 'associated-with', 'targets', 'indicates', 'mitigates', 'controls', 'sponsors', 'integrates'].map(rt => (
                                    <option key={rt} value={rt}>{rt}</option>
                                ))}
                            </select>
                        </div>
                        {/* Target */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Target *</label>
                            <select value={newRelation.target_ref} onChange={(e) => setNewRelation(prev => ({ ...prev, target_ref: e.target.value }))}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                <option value="">Select target entity...</option>
                                {allEntities.filter(e => e.stixId !== newRelation.source_ref).map((e) => (
                                    <option key={e.stixId} value={e.stixId}>{NODE_CONFIG[e.type]?.label || e.type}: {e.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* Confidence */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Confidence (0-100)</label>
                            <input type="number" min="0" max="100" value={(newRelation as any).confidence ?? ''} onChange={(e) => setNewRelation(prev => ({ ...prev, confidence: e.target.value ? parseInt(e.target.value) : undefined } as any))}
                                placeholder="e.g. 85"
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400" />
                        </div>
                        {/* Visual preview */}
                        {newRelation.source_ref && newRelation.target_ref && (
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preview</p>
                                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                    <span className="font-semibold truncate max-w-[120px]">{allEntities.find(e => e.stixId === newRelation.source_ref)?.name}</span>
                                    <span className="text-amber-500 font-mono shrink-0">&mdash;{newRelation.relationship_type}&rarr;</span>
                                    <span className="font-semibold truncate max-w-[120px]">{allEntities.find(e => e.stixId === newRelation.target_ref)?.name}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Save / Cancel footer */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 mt-auto shrink-0">
                        <button onClick={() => { setGraphMode('view'); setEditingRelation(null); }}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm text-sm font-semibold transition-colors text-slate-700 dark:text-slate-300">
                            <ArrowLeft size={16} /> Cancel
                        </button>
                        <button
                            disabled={!newRelation.source_ref || !newRelation.target_ref || saving}
                            onClick={async () => {
                                try {
                                    setSaving(true);
                                    const payload: any = {
                                        source_ref: newRelation.source_ref,
                                        target_ref: newRelation.target_ref,
                                        relationship_type: newRelation.relationship_type,
                                    };
                                    if ((newRelation as any).confidence !== undefined) payload.confidence = (newRelation as any).confidence;
                                    await apiService.updateRelation(editingRelation.id, payload);
                                    setNewRelation({ source_ref: '', relationship_type: 'attributed-to', target_ref: '' });
                                    setEditingRelation(null);
                                    setHighlightedRelationId(null);
                                    setGraphMode('view');
                                    await fetchGraph(initialActorId);
                                    await refreshAllEntities();
                                } catch (err) {
                                    console.error('Failed to update relation:', err);
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />} Save Changes
                        </button>
                    </div>
                    </>
                )}

                {/* ── EDIT ENTITY FORM ── */}
                {graphMode === 'edit-entity' && editingEntity && (
                    <>
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full bg-amber-500/5 flex items-center gap-1">
                                <Pencil size={12} /> Editing
                            </span>
                            <button onClick={() => { setGraphMode('view'); setEditingEntity(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Edit Entity</h2>
                        <p className="text-xs text-slate-500 mt-1">Modify {NODE_CONFIG[editingEntity.type]?.label || editingEntity.type}: <span className="font-semibold text-slate-700 dark:text-slate-300">{editingEntity.name}</span></p>
                    </div>
                    <div className="flex-1 p-6 space-y-5 overflow-y-auto">
                        {/* Name */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Name *</label>
                            <input
                                type="text"
                                value={editEntityForm.name || ''}
                                onChange={(e) => setEditEntityForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            />
                        </div>
                        {/* Description */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Description</label>
                            <textarea
                                value={editEntityForm.description || ''}
                                onChange={(e) => setEditEntityForm(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                            />
                        </div>
                        {/* First Seen / Last Seen */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">First Seen</label>
                                <input type="date" value={editEntityForm.first_seen || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, first_seen: e.target.value }))}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Last Seen</label>
                                <input type="date" value={editEntityForm.last_seen || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, last_seen: e.target.value }))}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                            </div>
                        </div>
                        {/* Confidence */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Confidence (0-100)</label>
                            <input type="number" min="0" max="100" value={editEntityForm.confidence ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, confidence: e.target.value ? parseInt(e.target.value) : undefined }))}
                                placeholder="e.g. 85"
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400" />
                        </div>

                        {/* Dynamic GSCI fields based on entity type */}
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Type-specific Attributes</label>

                            {editingEntity.type === 'x-geo-strategic-actor' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Strategic Alignment *</label>
                                        <select value={editEntityForm.strategic_alignment || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, strategic_alignment: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>NATO</option><option>BRICS</option><option>EU</option><option>Non-Aligned</option><option>Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Geopolitical Doctrine</label>
                                        <input type="text" value={editEntityForm.geopolitical_doctrine || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, geopolitical_doctrine: e.target.value }))}
                                            placeholder="e.g. Neo-Eurasianist expansionism"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Revisionist Index (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.revisionist_index ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, revisionist_index: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Strategic Ambiguity Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.strategic_ambiguity_score ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, strategic_ambiguity_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Doctrine Type</label>
                                        <select value={editEntityForm.doctrine_type || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, doctrine_type: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>Stability-Oriented</option><option>status-quo</option><option>revisionist</option><option>expansionist</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Technological Modernization Rate (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.technological_modernization_rate ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, technological_modernization_rate: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                </div>
                            )}

                            {editingEntity.type === 'x-strategic-objective' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Objective Type *</label>
                                        <select value={editEntityForm.objective_type || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, objective_type: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>political</option><option>military</option><option>economic</option><option>societal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Priority Level</label>
                                        <select value={editEntityForm.priority_level || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, priority_level: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>critical</option><option>high</option><option>medium</option><option>low</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Time Horizon</label>
                                        <select value={editEntityForm.time_horizon || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, time_horizon: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>short-term</option><option>medium-term</option><option>long-term</option><option>decadal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Civil-Military Fusion</label>
                                        <select value={editEntityForm.civil_military_fusion === true ? 'true' : editEntityForm.civil_military_fusion === false ? 'false' : ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, civil_military_fusion: e.target.value === '' ? undefined : e.target.value === 'true' }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option value="true">Yes</option><option value="false">No</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {editingEntity.type === 'x-hybrid-campaign' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Phase *</label>
                                        <select value={editEntityForm.phase || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, phase: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>pre-conflict</option><option>escalation</option><option>sustained-pressure</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Integration Level</label>
                                        <input type="text" value={editEntityForm.integration_level || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, integration_level: e.target.value }))} placeholder="e.g. high"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Geographic Scope</label>
                                        <input type="text" value={editEntityForm.geographic_scope || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, geographic_scope: e.target.value }))} placeholder="e.g. Eastern Europe"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Escalation Risk Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.escalation_risk_score ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, escalation_risk_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Velocity</label>
                                        <select value={editEntityForm.velocity || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, velocity: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>fast-spike</option><option>slow-drift</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Nature (comma-separated)</label>
                                        <input type="text" value={Array.isArray(editEntityForm.nature) ? editEntityForm.nature.join(', ') : editEntityForm.nature || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, nature: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} placeholder="e.g. cyber, economic, diplomatic"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                </div>
                            )}

                            {editingEntity.type === 'x-influence-vector' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Narrative *</label>
                                        <textarea value={editEntityForm.narrative || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, narrative: e.target.value }))} rows={2} placeholder="Key narrative"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400 resize-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Channel</label>
                                        <input type="text" value={editEntityForm.channel || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, channel: e.target.value }))} placeholder="e.g. social-media"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Target Audience</label>
                                        <input type="text" value={editEntityForm.target_audience || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, target_audience: e.target.value }))} placeholder="e.g. Baltic civilian population"
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400" />
                                    </div>
                                </div>
                            )}

                            {editingEntity.type === 'x-strategic-impact' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Political Destabilization Index (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.political_destabilization_index ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, political_destabilization_index: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Economic Disruption Index (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.economic_disruption_index ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, economic_disruption_index: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Alliance Fragmentation Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.alliance_fragmentation_score ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, alliance_fragmentation_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Deterrence Signal Strength (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.deterrence_signal_strength ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, deterrence_signal_strength: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                </div>
                            )}

                            {editingEntity.type === 'x-strategic-assessment' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Hybrid Pressure Index (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.hybrid_pressure_index ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, hybrid_pressure_index: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Escalation Probability Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.escalation_probability_score ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, escalation_probability_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Strategic Signaling Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.strategic_signaling_score ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, strategic_signaling_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Cyber-Geopolitical Coupling Index (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.cyber_geopolitical_coupling_index ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, cyber_geopolitical_coupling_index: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Narrative Penetration Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.narrative_penetration_score ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, narrative_penetration_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Doctrine-Capacity Divergence Score (0-10)</label>
                                        <input type="number" step="0.1" min="0" max="10" value={editEntityForm.doctrine_capacity_divergence_score ?? ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, doctrine_capacity_divergence_score: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                    </div>
                                </div>
                            )}

                            {(editingEntity.type === 'intrusion-set' || editingEntity.type === 'threat-actor') && (
                                <div className="space-y-4">
                                    {/* OpenCTI Linkage */}
                                    <div className={cn(
                                        "p-3 rounded-lg border",
                                        editEntityForm._openctiInternalId
                                            ? "bg-emerald-500/5 border-emerald-500/20"
                                            : "bg-amber-500/5 border-amber-500/20"
                                    )}>
                                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            {editEntityForm._openctiInternalId ? (
                                                <><ExternalLink size={12} className="text-emerald-500" /> <span className="text-emerald-600 dark:text-emerald-400">Linked to OpenCTI</span></>
                                            ) : (
                                                <><AlertTriangle size={12} className="text-amber-500" /> <span className="text-amber-600 dark:text-amber-400">Not linked to OpenCTI</span></>
                                            )}
                                        </label>
                                        <select
                                            value={editEntityForm._openctiInternalId || ''}
                                            onChange={(e) => {
                                                const selected = openctiEntities.find(ent => ent.metadata?.openctiInternalId === e.target.value);
                                                setEditEntityForm(prev => ({
                                                    ...prev,
                                                    _openctiInternalId: e.target.value || '',
                                                    ...(selected ? { name: selected.name } : {}),
                                                }));
                                            }}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                        >
                                            <option value="">No linkage (manual entity)</option>
                                            {openctiEntities.filter(ent => ent.metadata?.openctiInternalId).map(ent => (
                                                <option key={ent.metadata!.openctiInternalId} value={ent.metadata!.openctiInternalId}>
                                                    {ent.name} ({ent.metadata!.openctiInternalId!.substring(0, 8)}...)
                                                </option>
                                            ))}
                                        </select>
                                        {editEntityForm._openctiInternalId && (
                                            <p className="text-[10px] text-slate-400 font-mono mt-1.5 truncate">ID: {editEntityForm._openctiInternalId}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Resource Level</label>
                                        <select value={editEntityForm.resource_level || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, resource_level: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>individual</option><option>club</option><option>contest</option><option>team</option><option>organization</option><option>government</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Primary Motivation</label>
                                        <select value={editEntityForm.primary_motivation || ''} onChange={(e) => setEditEntityForm(prev => ({ ...prev, primary_motivation: e.target.value }))}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
                                            <option value="">Select...</option>
                                            <option>accidental</option><option>coercion</option><option>dominance</option><option>ideology</option><option>notoriety</option><option>organizational-gain</option><option>personal-gain</option><option>personal-satisfaction</option><option>revenge</option><option>unpredictable</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Save / Cancel footer */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 mt-auto shrink-0">
                        <button onClick={() => { setGraphMode('view'); setEditingEntity(null); }}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm text-sm font-semibold transition-colors text-slate-700 dark:text-slate-300">
                            <ArrowLeft size={16} /> Cancel
                        </button>
                        <button
                            disabled={!editEntityForm.name || saving}
                            onClick={async () => {
                                try {
                                    setSaving(true);
                                    const { name, description, confidence, first_seen, last_seen, resource_level, primary_motivation, _openctiInternalId, ...gsciFields } = editEntityForm;
                                    const payload: any = { name };
                                    if (description) payload.description = description;
                                    if (confidence !== undefined && confidence !== '') payload.confidence = confidence;
                                    if (first_seen) payload.first_seen = first_seen.includes('T') ? first_seen : first_seen + 'T00:00:00Z';
                                    if (last_seen) payload.last_seen = last_seen.includes('T') ? last_seen : last_seen + 'T00:00:00Z';
                                    if (resource_level) payload.resource_level = resource_level;
                                    if (primary_motivation) payload.primary_motivation = primary_motivation;

                                    // Send OpenCTI linkage if present
                                    if (_openctiInternalId !== undefined) {
                                        payload.metadata = { openctiInternalId: _openctiInternalId || null };
                                    }

                                    // Build gsciAttributes from remaining fields, including dates for consistency
                                    const cleanGsci = Object.fromEntries(
                                        Object.entries(gsciFields).filter(([k, v]) => v !== '' && v !== undefined && v !== null && !k.startsWith('_'))
                                    );
                                    if (first_seen) cleanGsci.first_seen = payload.first_seen;
                                    if (last_seen) cleanGsci.last_seen = payload.last_seen;
                                    if (Object.keys(cleanGsci).length > 0) {
                                        payload.gsciAttributes = cleanGsci;
                                    }

                                    await apiService.updateEntity(editingEntity.stixId, payload);
                                    setEditingEntity(null);
                                    setEditEntityForm({});
                                    setHighlightedConnectionId(null);
                                    setGraphMode('view');
                                    await fetchGraph(initialActorId);
                                    await refreshAllEntities();
                                } catch (err) {
                                    console.error('Failed to update entity:', err);
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />} Save Changes
                        </button>
                    </div>
                    </>
                )}

                {/* ── VIEW MODE: Original panel ── */}
                {graphMode === 'view' && rootActor && (
                <>
                    {/* Header — always shows the root Geo-Strategic Actor */}
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-500 border border-cyan-500/20 px-2 py-0.5 rounded-full bg-cyan-500/5">
                                {NODE_CONFIG[rootActor.type]?.label || rootActor.type}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => {
                                        const e = rootActor;
                                        setEditingEntity(e);
                                        setEditEntityForm({
                                            ...(e.gsciAttributes || {}),
                                            name: e.name || '',
                                            description: e.description || '',
                                            confidence: e.confidence,
                                            first_seen: (e.first_seen || e.gsciAttributes?.first_seen || '').split('T')[0],
                                            last_seen: (e.last_seen || e.gsciAttributes?.last_seen || '').split('T')[0],
                                            resource_level: e.resource_level || '',
                                            primary_motivation: e.primary_motivation || '',
                                            _openctiInternalId: e.metadata?.openctiInternalId || '',
                                        });
                                        if (e.type === 'intrusion-set' || e.type === 'threat-actor') {
                                            apiService.getEntitiesByType(e.type).then(setOpenctiEntities).catch(() => setOpenctiEntities([]));
                                        } else {
                                            setOpenctiEntities([]);
                                        }
                                        setGraphMode('edit-entity');
                                    }}
                                    className="p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded transition-colors"
                                    title="Edit entity"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button onClick={() => setPanelVisible(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-slate-900 shadow-sm border border-slate-700 flex items-center justify-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d={NODE_CONFIG[rootActor.type]?.path || 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'} />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{rootActor.name}</h2>
                                <p className="text-xs text-slate-500 font-mono break-all">{rootActor.stixId}</p>
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
                        {(rootActor.type === 'intrusion-set' || rootActor.type === 'threat-actor') && (
                            <div>
                                <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    Tactical Linkage (OpenCTI)
                                </h3>
                                <div className={cn(
                                    "bg-white dark:bg-slate-800 rounded-lg p-4 text-sm shadow-sm",
                                    rootActor.metadata?.openctiInternalId
                                        ? "border border-slate-200 dark:border-slate-700"
                                        : "border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/5"
                                )}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <Bug className="text-slate-400" size={16} />
                                            <span className="font-bold text-slate-800 dark:text-white">{rootActor.name}</span>
                                        </div>
                                        {rootActor.metadata?.openctiInternalId ? (
                                            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                                                <ExternalLink size={9} /> Linked
                                            </span>
                                        ) : (
                                            <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                                <AlertTriangle size={10} /> Unlinked
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                                        {rootActor.metadata?.openctiInternalId
                                            ? (rootActor.description || 'Linked threat actor from OpenCTI platform.')
                                            : 'This entity is not linked to any OpenCTI record. It was created manually or ingested without an OpenCTI identifier.'
                                        }
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700">
                                            <span className="block text-[10px] text-slate-400 mb-0.5">Source</span>
                                            <span className={cn(
                                                "font-mono font-semibold",
                                                rootActor.metadata?.openctiInternalId
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-amber-600 dark:text-amber-400"
                                            )}>
                                                {rootActor.metadata?.openctiInternalId ? 'OpenCTI' : 'Manual / GSCIX'}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700">
                                            <span className="block text-[10px] text-slate-400 mb-0.5">Last Seen</span>
                                            <span className="font-mono text-slate-700 dark:text-slate-300">
                                                {rootActor.gsciAttributes?.last_seen ? new Date(rootActor.gsciAttributes.last_seen).toLocaleDateString() : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const base = openctiBaseUrl || 'http://localhost:8080';
                                            const openctiId = rootActor.metadata?.openctiInternalId;
                                            const dashPath = rootActor.type === 'intrusion-set'
                                                ? 'threats/intrusion_sets'
                                                : 'threats/threat_actors_individual';
                                            const url = openctiId
                                                ? `${base}/dashboard/${dashPath}/${openctiId}`
                                                : `${base}/dashboard/search/${encodeURIComponent(rootActor.name)}`;
                                            window.open(url, '_blank', 'noopener,noreferrer');
                                        }}
                                        className={cn(
                                            "w-full py-2 text-xs font-semibold rounded-md transition-all shadow-sm flex items-center justify-center gap-1",
                                            rootActor.metadata?.openctiInternalId
                                                ? "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-cyan-500 hover:text-cyan-500 text-slate-600 dark:text-slate-400"
                                                : "bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                        )}
                                    >
                                        {rootActor.metadata?.openctiInternalId
                                            ? <><ExternalLink size={12} /> View in OpenCTI</>
                                            : <><AlertTriangle size={12} /> Search in OpenCTI</>
                                        }
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
                                                    setHighlightedRelationId(null);
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
                                                        {(nodeEntity.type === 'intrusion-set' || nodeEntity.type === 'threat-actor') && !nodeEntity.metadata?.openctiInternalId && (
                                                            <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded" title="Not linked to OpenCTI — entity was created manually or the OpenCTI ID is missing">
                                                                <AlertTriangle size={10} /> Unlinked
                                                            </span>
                                                        )}
                                                        {(nodeEntity.type === 'intrusion-set' || nodeEntity.type === 'threat-actor') && nodeEntity.metadata?.openctiInternalId && (
                                                            <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded" title="Linked to OpenCTI">
                                                                <ExternalLink size={9} /> Linked
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isHighlighted && (
                                                        <div className="flex items-center gap-1 ml-auto shrink-0">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingEntity(nodeEntity);
                                                                    setEditEntityForm({
                                                                        ...(nodeEntity.gsciAttributes || {}),
                                                                        name: nodeEntity.name || '',
                                                                        description: nodeEntity.description || '',
                                                                        confidence: nodeEntity.confidence,
                                                                        first_seen: (nodeEntity.first_seen || nodeEntity.gsciAttributes?.first_seen || '').split('T')[0],
                                                                        last_seen: (nodeEntity.last_seen || nodeEntity.gsciAttributes?.last_seen || '').split('T')[0],
                                                                        resource_level: nodeEntity.resource_level || '',
                                                                        primary_motivation: nodeEntity.primary_motivation || '',
                                                                        _openctiInternalId: nodeEntity.metadata?.openctiInternalId || '',
                                                                    });
                                                                    if (nodeEntity.type === 'intrusion-set' || nodeEntity.type === 'threat-actor') {
                                                                        apiService.getEntitiesByType(nodeEntity.type).then(setOpenctiEntities).catch(() => setOpenctiEntities([]));
                                                                    } else {
                                                                        setOpenctiEntities([]);
                                                                    }
                                                                    setGraphMode('edit-entity');
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded transition-colors"
                                                                title="Edit entity"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            {nodeEntity.stixId !== rootActor?.stixId && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const impact = computeCascadeImpact(nodeEntity.stixId);
                                                                        setDeleteTarget({
                                                                            entity: nodeEntity,
                                                                            childCount: impact.entityCount - 1,
                                                                            relationCount: impact.relationCount,
                                                                        });
                                                                    }}
                                                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                                                                    title="Delete entity"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
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
                                                            {nodeEntity.type === 'x-strategic-assessment' && nodeEntity.gsciAttributes?.hybrid_pressure_index !== undefined && (
                                                                <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                    <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">HPI Index</span>
                                                                    <span className="text-[10px] text-cyan-400 font-bold font-mono">{(nodeEntity.gsciAttributes.hybrid_pressure_index ?? 0).toFixed(1)}</span>
                                                                </div>
                                                            )}
                                                            {nodeEntity.confidence != null && (
                                                                <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                    <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Confidence</span>
                                                                    <span className="text-[10px] text-emerald-400 font-bold font-mono">{nodeEntity.confidence}%</span>
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

                                                            {/* Custom Attributes for Strategic Objective */}
                                                            {nodeEntity.type === 'x-strategic-objective' && (
                                                                <>
                                                                    {nodeEntity.gsciAttributes?.objective_type && (
                                                                        <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Objective Type</span>
                                                                            <span className="text-[10px] text-violet-400 font-bold capitalize">{nodeEntity.gsciAttributes.objective_type}</span>
                                                                        </div>
                                                                    )}
                                                                    {nodeEntity.gsciAttributes?.priority_level && (
                                                                        <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Priority</span>
                                                                            <span className={cn(
                                                                                "text-[10px] font-bold capitalize",
                                                                                nodeEntity.gsciAttributes.priority_level === 'critical' ? 'text-red-400'
                                                                                    : nodeEntity.gsciAttributes.priority_level === 'high' ? 'text-orange-400'
                                                                                    : nodeEntity.gsciAttributes.priority_level === 'medium' ? 'text-amber-400'
                                                                                    : 'text-slate-400'
                                                                            )}>{nodeEntity.gsciAttributes.priority_level}</span>
                                                                        </div>
                                                                    )}
                                                                    {nodeEntity.gsciAttributes?.time_horizon && (
                                                                        <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Time Horizon</span>
                                                                            <span className="text-[10px] text-sky-400 font-bold capitalize">{nodeEntity.gsciAttributes.time_horizon}</span>
                                                                        </div>
                                                                    )}
                                                                    {nodeEntity.gsciAttributes?.civil_military_fusion != null && (
                                                                        <div className="bg-slate-900/40 p-1.5 rounded border border-slate-700/50">
                                                                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">Civil-Military Fusion</span>
                                                                            <span className={cn(
                                                                                "text-[10px] font-bold",
                                                                                nodeEntity.gsciAttributes.civil_military_fusion ? 'text-rose-400' : 'text-slate-500'
                                                                            )}>{nodeEntity.gsciAttributes.civil_military_fusion ? 'Yes' : 'No'}</span>
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
                                                                className={cn(
                                                                    "w-full py-1.5 text-[10px] font-bold rounded transition-colors uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5",
                                                                    nodeEntity.metadata?.openctiInternalId
                                                                        ? "bg-slate-700 hover:bg-slate-600 text-white"
                                                                        : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                                                )}
                                                            >
                                                                {nodeEntity.metadata?.openctiInternalId
                                                                    ? <><ExternalLink size={11} /> View in OpenCTI</>
                                                                    : <><AlertTriangle size={11} /> Search in OpenCTI</>
                                                                }
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>

                        {/* ── Connections (Relations) ── */}
                        <div className="mt-6">
                            <h3
                                onClick={() => setConnectionsCollapsed(prev => !prev)}
                                className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors select-none"
                            >
                                <span className="flex items-center gap-1.5">
                                    {connectionsCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                    <GitBranch size={12} /> Connections
                                </span>
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{graphData.links.length}</span>
                            </h3>
                            {!connectionsCollapsed && <ul className="space-y-2">
                                {graphData.links.map((link: any) => {
                                    const sourceEntity = entities.find(e => e.stixId === (typeof link.source === 'object' ? link.source.id : link.source));
                                    const targetEntity = entities.find(e => e.stixId === (typeof link.target === 'object' ? link.target.id : link.target));
                                    if (!sourceEntity || !targetEntity) return null;
                                    const isRelHighlighted = highlightedRelationId === link.id;

                                    return (
                                        <li key={link.id}
                                            id={`rel-${link.id}`}
                                            className={cn(
                                                "flex flex-col rounded-lg border transition-all duration-300 cursor-pointer overflow-hidden",
                                                isRelHighlighted
                                                    ? "bg-slate-50 dark:bg-slate-800 border-cyan-500 dark:border-cyan-500"
                                                    : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-cyan-500/50"
                                            )}
                                            onClick={() => {
                                                const newId = isRelHighlighted ? null : link.id;
                                                setHighlightedRelationId(newId);
                                                setHighlightedConnectionId(null);
                                                if (newId) {
                                                    setTimeout(() => {
                                                        document.getElementById(`rel-${link.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                                    }, 50);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center justify-between text-xs p-2.5 gap-2">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className={cn(
                                                        "shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                                                        isRelHighlighted
                                                            ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30"
                                                            : "bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600/50"
                                                    )}>
                                                        {link.relType}
                                                    </span>
                                                    <div className="flex items-center gap-1 min-w-0 text-[10px]">
                                                        <span className={cn("truncate max-w-[80px] font-medium", isRelHighlighted ? "text-cyan-700 dark:text-cyan-300" : "text-slate-700 dark:text-slate-300")}>
                                                            {sourceEntity.name}
                                                        </span>
                                                        <span className="text-slate-400 dark:text-slate-500 shrink-0">&rarr;</span>
                                                        <span className={cn("truncate max-w-[80px] font-medium", isRelHighlighted ? "text-cyan-700 dark:text-cyan-300" : "text-slate-700 dark:text-slate-300")}>
                                                            {targetEntity.name}
                                                        </span>
                                                    </div>
                                                    {link.relation?.confidence != null && (
                                                        <span className="text-[9px] text-emerald-400 font-mono shrink-0">{link.relation.confidence}%</span>
                                                    )}
                                                </div>
                                                {isRelHighlighted && (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingRelation(link.relation);
                                                                setNewRelation({
                                                                    source_ref: link.relation.source_ref,
                                                                    relationship_type: link.relation.relationship_type,
                                                                    target_ref: link.relation.target_ref,
                                                                    confidence: link.relation.confidence,
                                                                } as any);
                                                                setGraphMode('edit-relation');
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded transition-colors"
                                                            title="Edit relation"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeleteRelationTarget(link.relation);
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                                                            title="Delete relation"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>}
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
                </>
                )}
                </aside>
            )
            }
        </div >
    );
};
