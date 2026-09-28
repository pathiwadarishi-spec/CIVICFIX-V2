import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  Building2,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  FileText,
  UserCheck,
  CheckCircle,
} from 'lucide-react';

interface TrackComplaintProps {
  navigate: (path: string) => void;
  initialComplaintNumber?: string;
}

const WORKFLOW_STEPS = [
  'REPORTED',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'RESOLVED',
];

export const TrackComplaint: React.FC<TrackComplaintProps> = ({
  navigate,
  initialComplaintNumber = '',
}) => {
  const { user, getAuthToken } = useAuth();
  const [complaintNumber, setComplaintNumber] = useState(initialComplaintNumber);
  const [activeTab, setActiveTab] = useState<'search' | 'my-reports'>('search');
  const [complaint, setComplaint] = useState<any>(null);
  const [myComplaints, setMyComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComplaint = async (num: string) => {
    if (!num) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/complaints/${encodeURIComponent(num.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Complaint not found');
      }
      setComplaint(data);
    } catch (err: any) {
      setError(err.message || 'Failed to locate complaint.');
      setComplaint(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialComplaintNumber) {
      setComplaintNumber(initialComplaintNumber);
      fetchComplaint(initialComplaintNumber);
    }
  }, [initialComplaintNumber]);

  // Load user's reports if logged in and tab clicked
  useEffect(() => {
    if (activeTab === 'my-reports' && user) {
      const loadMine = async () => {
        try {
          const token = await getAuthToken();
          if (!token) return;
          const res = await fetch('/api/my-complaints', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setMyComplaints(data);
          }
        } catch (e) {
          // ignore
        }
      };
      loadMine();
    }
  }, [activeTab, user]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintNumber.trim()) return;
    fetchComplaint(complaintNumber.trim());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'IN_PROGRESS':
      case 'ASSIGNED':
      case 'ACCEPTED':
      case 'ARRIVED':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'VERIFIED':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'REJECTED':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-slate-300 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white mb-2">Track Civic Complaint</h1>
          <p className="text-slate-400 text-sm">
            Enter your unique complaint reference code (e.g. CF-27A81C4D) for real-time municipal status.
          </p>
        </div>

        {/* Tab switch */}
        {user && (
          <div className="flex justify-center mb-6">
            <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl flex gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'search'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Track by ID
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('my-reports')}
                className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'my-reports'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                My Reported Complaints
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {activeTab === 'search' && (
          <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto mb-10">
            <div className="bg-slate-900 border border-slate-800 focus-within:border-blue-500 rounded-2xl p-2 flex items-center gap-2 shadow-xl shadow-black/50 transition-all">
              <div className="pl-3 text-slate-500">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="CF-XXXXXXXX"
                value={complaintNumber}
                onChange={(e) => setComplaintNumber(e.target.value.toUpperCase())}
                className="flex-1 bg-transparent border-none text-base text-white placeholder-slate-500 outline-none uppercase font-mono tracking-wider"
              />
              <button
                type="submit"
                disabled={loading || !complaintNumber.trim()}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-40"
              >
                {loading ? 'Searching...' : 'Track'}
              </button>
            </div>
          </form>
        )}

        {/* My Reports View */}
        {activeTab === 'my-reports' && (
          <div className="space-y-3 mb-10">
            {myComplaints.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
                You haven't reported any issues from this account yet.
              </div>
            ) : (
              myComplaints.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveTab('search');
                    setComplaintNumber(c.complaintNumber);
                    fetchComplaint(c.complaintNumber);
                  }}
                  className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-400">{c.complaintNumber}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white">{c.title}</div>
                    <div className="text-xs text-slate-400">{c.category} • {c.address}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </div>
              ))
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-6 text-center text-sm mb-8">
            {error}
          </div>
        )}

        {/* Complaint Detailed View */}
        {complaint && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xl font-extrabold text-blue-400">
                    {complaint.complaintNumber}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase ${getStatusColor(complaint.status)}`}>
                    {complaint.status}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white">{complaint.title}</h2>
              </div>

              <div className="text-right sm:text-right">
                <div className="text-xs text-slate-400">Public Anonymity Label</div>
                <div className="text-xs font-mono font-bold text-emerald-400">
                  {complaint.anonymousPublicId}
                </div>
              </div>
            </div>

            {/* Lifecycle Progress Stepper */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                Resolution Lifecycle Progress
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {WORKFLOW_STEPS.map((st, i) => {
                  const currentIdx = WORKFLOW_STEPS.indexOf(
                    complaint.status === 'COMPLETED' ? 'COMPLETED' : complaint.status
                  );
                  const isDone = i <= currentIdx;
                  const isCurrent = complaint.status === st;

                  return (
                    <div
                      key={st}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isCurrent
                          ? 'bg-blue-600/20 border-blue-500 text-white'
                          : isDone
                          ? 'bg-slate-950/80 border-slate-800 text-emerald-400'
                          : 'bg-slate-950/40 border-slate-800/40 text-slate-600'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase">{st.replace('_', ' ')}</div>
                      {isDone && <CheckCircle2 className="w-3.5 h-3.5 mx-auto mt-1" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span>Responsible Department</span>
                </div>
                <div className="text-sm font-semibold text-white">{complaint.department}</div>
                <div className="text-[11px] text-slate-400">{complaint.municipality}</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <MapPin className="w-4 h-4 text-red-400" />
                  <span>Approximate Location</span>
                </div>
                <div className="text-sm font-semibold text-white truncate">{complaint.address}</div>
                <div className="text-[11px] text-slate-400">{complaint.ward}</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>Reported Timestamp</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {new Date(complaint.createdAt).toLocaleDateString()}
                </div>
                <div className="text-[11px] text-slate-400">
                  {new Date(complaint.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Problem Description
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">{complaint.description}</p>
            </div>

            {/* Before / After Evidence Photos */}
            {complaint.media && complaint.media.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Photographic Evidence & Resolution Proof
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {complaint.media.map((m: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-semibold">
                        <span>{m.stage === 'COMPLETION' ? '✅ Resolution Verification Photo' : '📷 Initial Citizen Report Photo'}</span>
                        <span className="text-[10px] text-slate-500">{new Date(m.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="w-full h-48 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                        <img src={m.fileUrl} alt="Evidence" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit & Workflow Timeline */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                Verified Municipal Audit History
              </div>
              <div className="space-y-3">
                {complaint.history?.map((h: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 bg-slate-950 border border-slate-800/80 p-3.5 rounded-xl"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Status Transition: {h.newStatus}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(h.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{h.reason}</p>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Actioned By: {h.changedBy}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
