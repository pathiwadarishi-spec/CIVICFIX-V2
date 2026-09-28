import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  MapPin,
  Search,
  CheckCircle2,
  Clock,
  Shield,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Zap,
  Users,
  Compass,
} from 'lucide-react';
import { CivicMap, MapComplaint } from '../components/CivicMap.tsx';
import { useGPS } from '../context/GPSContext.tsx';

interface HomeProps {
  navigate: (path: string) => void;
}

export const Home: React.FC<HomeProps> = ({ navigate }) => {
  const { location: gpsLocation } = useGPS();
  const [stats, setStats] = useState<any>(null);
  const [mapComplaints, setMapComplaints] = useState<MapComplaint[]>([]);
  const [resolvedShowcase, setResolvedShowcase] = useState<any[]>([]);
  const [trackNumber, setTrackNumber] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHomeData = async () => {
      try {
        setLoading(true);
        // Load real stats
        const statsRes = await fetch('/api/public/stats');
        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats(s);
        }

        // Load complaints for map preview
        const mapRes = await fetch('/api/public/complaints?limit=30');
        if (mapRes.ok) {
          const comps = await mapRes.json();
          setMapComplaints(comps);
          // Get resolved with media for showcase
          const resolved = comps.filter((c: any) => c.status === 'RESOLVED');
          setResolvedShowcase(resolved.slice(0, 3));
        }
      } catch (err) {
        console.error('Failed to load homepage data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadHomeData();
  }, []);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackNumber.trim()) return;
    navigate(`/track?id=${encodeURIComponent(trackNumber.trim().toUpperCase())}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-slate-800/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Civic Issue Resolution & Transparency</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
              Report. Resolve. <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
                Improve Your City.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 mb-10 leading-relaxed font-normal">
              CivicFix connects citizens directly with municipal departments, supervisors, and field crews.
              Report potholes, garbage, broken streetlights, or drainage hazards with GPS and photo evidence.
            </p>

            {/* Main Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button
                onClick={() => navigate('/report')}
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 text-base transition-all hover:scale-[1.02] cursor-pointer"
              >
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <span>REPORT AN ISSUE</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              <button
                onClick={() => navigate('/map')}
                className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 text-base transition-all cursor-pointer"
              >
                <Compass className="w-5 h-5 text-blue-400" />
                <span>VIEW LIVE MAP</span>
              </button>
            </div>

            {/* Quick Track Input Bar */}
            <form
              onSubmit={handleTrackSubmit}
              className="max-w-md mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-2 flex items-center gap-2 shadow-xl shadow-black/40"
            >
              <div className="pl-3 text-slate-500">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Track Complaint (e.g. CF-27A81C4D)"
                value={trackNumber}
                onChange={(e) => setTrackNumber(e.target.value)}
                className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-500 outline-none uppercase font-mono tracking-wider"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Track
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Live Public Database Statistics */}
      <section className="py-12 border-b border-slate-800/80 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Real-time Municipal Database Metrics
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-white mb-1">
                {stats?.total ?? 0}
              </div>
              <div className="text-xs text-slate-400 font-medium">Total Complaints</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-blue-400 mb-1">
                {stats?.verified ?? 0}
              </div>
              <div className="text-xs text-slate-400 font-medium">Verified by City</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-amber-400 mb-1">
                {stats?.inProgress ?? 0}
              </div>
              <div className="text-xs text-slate-400 font-medium">Crews Dispatched</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 mb-1">
                {stats?.resolved ?? 0}
              </div>
              <div className="text-xs text-slate-400 font-medium">Permanently Resolved</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Avg. Resolution Time: <strong className="text-slate-200">{stats?.avgResolutionHours || 24} hours</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Resolution Rate: <strong className="text-slate-200">{stats?.resolutionRate || 0}%</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Anonymous Citizen Identity Guaranteed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Map Preview Section */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">
              GIS City Map
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Live Municipal Issues Map</h2>
            <p className="text-slate-400 text-sm mt-1">
              Explore active and resolved civic reports across your municipality.
            </p>
          </div>

          <button
            onClick={() => navigate('/map')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sm font-semibold rounded-xl text-slate-200 flex items-center gap-2 self-start md:self-auto transition-colors cursor-pointer"
          >
            <span>Open Full Interactive Map</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <CivicMap
          complaints={mapComplaints}
          userLocation={gpsLocation}
          heightClass="h-[460px]"
          onSelectComplaint={(c) => navigate(`/track?id=${c.complaintNumber}`)}
        />
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">
              End-To-End Civic Workflow
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white">
              How CivicFix Works
            </h3>
            <p className="text-slate-400 text-sm mt-2">
              From instant citizen reporting to verified field resolution with total public transparency.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold flex items-center justify-center mb-4">
                1
              </div>
              <h4 className="text-base font-bold text-white mb-2">Report & AI Assist</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Take a photo and tag your GPS location. CivicFix AI classifies the issue category and estimates severity.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center mb-4">
                2
              </div>
              <h4 className="text-base font-bold text-white mb-2">Smart Dept Routing</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Automatically routes to the appropriate municipality, ward, and department (Roads, Sanitation, Electrical, Water).
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold flex items-center justify-center mb-4">
                3
              </div>
              <h4 className="text-base font-bold text-white mb-2">Field Crew Action</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Dispatched response teams accept tasks, verify GPS arrival on-site, complete repairs, and submit resolution photos.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center mb-4">
                4
              </div>
              <h4 className="text-base font-bold text-white mb-2">Verified Resolution</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Supervisors review completion proof before permanently closing complaints and awarding crew credits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Citizen Privacy & Anonymity Commitment */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-12 relative overflow-hidden">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Shield className="w-4 h-4" />
              <span>Strict Citizen Privacy Protection</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Your Identity Remains Anonymous
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              When you report a public problem on CivicFix, your personal email, phone number, and residential coordinates are never displayed on public feeds or shared with third parties.
              Public markers display random pseudonyms such as <em>Citizen #CF-7821</em> with safe location boundaries.
            </p>

            <button
              onClick={() => navigate('/report')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              Report an Issue Now
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} CivicFix V2 • Municipal Public Infrastructure Platform</p>
          <p className="mt-1">Powered by PostgreSQL & Cloud SQL • Real-time Civic Resolution</p>
        </div>
      </footer>
    </div>
  );
};
