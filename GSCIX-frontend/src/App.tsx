import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { GeoStrategicActorExplorer } from './components/GeoStrategicActorExplorer';
import { DataIngestionPanel } from './components/DataIngestionPanel';

function App() {
  const [currentView, setCurrentView] = useState<'explorer' | 'ingestion'>('explorer');
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark transition-colors duration-200">
      <Navbar
        activeView={currentView}
        onViewChange={setCurrentView}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />
      <main>
        {currentView === 'explorer' ? (
          <GeoStrategicActorExplorer />
        ) : (
          <DataIngestionPanel />
        )}
      </main>
    </div>
  );
}

export default App;
