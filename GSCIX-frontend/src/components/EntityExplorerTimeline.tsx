import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Loader2,
    AlertCircle,
    Clock,
    Globe,
    Shield,
    Activity,
    GitBranch,
    RefreshCw,
    Info,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Maximize2,
    Layers,
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
    'intrusion-set': 'Intrusion Set',
    'threat-actor': 'Threat Actor',
};

const GEO_LANE_TYPES = new Set([
    'x-geo-strategic-actor', 'x-strategic-objective', 'x-hybrid-campaign',
    'x-influence-vector', 'x-strategic-impact', 'x-strategic-assessment',
]);

const CYBER_LANE_TYPES = new Set(['intrusion-set', 'threat-actor']);

const TYPE_COLOR: Record<string, { border: string; text: string; bg: string; connector: string }> = {
    'x-geo-strategic-actor':    { border: 'border-primary dark:border-primary',        text: 'text-primary',                          bg: 'bg-cyan-50 dark:bg-cyan-950/30',      connector: '#06b6d4' },
    'x-strategic-objective':    { border: 'border-amber-400 dark:border-amber-500',    text: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-950/30',    connector: '#f59e0b' },
    'x-hybrid-campaign':        { border: 'border-red-400 dark:border-red-500',        text: 'text-red-600 dark:text-red-400',        bg: 'bg-red-50 dark:bg-red-950/30',        connector: '#ef4444' },
    'x-influence-vector':       { border: 'border-violet-400 dark:border-violet-500',  text: 'text-violet-600 dark:text-violet-400',  bg: 'bg-violet-50 dark:bg-violet-950/30',  connector: '#8b5cf6' },
    'x-strategic-impact':       { border: 'border-indigo-400 dark:border-indigo-500',  text: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-950/30',  connector: '#6366f1' },
    'x-strategic-assessment':   { border: 'border-emerald-400 dark:border-emerald-500',text: 'text-emerald-600 dark:text-emerald-400',bg: 'bg-emerald-50 dark:bg-emerald-950/30',connector: '#10b981' },
    'intrusion-set':            { border: 'border-slate-400 dark:border-slate-500',    text: 'text-slate-600 dark:text-slate-400',    bg: 'bg-slate-50 dark:bg-slate-800/40',    connector: '#64748b' },
    'threat-actor':             { border: 'border-slate-300 dark:border-slate-500',    text: 'text-slate-500 dark:text-slate-400',    bg: 'bg-slate-50 dark:bg-slate-800/30',    connector: '#94a3b8' },
};

const DEFAULT_COLOR = { border: 'border-slate-300 dark:border-slate-600', text: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/40', connector: '#64748b' };

const TIMELINE_HEIGHT = 600;           // Fixed total height
const LANE_HEIGHT = TIMELINE_HEIGHT / 2 - 1; // Each lane
const CLUSTER_TOLERANCE_PCT = 8;       // % of viewport width to cluster

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEntityDate(e: GscixEntity): Date | null {
    const raw = e.first_seen || e.gsciAttributes?.first_seen;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

function formatDateShort(d: Date): string {
    return d.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
}

function formatDateFull(d: Date): string {
    return d.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

function getConfidenceLabel(c?: number): string {
    if (c === undefined || c === null) return 'N/A';
    return `${Math.round(c)}% CONF`;
}

function getTypeShortLabel(type: string): string {
    return ({ 'x-geo-strategic-actor': 'Actor', 'x-strategic-objective': 'Objective', 'x-hybrid-campaign': 'Campaign', 'x-influence-vector': 'Inf. Vector', 'x-strategic-impact': 'Impact', 'x-strategic-assessment': 'Assessment', 'intrusion-set': 'Intrusion Set', 'threat-actor': 'Threat Actor' })[type] || type;
}

function lerp(min: number, max: number, t: number): number { return min + (max - min) * t; }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

// ─── Clustering algorithm ─────────────────────────────────────────────────────

interface Deck {
    type: string;
    entities: GscixEntity[];
}

interface TemporalGroup {
    id: string;           // unique key for React
    pct: number;          // X position as % (5–95)
    decks: Deck[];        // grouped by entity type
    totalCount: number;
}

function clusterEntities(
    entities: GscixEntity[],
    windowStart: number,
    windowEnd: number,
    tolerance: number = CLUSTER_TOLERANCE_PCT,
): TemporalGroup[] {
    const wSpan = windowEnd - windowStart || 1;

    // Assign pct to each entity
    const positioned: { entity: GscixEntity; pct: number }[] = [];
    const withoutDate: GscixEntity[] = [];

    for (const e of entities) {
        const d = getEntityDate(e);
        if (d) {
            const t = clamp((d.getTime() - windowStart) / wSpan, 0, 1);
            positioned.push({ entity: e, pct: lerp(5, 95, t) });
        } else {
            withoutDate.push(e);
        }
    }

    // Distribute no-date entities evenly
    if (withoutDate.length > 0) {
        const step = 90 / (withoutDate.length + 1);
        for (let i = 0; i < withoutDate.length; i++) {
            positioned.push({ entity: withoutDate[i], pct: 5 + step * (i + 1) });
        }
    }

    positioned.sort((a, b) => a.pct - b.pct);

    // Greedy sweep clustering
    const clusters: { entities: GscixEntity[]; pcts: number[] }[] = [];
    for (const { entity, pct } of positioned) {
        if (clusters.length > 0) {
            const last = clusters[clusters.length - 1];
            const lastMean = last.pcts.reduce((s, v) => s + v, 0) / last.pcts.length;
            if (Math.abs(pct - lastMean) < tolerance) {
                last.entities.push(entity);
                last.pcts.push(pct);
                continue;
            }
        }
        clusters.push({ entities: [entity], pcts: [pct] });
    }

    // Convert clusters to TemporalGroups with decks
    return clusters.map((c, i) => {
        const meanPct = c.pcts.reduce((s, v) => s + v, 0) / c.pcts.length;

        // Group entities by type into decks
        const deckMap = new Map<string, GscixEntity[]>();
        for (const e of c.entities) {
            const arr = deckMap.get(e.type) || [];
            arr.push(e);
            deckMap.set(e.type, arr);
        }
        const decks: Deck[] = Array.from(deckMap.entries()).map(([type, ents]) => ({ type, entities: ents }));

        return {
            id: `group-${i}-${meanPct.toFixed(1)}`,
            pct: meanPct,
            decks,
            totalCount: c.entities.length,
        };
    });
}

// ─── Timeline Card ────────────────────────────────────────────────────────────

const TimelineCard: React.FC<{ entity: GscixEntity; compact?: boolean; onSelect?: (stixId: string) => void; isSelected?: boolean }> = ({ entity, compact, onSelect, isSelected }) => {
    const colors = TYPE_COLOR[entity.type] || DEFAULT_COLOR;
    const confidence = entity.confidence ?? entity.gsciAttributes?.hybrid_pressure_index;
    const dateStr = entity.first_seen || entity.gsciAttributes?.first_seen;
    const date = dateStr ? new Date(dateStr) : null;

    if (compact) {
        return (
            <div className={cn('bg-white dark:bg-slate-900 px-3 py-2 rounded-lg shadow-sm border w-48', colors.border)}>
                <span className={cn('text-[8px] font-mono uppercase font-bold tracking-widest', colors.text)}>
                    {getTypeShortLabel(entity.type)}
                </span>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight line-clamp-1">{entity.name}</h4>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'bg-white dark:bg-slate-900 p-4 rounded-xl shadow-md border w-56',
                'hover:shadow-lg transition-all cursor-pointer relative flex-shrink-0',
                colors.border,
                isSelected && 'ring-2 ring-primary ring-offset-2',
                onSelect && 'hover:scale-[1.03] active:scale-[0.98]',
            )}
            onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(entity.stixId); } : undefined}
        >
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
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1 leading-tight line-clamp-2">{entity.name}</h4>
            {date && <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mb-1">{formatDateFull(date)}</p>}
            {entity.description && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{entity.description}</p>}
        </div>
    );
};

// ─── Deck Badge ───────────────────────────────────────────────────────────────

const DeckBadge: React.FC<{ deck: Deck; isActive: boolean; onClick: (e: React.MouseEvent) => void }> = ({ deck, isActive, onClick }) => {
    const colors = TYPE_COLOR[deck.type] || DEFAULT_COLOR;
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg border shadow-sm transition-all',
                'hover:shadow-md hover:scale-105',
                isActive ? cn('ring-2 ring-offset-1 ring-primary/50 scale-105', colors.border, colors.bg) : cn('bg-white dark:bg-slate-900', colors.border),
            )}
        >
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLOR[deck.type]?.connector || '#64748b' }} />
            <span className={cn('text-[9px] font-mono uppercase font-bold tracking-wider', colors.text)}>
                {getTypeShortLabel(deck.type)}
            </span>
            <span className={cn('text-[9px] font-mono font-bold', colors.text)}>
                x{deck.entities.length}
            </span>
        </button>
    );
};

