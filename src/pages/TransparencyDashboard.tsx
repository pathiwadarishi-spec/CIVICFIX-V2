import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
  Users,
  Shield,
  Layers,
} from 'lucide-react';

interface TransparencyDashboardProps {
  navigate: (path: string) => void;
}

export const TransparencyDashboard: React.FC<TransparencyDashboardProps> = ({ navigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [statsRes, leadRes] = await Promise.all([
          fetch('/api/public/stats'),
          fetch('/api/crews/leaderboard'),
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (leadRes.ok) setLeaderboard(await leadRes.json());
      } catch (err) {
        console.error('Failed to load transparency dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Title */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold uppercase tracking-wider mb-3">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Open Civic Governance</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Public Transparency Dashboard
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Real-time public audit of municipal responsiveness, field resolution metrics, and department accountability.
          </p>
        </div>

        {/* Primary Metric KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Total Registered</span>
              <AlertTriangle className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-extrabold text-white">{stats?.total ?? 0}</div>
            <div className="text-[11px] text-slate-500 mt-1">100% database backed</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Resolution Rate</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-400">{stats?.resolutionRate ?? 0}%</div>
            <div className="text-[11px] text-slate-500 mt-1">{stats?.resolved ?? 0} closed cases</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Active Field Work</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-amber-400">{stats?.inProgress ?? 0}</div>
            <div className="text-[11px] text-slate-500 mt-1">Dispatched response units</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Avg. Turnaround</span>
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-extrabold text-white">{stats?.avgResolutionHours ?? 24}h</div>
            <div className="text-[11px] text-slate-500 mt-1">Report to verified fix</div>
          </div>
        </div>

        {/* Category Breakdown & Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Category Distribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-2">Issues By Civic Category</h2>
            <p className="text-xs text-slate-400 mb-6">Distribution across municipal service lines.</p>

            <div className="space-y-4">
              {stats?.categories?.map((cat: any) => {
                const total = stats.total || 1;
                const pct = Math.round((cat.count / total) * 100);

                return (
                  <div key={cat.category}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-200">{cat.category}</span>
                      <span className="text-slate-400">{cat.count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="bg-blue-600 h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Auditable Field Crew Credits Leaderboard */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">Crew Performance Credits</h2>
              <Award className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Auditable credit points awarded solely for verified on-site arrival and verified completed repairs.
            </p>

            <div className="space-y-3">
              {leaderboard.map((crew, idx) => (
                <div
                  key={crew.id}
                  className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs font-bold text-slate-400 flex items-center justify-center">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{crew.crewName}</div>
                      <div className="text-[11px] text-slate-400">
                        {crew.completedJobs} Verified Fixes • {crew.rating} ★ Rating
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-mono font-extrabold text-amber-400">
                      +{crew.points} pts
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Earned Credits</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
