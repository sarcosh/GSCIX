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
    XCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import apiService from '../services/api';
import type { ValidationResponse, IngestionJob } from '../types/api';

interface IngestionStats {
    processing: boolean;
    recentJobs: IngestionJob[];
}

export const DataIngestionPanel: React.FC = () => {
    const [jsonContent, setJsonContent] = useState<string>('');
    const [fileName, setFileName] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [strategy, setStrategy] = useState('Upsert');
    const [confidence, setConfidence] = useState(85);
    const [validating, setValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
    const [stats, setStats] = useState<IngestionStats>({
        processing: false,
        recentJobs: []
    });

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
    }, [fetchHistory]);

    const validateJson = useCallback(async (content: string) => {
        if (!content) return;
        try {
            setValidating(true);
            const data = JSON.parse(content);
            const result = await apiService.validateSchema(data);
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
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type === "application/json") {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                setJsonContent(content);
                setValidationResult(null);
                validateJson(content);
            };
            reader.readAsText(file);
        }
    }, [validateJson]);

    const handleValidate = () => {
        validateJson(jsonContent);
    };

    const handleIngest = async () => {
        if (!jsonContent) return;

        try {
            setStats(prev => ({ ...prev, processing: true }));
            const data = JSON.parse(jsonContent);

            if (data.type === 'bundle') {
                await apiService.ingestBundle(data, fileName);
            } else {
                await apiService.ingestData(data);
            }

            setJsonContent('');
            setFileName('');
            setValidationResult(null);
            setStats(prev => ({ ...prev, processing: false }));
            fetchHistory();
        } catch (err) {
            console.error('Ingestion failed:', err);
            setStats(prev => ({ ...prev, processing: false }));
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
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Drop JSON Bundle</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">STIX 2.1 or GSCIX exports</p>
                            <label className="mt-4 inline-block px-4 py-2 bg-white dark:bg-slate-700 border border-border-light dark:border-border-dark rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 shadow-sm transition-all cursor-pointer">
                                Browse Files
                                <input type="file" className="hidden" accept=".json" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setFileName(file.name);
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            const content = event.target?.result as string;
                                            setJsonContent(content);
                                            setValidationResult(null);
                                            validateJson(content);
                                        };
                                        reader.readAsText(file);
                                    }
                                }} />
                            </label>
                        </div>

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

                        {/* Validation Feedback Overlay/Footer */}
                        {validationResult && (
                            <div className={cn(
                                "border-t px-6 py-4",
                                validationResult.status === 'OK' ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50" : "bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800/50"
                            )}>
                                <div className="flex items-center gap-3 mb-2">
                                    {validationResult.status === 'OK' ? (
                                        <CheckCircle className="text-emerald-500" size={20} />
                                    ) : (
                                        <XCircle className="text-rose-500" size={20} />
                                    )}
                                    <span className={cn(
                                        "text-sm font-bold",
                                        validationResult.status === 'OK' ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                                    )}>
                                        {validationResult.message}
                                    </span>
                                </div>
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
                    </div>

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
                                onClick={handleIngest}
                                disabled={!jsonContent || stats.processing}
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {stats.processing ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                                Ingest Data
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
