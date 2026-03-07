import React from 'react';
import { cn } from '../lib/utils'; // Assuming this utility exists or I'll provide a simple version

interface NavbarProps {
    activeView: 'explorer' | 'ingestion';
    onViewChange: (view: 'explorer' | 'ingestion') => void;
    isDarkMode: boolean;
    onToggleDarkMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
    activeView,
    onViewChange,
    isDarkMode,
    onToggleDarkMode
}) => {
    return (
        <nav className="border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark sticky top-0 z-50">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/20">
                                G
                            </div>
                            <span className="font-bold text-xl tracking-tight dark:text-white">GSCIX</span>
                            <span className="hidden sm:inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 rounded-full border border-slate-200 dark:border-slate-700 ml-1">v1.2.4-PRO</span>
                        </div>

                        <div className="hidden md:flex items-center gap-6">
                            <button
                                onClick={() => onViewChange('explorer')}
                                className={cn(
                                    "text-sm font-medium py-5 transition-colors border-b-2",
                                    activeView === 'explorer'
                                        ? "text-primary border-primary"
                                        : "text-slate-500 dark:text-slate-400 border-transparent hover:text-primary"
                                )}
                            >
                                Actor Explorer
                            </button>
                            <button
                                onClick={() => onViewChange('ingestion')}
                                className={cn(
                                    "text-sm font-medium py-5 transition-colors border-b-2",
                                    activeView === 'ingestion'
                                        ? "text-primary border-primary"
                                        : "text-slate-500 dark:text-slate-400 border-transparent hover:text-primary"
                                )}
                            >
                                Data Ingestion
                            </button>
                            <a href="#" className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-primary transition-colors py-5 border-b-2 border-transparent">Risk Analytics</a>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={onToggleDarkMode}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            {isDarkMode ? '🌞' : '🌙'}
                        </button>
                        <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 border-2 border-white dark:border-slate-800 shadow-sm">
                            AD
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};
