// ─── Shared graph rendering utilities ─────────────────────────────────────────
// Used by GeoStrategicInfluenceGraph and IngestionGraphPreview

export interface NodeConfig {
    color: string;
    border: string;
    path: string;
    label: string;
}

export const NODE_CONFIG: Record<string, NodeConfig> = {
    'x-geo-strategic-actor': { color: '#06b6d4', border: '#0891b2', path: 'M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z', label: 'Geo-Strategic Actor' },
    'x-strategic-objective': { color: '#f59e0b', border: '#d97706', path: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7', label: 'Strategic Objective' },
    'x-hybrid-campaign': { color: '#ef4444', border: '#dc2626', path: 'm3 11 18-5v12L3 14v-3z M11.6 16.8a3 3 0 1 1-5.8-1.6', label: 'Hybrid Campaign' },
    'x-influence-vector': { color: '#8b5cf6', border: '#7c3aed', path: 'M4.9 19.1C1 15.2 1 8.8 4.9 4.9 M19.1 4.9c3.9 3.9 3.9 10.2 0 14.1 M8.5 15.5c-1.9-1.9-1.9-5.1 0-7 M15.5 8.5c1.9 1.9 1.9 5.1 0 7 M12 12h.01', label: 'Influence Vector' },
    'x-strategic-impact': { color: '#6366f1', border: '#4f46e5', path: 'M12 3v18 M3 7h18 M3 7l-2 9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2z M15 7l-2 9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2z', label: 'Strategic Impact' },
    'x-strategic-assessment': { color: '#10b981', border: '#059669', path: 'M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3', label: 'Strategic Assessment' },
    'intrusion-set': { color: '#64748b', border: '#475569', path: 'M12 2L2 7l10 5l10-5L12 2z M2 17l10 5l10-5 M2 12l10 5l10-5', label: 'Intrusion Set' },
    'threat-actor': { color: '#94a3b8', border: '#64748b', path: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 7a4 4 0 1 0 0-8a4 4 0 0 0 0 8z', label: 'Threat Actor' },
};

const DEFAULT_CFG: NodeConfig = { color: '#64748b', border: '#475569', path: '', label: 'Unknown' };

/**
 * Paint a node on a canvas — shared renderer for all graph views.
 * `options.isSelected` and `options.isHighlighted` control glow effects.
 */
export function paintNode(
    node: any,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
    options?: { isSelected?: boolean; isHighlighted?: boolean },
) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;

    const cfg = NODE_CONFIG[node.type] || DEFAULT_CFG;
    const r = 12;
    const isSelected = options?.isSelected ?? false;
    const isHighlighted = options?.isHighlighted ?? false;

    // Outer glow
    if (isSelected || isHighlighted) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 8, 0, 2 * Math.PI);
        ctx.fillStyle = cfg.color + '30';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
        ctx.fillStyle = cfg.color + '15';
        ctx.fill();
    }

    // Main circle background
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Radial gradient fill
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
    gradient.addColorStop(0, cfg.color + '40');
    gradient.addColorStop(1, cfg.color + '10');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Outline stroke
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icon path
    if (cfg.path) {
        const boxSize = r * 1.1;
        const scale = boxSize / 24;
        ctx.save();
        ctx.translate(node.x - boxSize / 2, node.y - boxSize / 2);
        ctx.scale(scale, scale);
        ctx.lineWidth = 1.6 / scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#ffffff';
        ctx.stroke(new Path2D(cfg.path));
        ctx.restore();
    }

    // Label
    if (globalScale > 0.4) {
        const label = node.name.length > 25 ? node.name.substring(0, 23) + '…' : node.name;
        const labelFontSize = Math.max(4, 11 / globalScale);
        ctx.font = `600 ${labelFontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelY = node.y + r + 6;

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 3 / globalScale;
        ctx.lineJoin = 'round';
        ctx.strokeText(label, node.x, labelY);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, node.x, labelY);
    }
}

/**
 * Paint a link label on a canvas — shared renderer for all graph views.
 */
export function paintLinkLabel(
    link: any,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
    isHighlighted?: boolean,
) {
    if (globalScale < 0.4) return;
    const label = link.relType;
    if (!label) return;

    const source = link.source;
    const target = link.target;
    if (!source || !target) return;
    if (!Number.isFinite(source.x) || !Number.isFinite(target.x)) return;

    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;

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

    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, borderRadius);
    ctx.fillStyle = isHighlighted ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.85)';
    ctx.fill();
    ctx.strokeStyle = isHighlighted ? 'rgba(6, 182, 212, 0.8)' : 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = (isHighlighted ? 1.5 : 1) / globalScale;
    ctx.stroke();

    ctx.fillStyle = isHighlighted ? 'rgba(6, 182, 212, 1)' : 'rgba(203, 213, 225, 0.95)';
    ctx.fillText(label, midX, midY);
}