// ─── Stacked Group Component ──────────────────────────────────────────────────

interface StackedGroupProps {
    group: TemporalGroup;
    lane: 'geo' | 'cyber';
    expandState: 'collapsed' | 'decks' | 'cards';
    expandedDeckType: string | null;
    onClickStack: (groupId: string) => void;
    onClickDeck: (groupId: string, deckType: string) => void;
}

const StackedGroup: React.FC<StackedGroupProps> = ({
    group, lane, expandState, expandedDeckType, onClickStack, onClickDeck,
}) => {
    const isSingle = group.totalCount === 1;
    const singleEntity = isSingle ? group.decks[0].entities[0] : null;

    // ── State: collapsed → show fan of cards ──
    if (expandState === 'collapsed') {
        if (isSingle && singleEntity) {
            // Single card, no stacking needed
            return (
                <div className="flex flex-col items-center">
                    {lane === 'geo' && (
                        <>
                            <TimelineCard entity={singleEntity} />
                            <div className="w-0.5 h-10" style={{ background: `linear-gradient(to bottom, ${TYPE_COLOR[singleEntity.type]?.connector || '#64748b'}50, ${TYPE_COLOR[singleEntity.type]?.connector || '#64748b'}10)` }} />
                        </>
                    )}
                    {lane === 'cyber' && (
                        <>
                            <div className="w-0.5 h-10" style={{ background: `linear-gradient(to bottom, ${TYPE_COLOR[singleEntity.type]?.connector || '#64748b'}10, ${TYPE_COLOR[singleEntity.type]?.connector || '#64748b'}50)` }} />
                            <TimelineCard entity={singleEntity} />
                        </>
                    )}
                </div>
            );
        }

        // Fan stack: show layered cards with slight rotation offsets
        const fanCards = group.decks.flatMap(d => d.entities).slice(0, 4);
        const dominantColor = TYPE_COLOR[group.decks[0]?.type]?.connector || '#64748b';

        return (
            <div className="flex flex-col items-center cursor-pointer group" onClick={() => onClickStack(group.id)}>
                {lane === 'geo' && (
                    <>
                        <div className="relative w-56 h-[120px]">
                            {fanCards.map((e, i) => {
                                const rotation = i === 0 ? 0 : (i % 2 === 1 ? -2.5 * Math.ceil(i / 2) : 2.5 * Math.ceil(i / 2));
                                const offsetX = i === 0 ? 0 : (i % 2 === 1 ? -4 * i : 4 * i);
                                const offsetY = i * 4;
                                return (
                                    <div
                                        key={e.stixId}
                                        className="absolute bottom-0 left-0 right-0 transition-transform duration-200 group-hover:scale-[1.02]"
                                        style={{ transform: `translateX(${offsetX}px) translateY(${-offsetY}px) rotate(${rotation}deg)`, zIndex: fanCards.length - i }}
                                    >
                                        <TimelineCard entity={e} compact />
                                    </div>
                                );
                            })}
                            {/* Count badge */}
                            <div className="absolute -top-2 -right-2 z-30 flex items-center gap-1 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-2 py-0.5 rounded-full shadow-lg">
                                <Layers size={10} />
                                <span className="text-[10px] font-mono font-bold">{group.totalCount}</span>
                            </div>
                        </div>
                        <div className="w-0.5 h-10" style={{ background: `linear-gradient(to bottom, ${dominantColor}50, ${dominantColor}10)` }} />
                    </>
                )}
                {lane === 'cyber' && (
                    <>
                        <div className="w-0.5 h-10" style={{ background: `linear-gradient(to bottom, ${dominantColor}10, ${dominantColor}50)` }} />
                        <div className="relative w-56 h-[120px]">
                            {fanCards.map((e, i) => {
                                const rotation = i === 0 ? 0 : (i % 2 === 1 ? -2.5 * Math.ceil(i / 2) : 2.5 * Math.ceil(i / 2));
                                const offsetX = i === 0 ? 0 : (i % 2 === 1 ? -4 * i : 4 * i);
                                const offsetY = i * 4;
                                return (
                                    <div
                                        key={e.stixId}
                                        className="absolute top-0 left-0 right-0 transition-transform duration-200 group-hover:scale-[1.02]"
                                        style={{ transform: `translateX(${offsetX}px) translateY(${offsetY}px) rotate(${rotation}deg)`, zIndex: fanCards.length - i }}
                                    >
                                        <TimelineCard entity={e} compact />
                                    </div>
                                );
                            })}
                            <div className="absolute -top-2 -right-2 z-30 flex items-center gap-1 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-2 py-0.5 rounded-full shadow-lg">
                                <Layers size={10} />
                                <span className="text-[10px] font-mono font-bold">{group.totalCount}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    // ── State: decks → show type deck badges fanned out ──
    if (expandState === 'decks') {
        const dominantColor = TYPE_COLOR[group.decks[0]?.type]?.connector || '#64748b';
        return (
            <div className="flex flex-col items-center">
                {lane === 'geo' && (
                    <>
                        <div className="flex items-end gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {group.decks.map(deck => (
                                <DeckBadge
                                    key={deck.type}
                                    deck={deck}
                                    isActive={expandedDeckType === deck.type}
                                    onClick={(e) => { e.stopPropagation(); onClickDeck(group.id, deck.type); }}
                                />
                            ))}
                        </div>
                        <div className="w-0.5 h-8 mt-1" style={{ background: `linear-gradient(to bottom, ${dominantColor}40, ${dominantColor}10)` }} />
                    </>
                )}
                {lane === 'cyber' && (
                    <>
                        <div className="w-0.5 h-8 mb-1" style={{ background: `linear-gradient(to bottom, ${dominantColor}10, ${dominantColor}40)` }} />
                        <div className="flex items-start gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
                            {group.decks.map(deck => (
                                <DeckBadge
                                    key={deck.type}
                                    deck={deck}
                                    isActive={expandedDeckType === deck.type}
                                    onClick={(e) => { e.stopPropagation(); onClickDeck(group.id, deck.type); }}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // ── State: cards → show deck badges only (cards are displayed in the detail panel above the timeline) ──
    if (expandState === 'cards' && expandedDeckType) {
        const activeDeck = group.decks.find(d => d.type === expandedDeckType);
        const otherDecks = group.decks.filter(d => d.type !== expandedDeckType);
        const dominantColor = TYPE_COLOR[expandedDeckType]?.connector || '#64748b';

        return (
            <div className="flex flex-col items-center">
                {lane === 'geo' && (
                    <>
                        <div className="flex items-end gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <DeckBadge
                                deck={activeDeck!}
                                isActive={true}
                                onClick={(e) => { e.stopPropagation(); onClickDeck(group.id, expandedDeckType); }}
                            />
                            {otherDecks.map(deck => (
                                <DeckBadge
                                    key={deck.type}
                                    deck={deck}
                                    isActive={false}
                                    onClick={(e) => { e.stopPropagation(); onClickDeck(group.id, deck.type); }}
                                />
                            ))}
                        </div>
                        <div className="w-0.5 h-8 mt-1" style={{ background: `linear-gradient(to bottom, ${dominantColor}40, ${dominantColor}10)` }} />
                    </>
                )}
                {lane === 'cyber' && (
                    <>
                        <div className="w-0.5 h-8 mb-1" style={{ background: `linear-gradient(to bottom, ${dominantColor}10, ${dominantColor}40)` }} />
                        <div className="flex items-start gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
                            <DeckBadge
                                deck={activeDeck!}
                                isActive={true}
                                onClick={(e) => { e.stopPropagation(); onClickDeck(group.id, expandedDeckType); }}
                            />
                            {otherDecks.map(deck => (
                                <DeckBadge
                                    key={deck.type}
                                    deck={deck}
                                    isActive={false}
                                    onClick={(e) => { e.stopPropagation(); onClickDeck(group.id, deck.type); }}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    return null;
};

// ─── Activity Log Row ─────────────────────────────────────────────────────────

const ActivityLogRow: React.FC<{ relation: GscixRelation; entities: GscixEntity[]; index: number }> = ({ relation, entities, index }) => {
    const source = entities.find(e => e.stixId === relation.source_ref);
    const target = entities.find(e => e.stixId === relation.target_ref);
    const palette = [
        { color: 'text-primary', bgColor: 'bg-primary/10', badge: 'STATUS' },
        { color: 'text-risk-high', bgColor: 'bg-risk-high/10', badge: 'ALERT' },
        { color: 'text-amber-500', bgColor: 'bg-amber-500/10', badge: 'INFO' },
    ];
    const p = palette[index % palette.length];

    return (
        <div className="flex items-center gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span className={cn('text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase', p.color, p.bgColor)}>{p.badge}</span>
            <span className="text-xs text-slate-600 dark:text-slate-400 flex-1 truncate">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{source?.name || relation.source_ref.slice(0, 20)}</span>
                {' '}<span className="font-mono text-[10px] text-slate-400">—[{relation.relationship_type}]→</span>{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">{target?.name || relation.target_ref.slice(0, 20)}</span>
            </span>
            {relation.confidence !== undefined && <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{Math.round(relation.confidence)}%</span>}
        </div>
    );
};

// ─── Entity Detail Panel (fixed horizontal scroll strip above timeline) ───────

interface EntityDetailPanelProps {
    group: TemporalGroup | null;
    deckType: string | null;
    onSwitchDeck: (deckType: string) => void;
    onSelectEntity?: (stixId: string) => void;
    selectedEntityId?: string | null;
}

const EntityDetailPanel: React.FC<EntityDetailPanelProps> = ({ group, deckType, onSwitchDeck, onSelectEntity, selectedEntityId }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const activeDeck = group && deckType ? group.decks.find(d => d.type === deckType) : null;
    const dominantColor = deckType ? (TYPE_COLOR[deckType]?.connector || '#64748b') : '#64748b';
    const colors = deckType ? (TYPE_COLOR[deckType] || DEFAULT_COLOR) : DEFAULT_COLOR;

    const updateScrollIndicators = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 0);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        updateScrollIndicators();
        el.addEventListener('scroll', updateScrollIndicators, { passive: true });
        const obs = new ResizeObserver(updateScrollIndicators);
        obs.observe(el);
        return () => { el.removeEventListener('scroll', updateScrollIndicators); obs.disconnect(); };
    }, [updateScrollIndicators, activeDeck]);

    // Reset scroll when deck type changes
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    }, [deckType, group?.id]);

    const scroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const amount = 240;
        el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    };

    // Empty state
    if (!activeDeck || !group || !deckType) {
        return (
            <div className="mb-4 border border-border-light dark:border-border-dark rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <div className="flex items-center px-5 py-3 border-b border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-slate-800/30">
                    <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">
                        Entity Detail
                    </span>
                </div>
                <div className="flex items-center justify-center py-8">
                    <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                        <Layers size={24} className="opacity-30" />
                        <p className="text-[11px] font-mono">Select a deck from the timeline to inspect its entities</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="mb-4 border border-border-light dark:border-border-dark rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all duration-300"
            style={{ borderTopWidth: '3px', borderTopColor: dominantColor }}
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dominantColor }} />
                    <span className={cn('text-[10px] font-mono uppercase font-bold tracking-widest', colors.text)}>
                        {ENTITY_TYPE_LABELS[deckType] || deckType}
                    </span>
                    <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded border', colors.text, colors.bg, colors.border)}>
                        {activeDeck.entities.length} {activeDeck.entities.length === 1 ? 'entity' : 'entities'}
                    </span>
                    {/* Deck switcher pills */}
                    {group.decks.length > 1 && (
                        <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-border-light dark:border-border-dark">
                            {group.decks.map(deck => {
                                const dc = TYPE_COLOR[deck.type] || DEFAULT_COLOR;
                                const isActive = deck.type === deckType;
                                return (
                                    <button
                                        key={deck.type}
                                        onClick={() => onSwitchDeck(deck.type)}
                                        className={cn(
                                            'flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-mono uppercase font-bold tracking-wider transition-all',
                                            isActive
                                                ? cn('ring-1 ring-offset-1 ring-primary/40', dc.bg, dc.text, dc.border, 'border')
                                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                                        )}
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_COLOR[deck.type]?.connector || '#64748b' }} />
                                        {getTypeShortLabel(deck.type)} x{deck.entities.length}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Scrollable card strip */}
            <div className="relative">
                {/* Left fade + arrow */}
                {canScrollLeft && (
                    <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center">
                        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white dark:from-slate-900 to-transparent pointer-events-none" />
                        <button
                            onClick={() => scroll('left')}
                            className="relative z-10 ml-2 p-1.5 rounded-full bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark shadow-md text-slate-500 hover:text-primary hover:border-primary/30 transition-all"
                        >
                            <ChevronLeft size={16} />
                        </button>
                    </div>
                )}

                {/* Right fade + arrow */}
                {canScrollRight && (
                    <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center">
                        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none" />
                        <button
                            onClick={() => scroll('right')}
                            className="relative z-10 mr-2 p-1.5 rounded-full bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark shadow-md text-slate-500 hover:text-primary hover:border-primary/30 transition-all"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}

                {/* Cards */}
                <div
                    ref={scrollRef}
                    className="flex items-start gap-4 px-5 py-4 overflow-x-auto"
                    style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none' }}
                >
                    {activeDeck.entities.map(entity => (
                        <TimelineCard
                            key={entity.stixId}
                            entity={entity}
                            onSelect={onSelectEntity}
                            isSelected={selectedEntityId === entity.stixId}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── Minimap Component ────────────────────────────────────────────────────────

interface MinimapProps {
    globalMin: number; globalMax: number; windowStart: number; windowEnd: number;
    entityDots: { t: number; color: string; lane: 'geo' | 'cyber' }[];
    onWindowChange: (start: number, end: number) => void;
}

const Minimap: React.FC<MinimapProps> = ({ globalMin, globalMax, windowStart, windowEnd, entityDots, onWindowChange }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const dragging = useRef<'left' | 'right' | 'center' | null>(null);
    const dragOffset = useRef(0);

    const span = globalMax - globalMin || 1;
    const leftPct = ((windowStart - globalMin) / span) * 100;
    const rightPct = ((windowEnd - globalMin) / span) * 100;
    const widthPct = rightPct - leftPct;

    const pxToTime = useCallback((clientX: number): number => {
        if (!trackRef.current) return globalMin;
        const rect = trackRef.current.getBoundingClientRect();
        const t = clamp((clientX - rect.left) / rect.width, 0, 1);
        return globalMin + t * span;
    }, [globalMin, span]);

    const handleMouseDown = useCallback((e: React.MouseEvent, part: 'left' | 'right' | 'center') => {
        e.preventDefault(); e.stopPropagation();
        dragging.current = part;
        if (part === 'center') dragOffset.current = pxToTime(e.clientX) - windowStart;

        const handleMouseMove = (ev: MouseEvent) => {
            const time = pxToTime(ev.clientX);
            const minWindow = span * 0.05;
            if (dragging.current === 'left') { onWindowChange(clamp(time, globalMin, windowEnd - minWindow), windowEnd); }
            else if (dragging.current === 'right') { onWindowChange(windowStart, clamp(time, windowStart + minWindow, globalMax)); }
            else if (dragging.current === 'center') {
                const wSize = windowEnd - windowStart;
                let ns = time - dragOffset.current, ne = ns + wSize;
                if (ns < globalMin) { ns = globalMin; ne = globalMin + wSize; }
                if (ne > globalMax) { ne = globalMax; ns = globalMax - wSize; }
                onWindowChange(ns, ne);
            }
        };
        const handleMouseUp = () => { dragging.current = null; window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [pxToTime, windowStart, windowEnd, globalMin, globalMax, span, onWindowChange]);

    return (
        <div className="relative select-none">
            <div ref={trackRef} className="relative h-10 bg-slate-100 dark:bg-slate-800 rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
                {entityDots.map((dot, i) => (
                    <div key={i} className="absolute w-1.5 h-1.5 rounded-full" style={{ left: `${dot.t * 100}%`, top: dot.lane === 'geo' ? '25%' : '65%', transform: 'translate(-50%, -50%)', backgroundColor: dot.color, opacity: 0.6 }} />
                ))}
                <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-300 dark:bg-slate-600" />
                <div className="absolute top-0 bottom-0 bg-slate-200/60 dark:bg-slate-700/40" style={{ left: 0, width: `${leftPct}%` }} />
                <div className="absolute top-0 bottom-0 bg-slate-200/60 dark:bg-slate-700/40" style={{ left: `${rightPct}%`, right: 0 }} />
                <div className="absolute top-0 bottom-0 border-y-2 border-primary/40 bg-primary/5 cursor-grab active:cursor-grabbing" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} onMouseDown={e => handleMouseDown(e, 'center')} />
                <div className="absolute top-0 bottom-0 w-2 cursor-ew-resize z-10 group" style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }} onMouseDown={e => handleMouseDown(e, 'left')}>
                    <div className="absolute inset-y-1 left-1/2 -translate-x-1/2 w-1 bg-primary rounded-full group-hover:w-1.5 transition-all" />
                </div>
                <div className="absolute top-0 bottom-0 w-2 cursor-ew-resize z-10 group" style={{ left: `${rightPct}%`, transform: 'translateX(-50%)' }} onMouseDown={e => handleMouseDown(e, 'right')}>
                    <div className="absolute inset-y-1 left-1/2 -translate-x-1/2 w-1 bg-primary rounded-full group-hover:w-1.5 transition-all" />
                </div>
            </div>
            <div className="flex justify-between mt-1.5 px-1">
                <span className="text-[9px] font-mono text-slate-400">{formatDateShort(new Date(globalMin))}</span>
                <span className="text-[9px] font-mono text-primary font-bold">{formatDateShort(new Date(windowStart))} — {formatDateShort(new Date(windowEnd))}</span>
                <span className="text-[9px] font-mono text-slate-400">{formatDateShort(new Date(globalMax))}</span>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface EntityExplorerTimelineProps {
    initialEntityId?: string;
    onNavigateToExplorer?: () => void;
}

export const EntityExplorerTimeline: React.FC<EntityExplorerTimelineProps> = ({ initialEntityId, onNavigateToExplorer }) => {
    const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(initialEntityId);
    const [rootEntity, setRootEntity] = useState<GscixEntity | null>(null);
    const [graphDepth, setGraphDepth] = useState<number>(2);
    const [graphData, setGraphData] = useState<InfluenceGraphData | null>(null);
    const [loadingEntity, setLoadingEntity] = useState(false);
    const [loadingGraph, setLoadingGraph] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [windowStart, setWindowStart] = useState<number>(0);
    const [windowEnd, setWindowEnd] = useState<number>(0);
    const [windowInitialized, setWindowInitialized] = useState(false);

    // Interaction state for stacking
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [expandedDeckType, setExpandedDeckType] = useState<string | null>(null);

    const timelineContainerRef = useRef<HTMLDivElement>(null);

    // Sync selectedEntityId when initialEntityId changes from outside
    useEffect(() => { setSelectedEntityId(initialEntityId); }, [initialEntityId]);

    // ── Fetch root entity ──
    useEffect(() => {
        if (!selectedEntityId) { setRootEntity(null); setGraphData(null); setWindowInitialized(false); return; }
        setLoadingEntity(true); setError(null);
        apiService.getEntity(selectedEntityId).then(e => setRootEntity(e)).catch(e => setError(e.message)).finally(() => setLoadingEntity(false));
    }, [selectedEntityId]);

    // ── Fetch graph ──
    const isRootActor = selectedEntityId === initialEntityId;
    useEffect(() => {
        if (!selectedEntityId) return;
        const direction = selectedEntityId === initialEntityId ? 'both' : 'outgoing';
        setLoadingGraph(true); setError(null); setWindowInitialized(false);
        apiService.getInfluenceGraph(selectedEntityId, graphDepth, direction).then(d => setGraphData(d)).catch(e => setError(e.message)).finally(() => setLoadingGraph(false));
    }, [selectedEntityId, graphDepth, initialEntityId]);

    // Reset expand state when graph data changes (not on zoom/pan)
    useEffect(() => { setExpandedGroupId(null); setExpandedDeckType(null); }, [graphData]);

    const graphEntities = useMemo(() => graphData?.entities || [], [graphData]);
    const graphRelations = useMemo(() => graphData?.relations || [], [graphData]);

    const { globalMin, globalMax, globalSpan } = useMemo(() => {
        const allDates = graphEntities.map(e => getEntityDate(e)).filter((d): d is Date => d !== null);
        if (allDates.length === 0) { const now = Date.now(); const past = now - 365 * 24 * 60 * 60 * 1000; return { globalMin: past, globalMax: now, globalSpan: now - past }; }
        const times = allDates.map(d => d.getTime());
        const rawMin = Math.min(...times), rawMax = Math.max(...times);
        const rawSpan = rawMax - rawMin || 1000 * 60 * 60 * 24 * 30;
        const gMin = rawMin - rawSpan * 0.1, gMax = rawMax + rawSpan * 0.1;
        return { globalMin: gMin, globalMax: gMax, globalSpan: gMax - gMin };
    }, [graphEntities]);

    useEffect(() => {
        if (graphEntities.length > 0 && !windowInitialized) { setWindowStart(globalMin); setWindowEnd(globalMax); setWindowInitialized(true); }
    }, [graphEntities, globalMin, globalMax, windowInitialized]);

    const { allGeoEntities, allCyberEntities } = useMemo(() => {
        const geo: GscixEntity[] = [], cyber: GscixEntity[] = [];
        for (const e of graphEntities) { if (GEO_LANE_TYPES.has(e.type)) geo.push(e); else if (CYBER_LANE_TYPES.has(e.type)) cyber.push(e); }
        const sortByDate = (a: GscixEntity, b: GscixEntity) => (getEntityDate(a)?.getTime() ?? 0) - (getEntityDate(b)?.getTime() ?? 0);
        return { allGeoEntities: geo.sort(sortByDate), allCyberEntities: cyber.sort(sortByDate) };
    }, [graphEntities]);

    const filterByWindow = useCallback((entities: GscixEntity[]): GscixEntity[] => {
        return entities.filter(e => { const d = getEntityDate(e); if (!d) return true; const t = d.getTime(); return t >= windowStart && t <= windowEnd; });
    }, [windowStart, windowEnd]);

    const visibleGeo = useMemo(() => filterByWindow(allGeoEntities), [allGeoEntities, filterByWindow]);
    const visibleCyber = useMemo(() => filterByWindow(allCyberEntities), [allCyberEntities, filterByWindow]);
    const visibleCount = visibleGeo.length + visibleCyber.length;

    // ── Cluster entities into temporal groups ──
    const geoGroups = useMemo(() => clusterEntities(visibleGeo, windowStart, windowEnd), [visibleGeo, windowStart, windowEnd]);
    const cyberGroups = useMemo(() => clusterEntities(visibleCyber, windowStart, windowEnd), [visibleCyber, windowStart, windowEnd]);

    // ── Date markers ──
    const windowDateMarkers = useMemo(() => {
        const markers: Date[] = [];
        for (let i = 0; i < 6; i++) markers.push(new Date(lerp(windowStart, windowEnd, i / 5)));
        return markers;
    }, [windowStart, windowEnd]);

    // ── Minimap dots ──
    const minimapDots = useMemo(() => {
        const dots: { t: number; color: string; lane: 'geo' | 'cyber' }[] = [];
        for (const e of allGeoEntities) { const d = getEntityDate(e); if (d) dots.push({ t: clamp((d.getTime() - globalMin) / (globalSpan || 1), 0, 1), color: TYPE_COLOR[e.type]?.connector || '#64748b', lane: 'geo' }); }
        for (const e of allCyberEntities) { const d = getEntityDate(e); if (d) dots.push({ t: clamp((d.getTime() - globalMin) / (globalSpan || 1), 0, 1), color: TYPE_COLOR[e.type]?.connector || '#64748b', lane: 'cyber' }); }
        return dots;
    }, [allGeoEntities, allCyberEntities, globalMin, globalSpan]);

    // ── Navigation handlers ──
    const windowSpan = windowEnd - windowStart;
    const navigateBy = useCallback((fraction: number) => {
        const shift = windowSpan * fraction;
        let ns = windowStart + shift, ne = windowEnd + shift;
        if (ns < globalMin) { ns = globalMin; ne = globalMin + windowSpan; }
        if (ne > globalMax) { ne = globalMax; ns = globalMax - windowSpan; }
        setWindowStart(ns); setWindowEnd(ne);
    }, [windowStart, windowEnd, windowSpan, globalMin, globalMax]);

    const zoomWindow = useCallback((factor: number) => {
        const center = (windowStart + windowEnd) / 2;
        const halfSpan = (windowSpan * factor) / 2;
        const clamped = clamp(halfSpan, globalSpan * 0.025, globalSpan / 2);
        let ns = center - clamped, ne = center + clamped;
        if (ns < globalMin) { ns = globalMin; ne = ns + clamped * 2; }
        if (ne > globalMax) { ne = globalMax; ns = ne - clamped * 2; }
        setWindowStart(Math.max(ns, globalMin)); setWindowEnd(Math.min(ne, globalMax));
    }, [windowStart, windowEnd, windowSpan, globalMin, globalMax, globalSpan]);

    const resetWindow = useCallback(() => { setWindowStart(globalMin); setWindowEnd(globalMax); }, [globalMin, globalMax]);
    const handleMinimapChange = useCallback((s: number, e: number) => { setWindowStart(s); setWindowEnd(e); }, []);

    // ── Entity selection handler ──
    const handleSelectEntity = useCallback((stixId: string) => {
        if (stixId !== selectedEntityId) {
            setSelectedEntityId(stixId);
        }
    }, [selectedEntityId]);

    // ── Interaction handlers for stacking ──
    const handleClickStack = useCallback((groupId: string) => {
        setExpandedGroupId(prev => prev === groupId ? null : groupId);
        setExpandedDeckType(null);
    }, []);

    const handleClickDeck = useCallback((groupId: string, deckType: string) => {
        if (expandedGroupId === groupId && expandedDeckType === deckType) {
            // Clicking same deck again → collapse back to decks
            setExpandedDeckType(null);
        } else {
            setExpandedGroupId(groupId);
            setExpandedDeckType(deckType);
        }
    }, [expandedGroupId, expandedDeckType]);

    const handleClickTimelineBackground = useCallback(() => {
        if (expandedGroupId || expandedDeckType) {
            setExpandedGroupId(null);
            setExpandedDeckType(null);
        }
    }, [expandedGroupId, expandedDeckType]);

    // ── Helper to determine expand state per group ──
    const getExpandState = (groupId: string): 'collapsed' | 'decks' | 'cards' => {
        if (expandedGroupId !== groupId) return 'collapsed';
        if (expandedDeckType) return 'cards';
        return 'decks';
    };

    // Stats
    const totalSignals = graphData?.nodeCount ?? 0;
    const maxHPI = useMemo(() => { const v = graphEntities.map(e => e.gsciAttributes?.hybrid_pressure_index ?? 0).filter(v => v > 0); return v.length > 0 ? Math.max(...v) : null; }, [graphEntities]);
    const riskLabel = maxHPI !== null ? (maxHPI > 7 ? 'CRIT' : maxHPI > 4 ? 'HIGH' : 'MED') : 'N/A';

    const correlationData = useMemo(() => {
        if (!rootEntity?.gsciAttributes) return [];
        const a = rootEntity.gsciAttributes;
        return [
            { label: 'Cyber-Geopolitical Coupling', value: a.cyber_geopolitical_coupling_index },
            { label: 'Political Destabilization', value: a.political_destabilization_index },
            { label: 'Economic Disruption', value: a.economic_disruption_index },
            { label: 'Alliance Fragmentation', value: a.alliance_fragmentation_score },
            { label: 'Deterrence Signal', value: a.deterrence_signal_strength },
            { label: 'Narrative Penetration', value: a.narrative_penetration_score },
        ].filter((i): i is { label: string; value: number } => i.value !== undefined && i.value !== null);
    }, [rootEntity]);

    const handleRefresh = () => {
        if (!initialEntityId) return;
        // Reset to the original geo-strategic-actor
        setSelectedEntityId(initialEntityId);
    };

    const isLoading = loadingEntity || loadingGraph;

    // ─── Empty state ──────────────────────────────────────────────────────────

    if (!initialEntityId) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark">
                <div className="max-w-screen-2xl mx-auto px-6 py-8">
                    <div className="flex flex-col items-center justify-center py-32">
                        <div className="bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-2xl p-12 shadow-sm max-w-md text-center">
                            <Clock size={56} className="mx-auto mb-6 text-slate-300 dark:text-slate-600" />
                            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-3">No Actor Selected</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                Select a Geo-Strategic Actor from the <span className="font-semibold text-primary">Actor Explorer</span> to visualize its entity timeline.
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Use "View in Timeline" from the actor actions menu</p>
                            {onNavigateToExplorer && (
                                <button onClick={onNavigateToExplorer} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-all shadow-lg shadow-primary/20 text-sm">
                                    <ArrowLeft size={16} /> Go to Actor Explorer
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Main render ──────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark">
            <div className="max-w-screen-2xl mx-auto px-6 py-8">

                {/* ───── Context Header ───── */}
                <div className="flex flex-col gap-6 mb-8">
                    <div className="flex items-end justify-between flex-wrap gap-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <span className="bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-mono font-semibold rounded uppercase tracking-wider border border-primary/20">
                                    {rootEntity ? (ENTITY_TYPE_LABELS[rootEntity.type] || rootEntity.type) : 'Geo-Strategic Actor'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">// STRATEGIC HYBRID TIMELINE</span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate max-w-[400px]">
                                    {loadingEntity ? <Loader2 size={20} className="animate-spin text-primary inline" /> : rootEntity?.name || 'Loading...'}
                                </h1>
                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 border border-border-light dark:border-border-dark">
                                    <GitBranch size={13} className="text-slate-400" />
                                    <span className="text-[10px] font-mono uppercase text-slate-400 tracking-widest">Depth</span>
                                    {[1, 2, 3, 4, 5].map(d => (
                                        <button key={d} onClick={() => setGraphDepth(d)} className={cn('w-6 h-6 rounded text-[11px] font-bold font-mono transition-all', graphDepth === d ? 'bg-primary text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700')}>{d}</button>
                                    ))}
                                </div>
                                <button onClick={handleRefresh} disabled={isLoading} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-border-light dark:border-border-dark" title="Refresh timeline">
                                    <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-xl p-4 flex flex-col min-w-[110px] shadow-sm">
                                <span className="text-[9px] font-mono uppercase text-slate-400 tracking-widest mb-1">Total Signals</span>
                                <span className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">{isLoading ? '\u2014' : totalSignals.toLocaleString()}</span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-xl p-4 flex flex-col min-w-[110px] shadow-sm">
                                <span className="text-[9px] font-mono uppercase text-slate-400 tracking-widest mb-1">Risk Index</span>
                                <span className={cn('text-2xl font-bold font-mono', riskLabel === 'CRIT' ? 'text-risk-high' : riskLabel === 'HIGH' ? 'text-amber-500' : riskLabel === 'MED' ? 'text-yellow-500' : 'text-slate-400')}>{isLoading ? '\u2014' : riskLabel}</span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-xl p-4 flex flex-col min-w-[110px] shadow-sm">
                                <span className="text-[9px] font-mono uppercase text-slate-400 tracking-widest mb-1">In View</span>
                                <span className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">{isLoading ? '\u2014' : `${visibleCount}/${graphEntities.length}`}</span>
                            </div>
                        </div>
                    </div>
                    {rootEntity && (
                        <p className="text-[10px] font-mono tracking-wide text-slate-400 dark:text-slate-500">
                            STIX_ID: {rootEntity.stixId} // ENTITY_EXPLORER_TIMELINE // DEPTH:{graphDepth}
                        </p>
                    )}
                </div>

                {/* ───── Error ───── */}
                {error && (
                    <div className="mb-6 p-4 bg-risk-high/10 border border-risk-high/20 rounded-xl flex items-center gap-3 text-risk-high text-sm">
                        <AlertCircle size={16} /><span className="font-mono">{error}</span>
                    </div>
                )}

                {/* ───── Entity Detail Panel (always visible) ───── */}
                {!isLoading && graphEntities.length > 0 && (
                    <EntityDetailPanel
                        group={expandedGroupId ? [...geoGroups, ...cyberGroups].find(g => g.id === expandedGroupId) || null : null}
                        deckType={expandedDeckType}
                        onSwitchDeck={(t) => setExpandedDeckType(t)}
                        onSelectEntity={handleSelectEntity}
                        selectedEntityId={selectedEntityId}
                    />
                )}

                {/* ───── Timeline Panel (FIXED HEIGHT) ───── */}
                <div className="relative border border-border-light dark:border-border-dark rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm mb-4">
                    {isLoading && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                            <Loader2 className="animate-spin text-primary mb-3" size={36} />
                            <span className="text-xs font-mono uppercase text-slate-400 tracking-widest">Loading Timeline...</span>
                        </div>
                    )}

                    {!isLoading && graphEntities.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600">
                            <Info size={48} className="mb-4 opacity-40" />
                            <p className="text-sm font-mono">No connected entities found at depth {graphDepth}</p>
                            <p className="text-xs font-mono mt-1 opacity-60">Try increasing the depth level</p>
                        </div>
                    )}

                    {!isLoading && graphEntities.length > 0 && (
                        <div className="flex">
                            {/* Lane Labels */}
                            <div className="w-20 flex-shrink-0 flex flex-col z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-border-light dark:border-border-dark">
                                <div className="flex-1 flex items-center justify-center border-b border-border-light dark:border-border-dark py-6">
                                    <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold font-mono uppercase tracking-[0.35em] text-amber-500 dark:text-amber-400 flex items-center justify-center">
                                        <Globe size={14} className="mb-2 rotate-90" />
                                        <span className="bg-amber-50 dark:bg-amber-950/40 px-1 py-3 rounded">Geopolitical</span>
                                    </div>
                                </div>
                                <div className="flex-1 flex items-center justify-center py-6">
                                    <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold font-mono uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400 flex items-center justify-center">
                                        <Shield size={14} className="mb-2 rotate-90" />
                                        <span className="bg-slate-100 dark:bg-slate-800/60 px-1 py-3 rounded">Cyber</span>
                                    </div>
                                </div>
                            </div>

                            {/* Timeline viewport — FIXED HEIGHT */}
                            <div
                                className="flex-1 overflow-hidden relative"
                                style={{ height: `${TIMELINE_HEIGHT}px` }}
                                ref={timelineContainerRef}
                                onClick={handleClickTimelineBackground}
                            >
                                {/* Central axis */}
                                <div className="absolute left-0 right-0 bg-slate-300 dark:bg-slate-600" style={{ top: '50%', height: '2px', transform: 'translateY(-50%)', zIndex: 10 }}>
                                    {windowDateMarkers.map((date, i) => {
                                        const pct = (i / (windowDateMarkers.length - 1)) * 100;
                                        return (
                                            <div key={i} className="absolute flex flex-col items-center" style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
                                                <div className="h-4 w-0.5 bg-slate-400 dark:bg-slate-500 mt-[-6px]" />
                                                <span className="mt-2 text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded shadow-sm border border-border-light dark:border-border-dark whitespace-nowrap">
                                                    {formatDateShort(date)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* TOP LANE (Geo) */}
                                <div className="absolute left-0 right-0 overflow-visible" style={{ top: 0, height: `${LANE_HEIGHT}px` }}>
                                    {geoGroups.map(group => (
                                        <div
                                            key={group.id}
                                            className="absolute flex items-end justify-center transition-all duration-300"
                                            style={{ left: `${group.pct}%`, transform: 'translateX(-50%)', bottom: 0, zIndex: expandedGroupId === group.id ? 40 : 20 }}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <StackedGroup
                                                group={group}
                                                lane="geo"
                                                expandState={getExpandState(group.id)}
                                                expandedDeckType={expandedGroupId === group.id ? expandedDeckType : null}
                                                onClickStack={handleClickStack}
                                                onClickDeck={handleClickDeck}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* BOTTOM LANE (Cyber) */}
                                <div className="absolute left-0 right-0 overflow-visible" style={{ top: `${LANE_HEIGHT + 2}px`, height: `${LANE_HEIGHT}px` }}>
                                    {cyberGroups.map(group => (
                                        <div
                                            key={group.id}
                                            className="absolute flex items-start justify-center transition-all duration-300"
                                            style={{ left: `${group.pct}%`, transform: 'translateX(-50%)', top: 0, zIndex: expandedGroupId === group.id ? 40 : 20 }}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <StackedGroup
                                                group={group}
                                                lane="cyber"
                                                expandState={getExpandState(group.id)}
                                                expandedDeckType={expandedGroupId === group.id ? expandedDeckType : null}
                                                onClickStack={handleClickStack}
                                                onClickDeck={handleClickDeck}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Empty window state */}
                                {visibleCount === 0 && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                        <p className="text-sm font-mono text-slate-400 dark:text-slate-500">No entities in this time window</p>
                                        <button onClick={resetWindow} className="mt-2 text-xs font-mono text-primary hover:underline">Reset to full range</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ───── Navigation Controls + Minimap ───── */}
                {!isLoading && graphEntities.length > 0 && windowInitialized && (
                    <div className="mb-8">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <button onClick={() => navigateBy(-0.5)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-border-light dark:border-border-dark" title="Jump backward"><ChevronsLeft size={16} /></button>
                            <button onClick={() => navigateBy(-0.2)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-border-light dark:border-border-dark" title="Step backward"><ChevronLeft size={16} /></button>
                            <button onClick={() => zoomWindow(1.5)} className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-border-light dark:border-border-dark" title="Zoom out">Zoom -</button>
                            <button onClick={resetWindow} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-border-light dark:border-border-dark" title="Reset"><Maximize2 size={16} /></button>
                            <button onClick={() => zoomWindow(0.66)} className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-border-light dark:border-border-dark" title="Zoom in">Zoom +</button>
                            <button onClick={() => navigateBy(0.2)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-border-light dark:border-border-dark" title="Step forward"><ChevronRight size={16} /></button>
                            <button onClick={() => navigateBy(0.5)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-border-light dark:border-border-dark" title="Jump forward"><ChevronsRight size={16} /></button>
                        </div>
                        <Minimap globalMin={globalMin} globalMax={globalMax} windowStart={windowStart} windowEnd={windowEnd} entityDots={minimapDots} onWindowChange={handleMinimapChange} />
                    </div>
                )}

                {/* ───── Bottom Grid ───── */}
                {!isLoading && graphEntities.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-2xl p-6 shadow-sm">
                            <h5 className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 mb-5 flex items-center gap-2"><Activity size={12} /> Correlation Matrix</h5>
                            {correlationData.length === 0 ? (
                                <p className="text-xs text-slate-400 font-mono text-center py-6">No correlation data available</p>
                            ) : (
                                <div className="space-y-4">
                                    {correlationData.map(({ label, value }) => {
                                        const pct = Math.min(100, Math.max(0, value * 10));
                                        return (
                                            <div key={label}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate pr-2">{label}</span>
                                                    <span className={cn('text-[10px] font-mono flex-shrink-0', pct >= 70 ? 'text-primary' : pct >= 40 ? 'text-amber-500' : 'text-slate-400')}>{value.toFixed(2)}</span>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                    <div className={cn('h-full rounded-full transition-all', pct >= 70 ? 'bg-primary' : pct >= 40 ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600')} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-5">
                                <h5 className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2"><Clock size={12} /> Activity Log</h5>
                                <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-border-light dark:border-border-dark">{graphRelations.length} relations</span>
                            </div>
                            {graphRelations.length === 0 ? (
                                <p className="text-xs text-slate-400 font-mono text-center py-6">No relations detected at this depth</p>
                            ) : (
                                <div className="space-y-0 max-h-48 overflow-y-auto pr-1">
                                    {graphRelations.slice(0, 20).map((rel, i) => <ActivityLogRow key={rel.id} relation={rel} entities={graphEntities} index={i} />)}
                                    {graphRelations.length > 20 && <p className="text-[10px] font-mono text-slate-400 text-center pt-2">+ {graphRelations.length - 20} more relations...</p>}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ───── Floating Legend ───── */}
            {!isLoading && graphEntities.length > 0 && (
                <div className="fixed bottom-6 right-6 flex flex-col gap-2 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-xl border border-border-light dark:border-border-dark z-50">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400 mb-1">Legend</p>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-sm bg-amber-400" />
                        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Geopolitical Entities</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-sm bg-slate-500" />
                        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Cyber Entities</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border-light dark:border-border-dark flex items-center gap-3">
                        <Layers size={12} className="text-slate-400" />
                        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">Click stacks to expand</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntityExplorerTimeline;
