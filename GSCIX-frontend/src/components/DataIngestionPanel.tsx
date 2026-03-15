import React, { useState, useCallback, useEffect } from 'react';
import {
    CloudUpload,
    FileJson,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    Send,
    Code,
    Copy,
    Info,
    XCircle,
    Search,
    Link,
    X,
    Layers
} from 'lucide-react';
import { cn } from '../lib/utils';
import apiService from '../services/api';
import type { GscixEntity, ValidationResponse, IngestionJob } from '../types/api';

interface IngestionStats {
    processing: boolean;
    recentJobs: IngestionJob[];
}

export const DataIngestionPanel: React.FC = () => {
    const [jsonContent, setJsonContent] = useState<string>('');
    const [originalJsonContent, setOriginalJsonContent] = useState<string>('');
    const [fileName, setFileName] = useState<string>('');
    const [loadedFiles, setLoadedFiles] = useState<{ name: string; content: string }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [strategy, setStrategy] = useState('Upsert');
    const [confidence, setConfidence] = useState(85);
    const [validating, setValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
    const [targetActorId, setTargetActorId] = useState<string>('');
    const [actorAutoDetected, setActorAutoDetected] = useState(false);
    const [actors, setActors] = useState<GscixEntity[]>([]);
    const [stats, setStats] = useState<IngestionStats>({
        processing: false,
        recentJobs: []
    });
    const [showOrphanDialog, setShowOrphanDialog] = useState(false);

    const fetchHistory = useCallback(async () => {
        try {
            const history = await apiService.getIngestionHistory();
            setStats(prev => ({ ...prev, recentJobs: history }));
        } catch (err) {
            console.error('Failed to fetch ingestion history:', err);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
        apiService.getActors().then(setActors).catch(() => {});
    }, [fetchHistory]);

    // Apply actor ID remapping to the displayed JSON when targetActorId changes.
    // Replaces all x-geo-strategic-actor IDs in the bundle (entity id, source_ref,
    // target_ref) with the selected targetActorId so the user sees exactly what
    // will be sent to the backend.
    const applyActorRemapping = useCallback((source: string, actorId: string): string => {
        if (!source || !actorId) return source;
        try {
            const data = JSON.parse(source);
            if (data.type !== 'bundle' || !Array.isArray(data.objects)) return source;

            // Collect all actor IDs from the bundle (entity + phantom refs)
            const actorIds = new Set<string>();
            const entityIds = new Set<string>();
            for (const obj of data.objects) {
                if (obj.type !== 'relationship' && obj.id) entityIds.add(obj.id);
                if (obj.type === 'x-geo-strategic-actor' && obj.id && obj.id !== actorId) {
                    actorIds.add(obj.id);
                }
            }
            for (const obj of data.objects) {
                if (obj.type === 'relationship') {
                    for (const ref of [obj.source_ref, obj.target_ref]) {
                        if (ref && ref.startsWith('x-geo-strategic-actor--') && ref !== actorId && !entityIds.has(ref)) {
                            actorIds.add(ref);
                        }
                    }
                }
            }

            if (actorIds.size === 0) return source;

            // Replace all occurrences via string replacement to preserve formatting
            let result = source;
            for (const oldId of actorIds) {
                result = result.split(oldId).join(actorId);
            }
            return result;
        } catch {
            return source;
        }
    }, []);

    useEffect(() => {
        if (!originalJsonContent) return;
        if (targetActorId) {
            setJsonContent(applyActorRemapping(originalJsonContent, targetActorId));
        } else {
            setJsonContent(originalJsonContent);
        }
    }, [targetActorId, originalJsonContent, applyActorRemapping]);

    // Auto-detect x-geo-strategic-actor in a bundle and pre-select Target Actor
    const autoDetectActor = useCallback((content: string) => {
        setActorAutoDetected(false);
        try {
            const data = JSON.parse(content);
            if (data.type === 'bundle' && Array.isArray(data.objects)) {
                const bundleActor = data.objects.find(
                    (obj: any) => obj.type === 'x-geo-strategic-actor' && obj.id
                );
                if (bundleActor) {
                    // Check if this actor already exists in the platform
                    const match = actors.find(a => a.stixId === bundleActor.id);
                    if (match) {
                        setTargetActorId(match.stixId);
                        setActorAutoDetected(true);
                    }
                }
            }
        } catch {
            // Ignore parse errors — validation will catch them
        }
    }, [actors]);

    // Merge multiple bundle files: aggregate entities, keep only the first
    // x-geo-strategic-actor, and normalize all references in relationships.
    const mergeBundles = useCallback((files: { name: string; content: string }[]): string => {
        if (files.length === 0) return '';
        if (files.length === 1) return files[0].content;

        const allObjects: any[] = [];
        let primaryActorId: string | null = null;
        const secondaryActorIds = new Set<string>();
        const seenIds = new Set<string>();

        // First pass: collect all objects, identify geo-strategic-actors
        for (const file of files) {
            try {
                const data = JSON.parse(file.content);
                if (data.type !== 'bundle' || !Array.isArray(data.objects)) continue;
                for (const obj of data.objects) {
                    if (obj.type === 'x-geo-strategic-actor') {
                        if (!primaryActorId) {
                            primaryActorId = obj.id;
                            if (!seenIds.has(obj.id)) {
                                allObjects.push(obj);
                                seenIds.add(obj.id);
                            }
                        } else if (obj.id !== primaryActorId) {
                            secondaryActorIds.add(obj.id);
                            // Skip — don't add secondary actors as entities
                        }
                    } else {
                        // For non-actor entities: deduplicate by id, keeping the first occurrence
                        if (obj.id && seenIds.has(obj.id)) continue;
                        allObjects.push(obj);
                        if (obj.id) seenIds.add(obj.id);
                    }
                }
            } catch {
                // skip unparseable files
            }
        }

        // Second pass: normalize references in relationships
        if (primaryActorId && secondaryActorIds.size > 0) {
            for (const obj of allObjects) {
                if (obj.type === 'relationship') {
                    if (secondaryActorIds.has(obj.source_ref)) obj.source_ref = primaryActorId;
                    if (secondaryActorIds.has(obj.target_ref)) obj.target_ref = primaryActorId;
                }
            }
        }

        // Deduplicate relationships (same source_ref + target_ref + relationship_type)
        const relSeen = new Set<string>();
        const dedupedObjects = allObjects.filter(obj => {
            if (obj.type === 'relationship') {
                const key = `${obj.source_ref}|${obj.target_ref}|${obj.relationship_type}`;
                if (relSeen.has(key)) return false;
                relSeen.add(key);
            }
            return true;
        });

        const merged = { type: 'bundle', id: `bundle--merged-${Date.now()}`, objects: dedupedObjects };
        return JSON.stringify(merged, null, 2);
    }, []);

    // Detect entities that have no relationship (orphans)
    const detectOrphanEntities = useCallback((content: string): { name: string; type: string }[] => {
        try {
            const data = JSON.parse(content);
            if (data.type !== 'bundle' || !Array.isArray(data.objects)) return [];

            const entities = data.objects.filter((o: any) => o.type !== 'relationship' && o.id);
            const relationships = data.objects.filter((o: any) => o.type === 'relationship');

            // Collect all IDs referenced in relationships
            const referencedIds = new Set<string>();
            for (const rel of relationships) {
                if (rel.source_ref) referencedIds.add(rel.source_ref);
                if (rel.target_ref) referencedIds.add(rel.target_ref);
            }

            // Find entities whose ID is not referenced in any relationship
            return entities
                .filter((e: any) => !referencedIds.has(e.id))
                .map((e: any) => ({ name: e.name || e.id, type: e.type }));
        } catch {
            return [];
        }
    }, []);

    const validateJson = useCallback(async (content: string) => {
        if (!content) return;
        autoDetectActor(content);
        try {
            setValidating(true);
            const data = JSON.parse(content);
            const result = await apiService.validateSchema(data);

            // After schema validation, check for orphan entities
            const orphans = detectOrphanEntities(content);
            if (orphans.length > 0 && result.status === 'OK') {
                result.status = 'WARNING';
                result.message = `Schema valid, but ${orphans.length} entit${orphans.length === 1 ? 'y has' : 'ies have'} no relationships and will not appear in the graph.`;
                result.warnings = orphans.map(o => ({
                    objectType: o.type,
                    name: o.name,
                }));
            }

            setValidationResult(result);
        } catch (err) {
            console.error('Validation failed:', err);
            setValidationResult({
                status: 'ERROR',
                message: 'Invalid JSON format. Please check syntax.',
            });
        } finally {
            setValidating(false);
        }
    }, [autoDetectActor, detectOrphanEntities]);

    // Process files: reads them, merges, validates
    const processFiles = useCallback((files: { name: string; content: string }[]) => {
        if (files.length === 0) {
            setFileName('');
            setOriginalJsonContent('');
            setJsonContent('');
            setValidationResult(null);
            return;
        }
        const displayName = files.length === 1 ? files[0].name : `${files.length} files merged`;
        setFileName(displayName);

        const merged = mergeBundles(files);
        setOriginalJsonContent(merged);
        setJsonContent(merged);
        setValidationResult(null);
        if (merged) validateJson(merged);
    }, [mergeBundles, validateJson]);

    const readFilesAndMerge = useCallback((fileList: FileList, append: boolean) => {
        const jsonFiles = Array.from(fileList).filter(f => f.name.endsWith('.json') || f.type === 'application/json');
        if (jsonFiles.length === 0) return;

        let completed = 0;
        const newEntries: { name: string; content: string }[] = [];

        jsonFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                newEntries.push({ name: file.name, content: event.target?.result as string });
                completed++;
                if (completed === jsonFiles.length) {
                    const updatedFiles = append ? [...loadedFiles, ...newEntries] : newEntries;
                    setLoadedFiles(updatedFiles);
                    processFiles(updatedFiles);
                }
            };
            reader.readAsText(file);
        });
    }, [loadedFiles, processFiles]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        readFilesAndMerge(e.dataTransfer.files, true);
    }, [readFilesAndMerge]);

    const handleValidate = () => {
        validateJson(jsonContent);
    };

    // Inject 'attributed-to' relationships for orphan entities targeting the actor
    const injectOrphanRelations = useCallback((content: string): string => {
        try {
            const data = JSON.parse(content);
            if (data.type !== 'bundle' || !Array.isArray(data.objects)) return content;

            // Find the geo-strategic-actor in the bundle
            const actor = data.objects.find((o: any) => o.type === 'x-geo-strategic-actor');
            const actorId = actor?.id || targetActorId;
            if (!actorId) return content;

            const entities = data.objects.filter((o: any) => o.type !== 'relationship' && o.id);
            const relationships = data.objects.filter((o: any) => o.type === 'relationship');

            const referencedIds = new Set<string>();
            for (const rel of relationships) {
                if (rel.source_ref) referencedIds.add(rel.source_ref);
                if (rel.target_ref) referencedIds.add(rel.target_ref);
            }

            const orphans = entities.filter((e: any) => !referencedIds.has(e.id) && e.id !== actorId);
            if (orphans.length === 0) return content;

            // Generate new relationships for orphans
            const newRels = orphans.map((e: any, i: number) => ({
                type: 'relationship',
                id: `relationship--auto-link-${Date.now()}-${i}`,
                relationship_type: 'attributed-to',
                source_ref: e.id,
                target_ref: actorId,
            }));

            data.objects.push(...newRels);
            return JSON.stringify(data, null, 2);
        } catch {
            return content;
        }
    }, [targetActorId]);

    const handleIngestClick = () => {
        if (!jsonContent) return;
        // If there are orphan warnings, show the confirmation dialog
        if (validationResult?.status === 'WARNING' && validationResult.warnings && validationResult.warnings.length > 0) {
            setShowOrphanDialog(true);
            return;
        }
        doIngest(jsonContent);
    };

    const doIngest = async (contentToIngest: string) => {
        if (!contentToIngest) return;

        try {
            setStats(prev => ({ ...prev, processing: true }));
            const data = JSON.parse(contentToIngest);

            if (data.type === 'bundle') {
                const ingestName = loadedFiles.length > 1
                    ? loadedFiles.map(f => f.name).join(' + ')
                    : fileName;
                await apiService.ingestBundle(data, ingestName, targetActorId || undefined, confidence);
            } else {
                await apiService.ingestData(data);
            }

            setJsonContent('');
            setOriginalJsonContent('');
            setFileName('');
            setLoadedFiles([]);
            setValidationResult(null);
            setTargetActorId('');
            setActorAutoDetected(false);
            setShowOrphanDialog(false);
            setStats(prev => ({ ...prev, processing: false }));
            fetchHistory();
            apiService.getActors().then(setActors).catch(() => {});
        } catch (err) {
            console.error('Ingestion failed:', err);
            setStats(prev => ({ ...prev, processing: false }));
            setShowOrphanDialog(false);
            alert('Ingestion failed. Please check the JSON format and backend logs.');
        }
    };

    return (
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <CloudUpload className="text-primary" />
                        SRO Ingestion Panel
                    </h1>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                        Inject geo-strategic indicators and tactical SROs into the GSCIX knowledge graph.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 flex gap-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                        Endpoint: POST /api/v1/geopolitical/ingest
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Source & Config */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-surface-light dark:bg-surface-dark shadow-sm rounded-xl p-6 border border-border-light dark:border-border-dark">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Info className="text-primary" size={20} />
                            Data Source
                        </h2>

                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            className={cn(
                                "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer bg-slate-50 dark:bg-slate-800/50",
                                isDragging ? "border-primary bg-primary/5" : "border-border-light dark:border-border-dark hover:border-primary/50 dark:hover:border-primary/50"
                            )}
                        >
                            <div className="flex justify-center mb-4">
                                <FileJson className={cn("text-4xl transition-colors", isDragging ? "text-primary" : "text-slate-400")} size={48} />
                            </div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Drop JSON Bundle{loadedFiles.length > 0 ? 's' : ''}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">STIX 2.1 or GSCIX exports — multiple files supported</p>
                            <label className="mt-4 inline-block px-4 py-2 bg-white dark:bg-slate-700 border border-border-light dark:border-border-dark rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 shadow-sm transition-all cursor-pointer">
                                Browse Files
                                <input type="file" className="hidden" accept=".json" multiple onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        readFilesAndMerge(e.target.files, true);
                                    }
                                    // Reset input so the same file(s) can be re-selected
                                    e.target.value = '';
                                }} />
                            </label>
                        </div>

                        {/* Loaded files list */}
                        {loadedFiles.length > 0 && (
                            <div className="mt-4 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Layers size={12} /> {loadedFiles.length} file{loadedFiles.length > 1 ? 's' : ''} loaded
                                        {loadedFiles.length > 1 && <span className="text-amber-500 font-normal">(merged)</span>}
                                    </span>
                                    <button
                                        onClick={() => { setLoadedFiles([]); processFiles([]); }}
                                        className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        Clear all
                                    </button>
                                </div>
                                {loadedFiles.map((f, i) => (
                                    <div key={`${f.name}-${i}`} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-1.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileJson size={14} className={i === 0 && loadedFiles.length > 1 ? "text-cyan-500 shrink-0" : "text-slate-400 shrink-0"} />
                                            <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{f.name}</span>
                                            {i === 0 && loadedFiles.length > 1 && (
                                                <span className="text-[9px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-bold shrink-0">Primary actor</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                const updated = loadedFiles.filter((_, idx) => idx !== i);
                                                setLoadedFiles(updated);
                                                processFiles(updated);
                                            }}
                                            className="p-0.5 text-slate-400 hover:text-red-500 transition-colors shrink-0 ml-2"
                                            title="Remove file"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Ingestion Strategy</label>
                                <select
                                    value={strategy}
                                    onChange={(e) => setStrategy(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                                >
                                    <option>Upsert (Update if exists)</option>
                                    <option>Append Only</option>
                                    <option>Overwrite (Force)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Source Confidence</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        value={confidence}
                                        onChange={(e) => setConfidence(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                        max="100" min="0"
                                    />
                                    <span className="text-sm font-bold text-primary font-mono w-10">{confidence}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Target Actor */}
                    <div className="bg-surface-light dark:bg-surface-dark shadow-sm rounded-xl p-6 border border-border-light dark:border-border-dark">
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2 uppercase tracking-wide">
                            <Search className="text-primary" size={18} />
                            Target Actor
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                            Associate incoming entities with an existing strategic actor in the knowledge graph.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Select Existing Actor</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                                    <select
                                        value={targetActorId}
                                        onChange={(e) => { setTargetActorId(e.target.value); setActorAutoDetected(false); }}
                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none appearance-none"
                                    >
                                        <option value="">None (No linking)</option>
                                        {actors.map(actor => (
                                            <option key={actor.stixId} value={actor.stixId}>{actor.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {targetActorId && (
                                <div className={cn(
                                    "p-2.5 rounded-lg border flex items-center gap-2",
                                    actorAutoDetected
                                        ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20"
                                        : "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20"
                                )}>
                                    {actorAutoDetected ? <Link className="text-emerald-600 dark:text-emerald-400 shrink-0" size={14} /> : <Info className="text-primary shrink-0" size={14} />}
                                    <span className={cn(
                                        "text-[10px] font-medium",
                                        actorAutoDetected ? "text-emerald-700 dark:text-emerald-300" : "text-blue-700 dark:text-blue-300"
                                    )}>
                                        {actorAutoDetected
                                            ? "Actor auto-detected from bundle. Orphaned entities will be linked automatically."
                                            : "Linking will create 'attributed-to' relationships automatically."}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-surface-light dark:bg-surface-dark shadow-sm rounded-xl p-6 border border-border-light dark:border-border-dark">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <RefreshCw className={cn("text-primary", stats.processing && "animate-spin")} size={18} />
                                Sync Status
                            </h2>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded uppercase">Live</span>
                        </div>

                        <div className="space-y-3">
                            {stats.processing && (
                                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20 animate-pulse">
                                    <RefreshCw className="text-primary text-sm animate-spin mt-1" size={16} />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">Processing Bundle...</p>
                                        <p className="text-xs text-slate-500 mt-1">Mapping entities to STIX...</p>
                                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                                            <div className="bg-primary h-full rounded-full" style={{ width: '45%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {stats.recentJobs.slice(0, 2).map(job => (
                                <div key={job.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <div className="mt-1">
                                        {job.status === 'OK' ? <CheckCircle className="text-emerald-500" size={16} /> : <AlertTriangle className="text-amber-500" size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{job.filename}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{job.message}</p>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono mt-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        {new Date(job.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Preview & Action */}
                <div className="lg:col-span-2 space-y-6 flex flex-col">
                    {/* Ready for Ingest — top for accessibility */}
                    <div className="bg-surface-light dark:bg-surface-dark shadow-sm rounded-xl p-6 border border-border-light dark:border-border-dark flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-center sm:text-left">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Ready for Ingest</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {jsonContent ? "Valid JSON structure detected." : "Waiting for valid payload input."}
                            </p>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button
                                onClick={handleValidate}
                                disabled={!jsonContent || validating}
                                className="flex-1 sm:flex-none px-6 py-2.5 bg-transparent border border-border-light dark:border-border-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {validating && <RefreshCw className="animate-spin" size={16} />}
                                Validate Schema
                            </button>
                            <button
                                onClick={handleIngestClick}
                                disabled={!jsonContent || stats.processing}
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {stats.processing ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                                Ingest Data
                            </button>
                        </div>
                    </div>

                    {/* Validation Feedback */}
                    {validationResult && (
                        <div className={cn(
                            "rounded-xl px-6 py-4 border shadow-sm",
                            validationResult.status === 'OK' && "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50",
                            validationResult.status === 'WARNING' && "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50",
                            validationResult.status === 'ERROR' && "bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800/50"
                        )}>
                            <div className="flex items-center gap-3 mb-2">
                                {validationResult.status === 'OK' && (
                                    <CheckCircle className="text-emerald-500" size={20} />
                                )}
                                {validationResult.status === 'WARNING' && (
                                    <AlertTriangle className="text-amber-500" size={20} />
                                )}
                                {validationResult.status === 'ERROR' && (
                                    <XCircle className="text-rose-500" size={20} />
                                )}
                                <span className={cn(
                                    "text-sm font-bold",
                                    validationResult.status === 'OK' && "text-emerald-700 dark:text-emerald-400",
                                    validationResult.status === 'WARNING' && "text-amber-700 dark:text-amber-400",
                                    validationResult.status === 'ERROR' && "text-rose-700 dark:text-rose-400"
                                )}>
                                    {validationResult.message}
                                </span>
                            </div>
                            {validationResult.warnings && validationResult.warnings.length > 0 && (
                                <ul className="space-y-1 mt-3">
                                    {validationResult.warnings.map((w, i) => (
                                        <li key={i} className="text-xs text-amber-600 dark:text-amber-300 flex items-start gap-2">
                                            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                            <span><span className="font-bold opacity-70">[{w.objectType}]</span> {w.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {validationResult.errors && validationResult.errors.length > 0 && (
                                <ul className="space-y-1 mt-3">
                                    {validationResult.errors.map((err, i) => (
                                        <li key={i} className="text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2">
                                            <span className="font-bold opacity-70">[{err.objectType}]</span>
                                            <span>{err.error}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <div className="bg-surface-light dark:bg-surface-dark shadow-sm rounded-xl border border-border-light dark:border-border-dark flex flex-col flex-1 overflow-hidden">
                        <div className="px-4 py-3 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Payload Preview</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500">JSON</span>
                            </div>
                            <div className="flex gap-2">
                                <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Copy to clipboard">
                                    <Copy size={16} />
                                </button>
                                <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Toggle Code View">
                                    <Code size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto bg-[#f8f9fa] dark:bg-[#0d1117] p-6 font-mono text-sm min-h-[400px]">
                            {jsonContent ? (
                                <pre className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                    <code>{jsonContent}</code>
                                </pre>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 cursor-default select-none">
                                    <Code size={48} className="mb-4" />
                                    <p>No content to preview</p>
                                    <p className="text-xs mt-1 italic">Drop or select a JSON file to begin</p>
                                </div>
                            )}
                        </div>


                    </div>

                </div>
            </div>

            {/* Orphan Entities Confirmation Dialog */}
            {showOrphanDialog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowOrphanDialog(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-border-light dark:border-border-dark w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-900/10">
                            <div className="flex items-center gap-3 mb-2">
                                <AlertTriangle className="text-amber-500 shrink-0" size={24} />
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Unlinked entities detected</h2>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {validationResult?.warnings?.length} entit{(validationResult?.warnings?.length ?? 0) === 1 ? 'y' : 'ies'} will not appear in the graph because {(validationResult?.warnings?.length ?? 0) === 1 ? 'it has' : 'they have'} no relationships:
                            </p>
                        </div>
                        <div className="p-6 max-h-48 overflow-y-auto">
                            <ul className="space-y-2">
                                {validationResult?.warnings?.map((w, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm">
                                        <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase">{w.objectType}</span>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{w.name}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    setShowOrphanDialog(false);
                                    const linked = injectOrphanRelations(jsonContent);
                                    setJsonContent(linked);
                                    setOriginalJsonContent(linked);
                                    setValidationResult(null);
                                    doIngest(linked);
                                }}
                                className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold transition-colors shadow-lg flex items-center justify-center gap-2"
                            >
                                <Link size={16} /> Link automatically and ingest
                            </button>
                            <button
                                onClick={() => {
                                    setShowOrphanDialog(false);
                                    doIngest(jsonContent);
                                }}
                                className="w-full py-2.5 px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-2"
                            >
                                <Send size={16} /> Ingest without linking
                            </button>
                            <button
                                onClick={() => setShowOrphanDialog(false)}
                                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
