import { useState, useMemo, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Code } from 'lucide-react';
import { paintNode, paintLinkLabel } from './graphUtils';

interface IngestionGraphPreviewProps {
    jsonContent: string;
}

export interface IngestionGraphPreviewHandle {
    zoomIn: () => void;
    zoomOut: () => void;
    zoomToFit: () => void;
}

interface GraphNode {
    id: string;
    name: string;
    type: string;
    val: number;
    entity: any;
}

interface GraphLink {
    source: string;
    target: string;
    relType: string;
}

const IngestionGraphPreview = forwardRef<IngestionGraphPreviewHandle, IngestionGraphPreviewProps>(({ jsonContent }, ref) => {
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const engineStoppedOnce = useRef(false);
    const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

    useImperativeHandle(ref, () => ({
        zoomIn: () => {
            if (graphRef.current) {
                const currentZoom = graphRef.current.zoom();
                graphRef.current.zoom(currentZoom * 1.4, 300);
            }
        },
        zoomOut: () => {
            if (graphRef.current) {
                const currentZoom = graphRef.current.zoom();
                graphRef.current.zoom(currentZoom / 1.4, 300);
            }
        },
        zoomToFit: () => {
            if (graphRef.current) {
                graphRef.current.zoomToFit(400, 80);
            }
        },
    }), []);

    // Measure container with ResizeObserver for accurate canvas dimensions
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const obs = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) setDimensions({ width, height });
        });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    // Parse JSON content into graph nodes and links
    const { nodes, links, rootId } = useMemo(() => {
        if (!jsonContent) return { nodes: [] as GraphNode[], links: [] as GraphLink[], rootId: null as string | null };

        try {
            const bundle = JSON.parse(jsonContent);
            const objects: any[] = bundle?.objects || [];

            const entities: GraphNode[] = [];
            const relations: GraphLink[] = [];
            const entityIds = new Set<string>();
            let detectedRootId: string | null = null;

            for (const obj of objects) {
                if (obj.type === 'relationship') {
                    relations.push({
                        source: obj.source_ref,
                        target: obj.target_ref,
                        relType: obj.relationship_type || 'related-to',
                    });
                } else if (obj.id && obj.name) {
                    entityIds.add(obj.id);
                    entities.push({
                        id: obj.id,
                        name: obj.name,
                        type: obj.type,
                        val: obj.type === 'x-geo-strategic-actor' ? 20 : obj.type === 'x-strategic-objective' ? 12 : 8,
                        entity: obj,
                    });
                    if (obj.type === 'x-geo-strategic-actor' && !detectedRootId) {
                        detectedRootId = obj.id;
                    }
                }
            }

            const validLinks = relations.filter(l => entityIds.has(l.source) && entityIds.has(l.target));
            return { nodes: entities, links: validLinks, rootId: detectedRootId };
        } catch {
            return { nodes: [] as GraphNode[], links: [] as GraphLink[], rootId: null as string | null };
        }
    }, [jsonContent]);

    // Reset engine-stopped flag when data changes
    useEffect(() => {
        engineStoppedOnce.current = false;
    }, [nodes]);

    // Configure d3 forces for proper spacing
    useEffect(() => {
        if (graphRef.current && nodes.length > 0) {
            graphRef.current.d3Force('link')?.distance(120);
            graphRef.current.d3Force('charge')?.strength(-350).distanceMax(500);
            graphRef.current.d3Force('center')?.strength(0.05);
        }
    }, [nodes]);

    // Fit all nodes into view, then center on root if it exists
    const handleEngineStop = useCallback(() => {
        if (!graphRef.current || engineStoppedOnce.current) return;
        engineStoppedOnce.current = true;

        // Step 1: fit all nodes with generous padding so nothing is clipped
        graphRef.current.zoomToFit(400, 80);

        // Step 2: after fit animation settles, center on root if available
        if (rootId) {
            setTimeout(() => {
                if (!graphRef.current) return;
                const rootNode = graphRef.current.graphData().nodes.find((n: any) => n.id === rootId);
                if (rootNode && Number.isFinite(rootNode.x) && Number.isFinite(rootNode.y)) {
                    graphRef.current.centerAt(rootNode.x, rootNode.y, 500);
                }
            }, 450);
        }
    }, [rootId]);

    const paintNodeCb = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        paintNode(node, ctx, globalScale);
    }, []);

    const paintLinkCb = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        paintLinkLabel(link, ctx, globalScale);
    }, []);

    // Empty state
    if (nodes.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 cursor-default select-none min-h-[400px]">
                <Code size={48} className="mb-4" />
                <p>No graph to preview</p>
                <p className="text-xs mt-1 italic">Drop or select a JSON file to visualize its graph</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full min-h-[500px]" style={{ background: '#030712', height: '100%' }}>
            <ForceGraph2D
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={{ nodes, links }}
                nodeId="id"
                nodeCanvasObject={paintNodeCb}
                nodeCanvasObjectMode={() => 'replace'}
                linkColor={() => 'rgba(148,163,184,0.4)'}
                linkWidth={() => 1.8}
                linkDirectionalArrowLength={7}
                linkDirectionalArrowRelPos={0.85}
                linkDirectionalArrowColor={() => 'rgba(148,163,184,0.6)'}
                linkLineDash={() => [4, 2]}
                linkCanvasObjectMode={() => 'after'}
                linkCanvasObject={paintLinkCb}
                enableNodeDrag={true}
                enableZoomInteraction={false}
                enablePanInteraction={true}
                cooldownTicks={200}
                warmupTicks={50}
                backgroundColor="rgba(0,0,0,0)"
                nodeRelSize={6}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
                onEngineStop={handleEngineStop}
            />
        </div>
    );
});

IngestionGraphPreview.displayName = 'IngestionGraphPreview';

export default IngestionGraphPreview;
