import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { GPSProvider } from './context/GPSContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { FirstTimeAdminSetup } from './components/FirstTimeAdminSetup.tsx';
import { Home } from './pages/Home.tsx';
import { ReportIssue } from './pages/ReportIssue.tsx';
import { PublicMap } from './pages/PublicMap.tsx';
import { TrackComplaint } from './pages/TrackComplaint.tsx';
import { TransparencyDashboard } from './pages/TransparencyDashboard.tsx';
import { AdminDashboard } from './pages/AdminDashboard.tsx';
import { WorkerDashboard } from './pages/WorkerDashboard.tsx';
import { CitizenProfile } from './pages/CitizenProfile.tsx';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { setupStatus, checkingSetup } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path.split('?')[0]);
  };

  // 1. Loading Initial Setup State
  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <span className="text-sm font-semibold tracking-wider uppercase">Loading CivicFix V2...</span>
      </div>
    );
  }

  // 2. Mandatory First-Time Administrator Setup Gate (Section 4 & 5)
  if (setupStatus && !setupStatus.isConfigured) {
    return <FirstTimeAdminSetup />;
  }

  // Parse track id if in query or url
  const searchParams = new URLSearchParams(window.location.search);
  const initialTrackId =
    searchParams.get('id') ||
    (currentPath.startsWith('/complaint/') ? currentPath.replace('/complaint/', '') : '');

  // 3. Main Application Routing
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500/30">
      <Navbar currentPath={currentPath} navigate={navigate} />

      <main className="flex-1">
        {currentPath === '/' && <Home navigate={navigate} />}
        {currentPath === '/report' && <ReportIssue navigate={navigate} />}
        {currentPath === '/map' && <PublicMap navigate={navigate} />}
        {(currentPath === '/track' || currentPath.startsWith('/complaint/')) && (
          <TrackComplaint navigate={navigate} initialComplaintNumber={initialTrackId} />
        )}
        {currentPath === '/transparency' && <TransparencyDashboard navigate={navigate} />}
        {currentPath === '/admin' && <AdminDashboard navigate={navigate} />}
        {currentPath === '/worker' && <WorkerDashboard navigate={navigate} />}
        {currentPath === '/profile' && <CitizenProfile navigate={navigate} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GPSProvider>
        <AppContent />
      </GPSProvider>
    </AuthProvider>
  );
}
