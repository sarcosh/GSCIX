import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { NODE_CONFIG } from './graphUtils';
import type { GscixEntity } from '../types/api';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EntitySearchSelectProps {
    entities: GscixEntity[];
    value: string;                       // stixId of the selected entity
    onChange: (stixId: string) => void;
    placeholder?: string;
    disabled?: boolean;
    accentColor?: 'cyan' | 'amber';      // visual accent (Add = cyan, Edit = amber)
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const ACCENT = {
    cyan: {
        ring: 'ring-cyan-500',
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-500',
        hoverBg: 'hover:bg-cyan-500/10',
        activeBg: 'bg-cyan-500/15',
        border: 'border-cyan-500/30',
    },
    amber: {
        ring: 'ring-amber-500',
        bg: 'bg-amber-500/10',
        text: 'text-amber-500',
        hoverBg: 'hover:bg-amber-500/10',
        activeBg: 'bg-amber-500/15',
        border: 'border-amber-500/30',
    },
};

// ─── Component ────────────────────────────────────────────────────────────────

const EntitySearchSelect: React.FC<EntitySearchSelectProps> = ({
    entities,
    value,
    onChange,
    placeholder = 'Select entity...',
    disabled = false,
    accentColor = 'cyan',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const accent = ACCENT[accentColor];
    const selectedEntity = value ? entities.find(e => e.stixId === value) : null;

    // ── Filtered list ──
    const filtered = searchQuery.trim()
        ? entities.filter(e =>
            e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (NODE_CONFIG[e.type]?.label || e.type).toLowerCase().includes(searchQuery.toLowerCase())
        )
        : entities;

    // ── Close on outside click ──
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Focus search input when opening ──
    useEffect(() => {
        if (isOpen) {
            // Small delay so the DOM is painted before focusing
            requestAnimationFrame(() => searchInputRef.current?.focus());
            setSearchQuery('');
            setHighlightedIndex(0);
        }
    }, [isOpen]);

    // ── Reset highlighted index when filtered list changes ──
    useEffect(() => {
        setHighlightedIndex(0);
    }, [searchQuery]);

    // ── Scroll highlighted item into view ──
    const scrollHighlightedIntoView = useCallback((index: number) => {
        const list = listRef.current;
        if (!list) return;
        const items = list.querySelectorAll('[data-entity-item]');
        const item = items[index] as HTMLElement | undefined;
        if (item) {
            item.scrollIntoView({ block: 'nearest' });
        }
    }, []);

    // ── Keyboard navigation ──
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (!disabled) setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => {
                    const next = Math.min(prev + 1, filtered.length - 1);
                    scrollHighlightedIntoView(next);
                    return next;
                });
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => {
                    const next = Math.max(prev - 1, 0);
                    scrollHighlightedIntoView(next);
                    return next;
                });
                break;
            case 'Enter':
                e.preventDefault();
                if (filtered[highlightedIndex]) {
                    onChange(filtered[highlightedIndex].stixId);
                    setIsOpen(false);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
        }
    }, [isOpen, disabled, filtered, highlightedIndex, onChange, scrollHighlightedIntoView]);

    // ── Render helpers ──
    const renderEntityLabel = (entity: GscixEntity) => {
        const cfg = NODE_CONFIG[entity.type];
        const typeLabel = cfg?.label || entity.type;
        const color = cfg?.color || '#64748b';
        return (
            <div className="flex items-center gap-2 min-w-0">
                <span
                    className="flex-shrink-0 text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ color, backgroundColor: color + '18', border: `1px solid ${color}30` }}
                >
                    {typeLabel}
                </span>
                <span className="truncate text-sm text-slate-900 dark:text-white">{entity.name}</span>
            </div>
        );
    };

    return (
        <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
            {/* ── Trigger button ── */}
            <button
                type="button"
                onClick={() => { if (!disabled) setIsOpen(prev => !prev); }}
                disabled={disabled}
                className={cn(
                    'w-full flex items-center justify-between gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2.5 text-left transition-all',
                    'focus:ring-2 focus:outline-none',
                    accent.ring,
                    disabled && 'opacity-50 cursor-not-allowed',
                    !disabled && 'cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700/70',
                    isOpen && `ring-2 ${accent.ring}`,
                )}
            >
                {selectedEntity ? (
                    renderEntityLabel(selectedEntity)
                ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500">{placeholder}</span>
                )}
                <ChevronDown
                    size={16}
                    className={cn(
                        'flex-shrink-0 text-slate-400 transition-transform duration-200',
                        isOpen && 'rotate-180',
                    )}
                />
            </button>

            {/* ── Clear button (when value is set and not disabled) ── */}
            {selectedEntity && !disabled && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
                    className="absolute right-8 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title="Clear selection"
                >
                    <X size={14} />
                </button>
            )}

            {/* ── Dropdown ── */}
            {isOpen && !disabled && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name or type..."
                                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Results list */}
                    <div
                        ref={listRef}
                        className="max-h-56 overflow-y-auto"
                        style={{ scrollbarWidth: 'thin' }}
                    >
                        {filtered.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                                <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                                    No entities match "{searchQuery}"
                                </p>
                            </div>
                        ) : (
                            filtered.map((entity, index) => {
                                const isHighlighted = index === highlightedIndex;
                                const isSelected = entity.stixId === value;
                                return (
                                    <button
                                        key={entity.stixId}
                                        type="button"
                                        data-entity-item
                                        onClick={() => { onChange(entity.stixId); setIsOpen(false); }}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        className={cn(
                                            'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                                            isHighlighted && 'bg-slate-100 dark:bg-slate-800',
                                            isSelected && accent.activeBg,
                                            !isHighlighted && !isSelected && 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                                        )}
                                    >
                                        {renderEntityLabel(entity)}
                                        {isSelected && (
                                            <span className={cn('ml-auto flex-shrink-0 text-[9px] font-mono font-bold uppercase', accent.text)}>
                                                Selected
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer count */}
                    <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <span className="text-[10px] font-mono text-slate-400">
                            {filtered.length} {filtered.length === 1 ? 'entity' : 'entities'}
                            {searchQuery && ` matching "${searchQuery}"`}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntitySearchSelect;
