import { useState, useEffect, useCallback } from 'react';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Navbar } from './components/Navbar';
import { GeoStrategicActorExplorer } from './components/GeoStrategicActorExplorer';
import { DataIngestionPanel } from './components/DataIngestionPanel';
import { GeoStrategicInfluenceGraph } from './components/GeoStrategicInfluenceGraph';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };
  public static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("Uncaught error:", error, errorInfo); }
  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 flex flex-col items-center justify-center min-h-[400px] bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 rounded-xl m-6 border border-red-200 dark:border-red-900/40 shadow-2xl">
          <h2 className="text-2xl font-bold mb-4">Something went wrong.</h2>
          <pre className="text-xs bg-black/10 dark:bg-black/40 p-4 rounded w-full overflow-auto max-h-[300px] font-mono mb-6">
            {this.state.error?.toString()}
          </pre>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg font-bold shadow-lg hover:bg-red-700 transition-all">Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [currentView, setCurrentView] = useState<'explorer' | 'ingestion' | 'influence'>('explorer');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedActorId, setSelectedActorId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleNavigateToGraph = useCallback((actorId: string) => {
    setSelectedActorId(actorId);
    setCurrentView('influence');
  }, []);

  const handleViewChange = useCallback((view: 'explorer' | 'ingestion' | 'influence') => {
    setCurrentView(view);
  }, []);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark transition-colors duration-200">
      <Navbar
        activeView={currentView}
        onViewChange={handleViewChange}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />
      <main>
        <ErrorBoundary>
          {currentView === 'explorer' ? (
            <GeoStrategicActorExplorer onNavigateToGraph={handleNavigateToGraph} />
          ) : currentView === 'influence' ? (
            <GeoStrategicInfluenceGraph initialActorId={selectedActorId} />
          ) : (
            <DataIngestionPanel />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
