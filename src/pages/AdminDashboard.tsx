import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { CivicMap, MapComplaint } from '../components/CivicMap.tsx';
import {
  Shield,
  Layers,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Search,
  Filter,
  Activity,
  Plus,
  Trash2,
  FileText,
  Clock,
  Wrench,
  ShieldAlert,
  ArrowRight,
  Eye,
  CheckSquare,
  Lock,
} from 'lucide-react';

interface AdminDashboardProps {
  navigate: (path: string) => void;
}

type AdminTab =
  | 'overview'
  | 'complaints'
  | 'map'
  | 'verification'
  | 'crews'
  | 'fraud'
  | 'duplicates'
  | 'administrators'
  | 'audit'
  | 'health';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ navigate }) => {
  const { user, profile, getAuthToken } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Stats & Complaints
  const [stats, setStats] = useState<any>(null);
  const [complaintsList, setComplaintsList] = useState<any[]>([]);
  const [crewsList, setCrewsList] = useState<any[]>([]);
  const [fraudList, setFraudList] = useState<any[]>([]);
  const [duplicateList, setDuplicateList] = useState<any[]>([]);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Selected item modal
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [assignCrewId, setAssignCrewId] = useState<string>('');
  const [actionReason, setActionReason] = useState<string>('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminOpError, setAdminOpError] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };

      // Parallel fetch
      const [sRes, cRes, crRes, aRes] = await Promise.all([
        fetch('/api/public/stats'),
        fetch('/api/admin/complaints?limit=150', { headers }),
        fetch('/api/crews'),
        fetch('/api/admin/administrators', { headers }),
      ]);

      if (sRes.ok) setStats(await sRes.json());
      if (cRes.ok) setComplaintsList(await cRes.json());
      if (crRes.ok) setCrewsList(await crRes.json());
      if (aRes.ok) setAdminsList(await aRes.json());
    } catch (e) {
      console.error('Failed to load admin overview:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [user]);

  // Tab specific fetches
  useEffect(() => {
    const fetchTabData = async () => {
      const token = await getAuthToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      if (activeTab === 'fraud') {
        const res = await fetch('/api/admin/fraud', { headers });
        if (res.ok) setFraudList(await res.json());
      } else if (activeTab === 'duplicates') {
        const res = await fetch('/api/admin/duplicates', { headers });
        if (res.ok) setDuplicateList(await res.json());
      } else if (activeTab === 'administrators') {
        const res = await fetch('/api/admin/administrators', { headers });
        if (res.ok) setAdminsList(await res.json());
      } else if (activeTab === 'audit') {
        const res = await fetch('/api/admin/audit-logs', { headers });
        if (res.ok) setAuditLogsList(await res.json());
      } else if (activeTab === 'health') {
        const res = await fetch('/api/admin/system-health', { headers });
        if (res.ok) setHealthStatus(await res.json());
      }
    };
    fetchTabData();
  }, [activeTab]);

  // Verify / Reject complaint
  const handleVerifyComplaint = async (id: number, action: 'VERIFY' | 'REJECT') => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/complaints/${id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, reason: actionReason }),
      });
      if (res.ok) {
        setActionReason('');
        setSelectedComplaint(null);
        await fetchOverview();
      }
    } catch (e) {
      console.error('Verification failed:', e);
    }
  };

  // Assign crew
  const handleAssignCrew = async (id: number) => {
    if (!assignCrewId) return;
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/complaints/${id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ crewId: Number(assignCrewId) }),
      });
      if (res.ok) {
        setAssignCrewId('');
        setSelectedComplaint(null);
        await fetchOverview();
      }
    } catch (e) {
      console.error('Assign failed:', e);
    }
  };

  // Add Administrator
  const handleAddAdmin = async () => {
    setAdminOpError(null);
    if (!newAdminEmail.trim()) return;
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/admin/administrators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newAdminEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminOpError(data.error || 'Failed to add administrator');
        return;
      }
      setNewAdminEmail('');
      setAdminsList((prev) => [data, ...prev]);
    } catch (err: any) {
      setAdminOpError(err.message || 'Network error');
    }
  };

  // Remove Administrator
  const handleRemoveAdmin = async (email: string) => {
    setAdminOpError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/administrators/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminOpError(data.error || 'Failed to remove administrator');
        return;
      }
      setAdminsList((prev) => prev.filter((a) => a.email !== email));
    } catch (err: any) {
      setAdminOpError(err.message || 'Network error');
    }
  };

  // Filter complaints
  const filteredComplaints = complaintsList.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.complaintNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || c.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Municipal Authority Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              CivicFix Operations Command
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Authenticated Administrator: <strong className="text-white">{user?.email}</strong></span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800 text-xs font-semibold">
          {[
            { id: 'overview', label: 'Overview & KPIs' },
            { id: 'complaints', label: `Complaints (${complaintsList.length})` },
            { id: 'map', label: 'Admin Live Map' },
            { id: 'verification', label: 'Resolution Verification' },
            { id: 'crews', label: 'Response Crews' },
            { id: 'fraud', label: 'Fraud & Risk Review' },
            { id: 'duplicates', label: 'Duplicate Detection' },
            { id: 'administrators', label: 'Admin Accounts' },
            { id: 'audit', label: 'Audit Logs' },
            { id: 'health', label: 'System Health' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
                <div className="text-xs font-bold text-slate-400 uppercase">Total Reports</div>
                <div className="text-3xl font-extrabold text-white mt-1">{stats?.total ?? 0}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
                <div className="text-xs font-bold text-slate-400 uppercase">Pending Review</div>
                <div className="text-3xl font-extrabold text-amber-400 mt-1">{stats?.pending ?? 0}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
                <div className="text-xs font-bold text-slate-400 uppercase">Active Dispatched</div>
                <div className="text-3xl font-extrabold text-blue-400 mt-1">{stats?.inProgress ?? 0}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
                <div className="text-xs font-bold text-slate-400 uppercase">Permanently Resolved</div>
                <div className="text-3xl font-extrabold text-emerald-400 mt-1">{stats?.resolved ?? 0}</div>
              </div>
            </div>

            {/* Quick Actions & Recent Queue */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">Recent Intake Reports</h2>
                <button
                  onClick={() => setActiveTab('complaints')}
                  className="text-xs text-blue-400 hover:underline"
                >
                  View All Complaints →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Ref ID</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Title</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Reported</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {complaintsList.slice(0, 6).map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-blue-400">{c.complaintNumber}</td>
                        <td className="p-3 font-semibold text-slate-200">{c.category}</td>
                        <td className="p-3 text-white max-w-xs truncate">{c.title}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 uppercase font-bold text-[10px]">
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-[10px] uppercase text-amber-400">
                            {c.priority}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedComplaint(c)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COMPLAINTS MANAGEMENT */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by ID, keyword, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-xs text-white placeholder-slate-500 outline-none w-full"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="REPORTED">Reported</option>
                <option value="VERIFIED">Verified</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="RESOLVED">Resolved</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="Pothole">Pothole</option>
                <option value="Garbage">Garbage</option>
                <option value="Road Damage">Road Damage</option>
                <option value="Streetlight">Streetlight</option>
                <option value="Drainage">Drainage</option>
                <option value="Water Leakage">Water Leakage</option>
              </select>
            </div>

            {/* Complaints Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">Complaint ID</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Title & Location</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Priority</th>
                      <th className="p-3.5">Reported By</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredComplaints.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/40">
                        <td className="p-3.5 font-mono font-bold text-blue-400">{c.complaintNumber}</td>
                        <td className="p-3.5 font-semibold text-slate-200">{c.category}</td>
                        <td className="p-3.5 max-w-sm">
                          <div className="font-semibold text-white truncate">{c.title}</div>
                          <div className="text-[11px] text-slate-400 truncate">{c.address}</div>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-slate-800 uppercase font-bold text-[10px]">
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-[10px] uppercase text-amber-400">
                            {c.priority}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-emerald-400">{c.anonymousPublicId}</td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setSelectedComplaint(c)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl"
                          >
                            Inspect & Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ADMIN LIVE MAP */}
        {activeTab === 'map' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white">Administrative GIS City Map</h2>
              <p className="text-xs text-slate-400">
                Click any issue marker to view details and execute immediate field crew assignment.
              </p>
            </div>
            <CivicMap
              complaints={complaintsList}
              heightClass="h-[600px]"
              onSelectComplaint={(c) => setSelectedComplaint(c)}
            />
          </div>
        )}

        {/* TAB 4: RESOLUTION VERIFICATION */}
        {activeTab === 'verification' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-white">Supervisory Resolution Verification</h2>
              <p className="text-xs text-slate-400">
                Review completed field repairs and verified photos before granting permanent closure.
              </p>
            </div>

            <div className="space-y-4">
              {complaintsList
                .filter((c) => c.status === 'COMPLETED')
                .map((comp) => (
                  <div
                    key={comp.id}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-blue-400">
                          {comp.complaintNumber}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                          COMPLETED
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{comp.title}</h3>
                      <p className="text-xs text-slate-400">{comp.address}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedComplaint(comp)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
                      >
                        Inspect Proof
                      </button>
                    </div>
                  </div>
                ))}
              {complaintsList.filter((c) => c.status === 'COMPLETED').length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No completed jobs currently awaiting verification.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: RESPONSE CREWS */}
        {activeTab === 'crews' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h2 className="text-lg font-bold text-white mb-2">Municipal Field Response Crews</h2>
            <p className="text-xs text-slate-400 mb-6">
              Assigned response units responsible for executing civil repairs and maintenance.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {crewsList.map((crew) => (
                <div key={crew.id} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-slate-400">Crew #{crew.id}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{crew.crewName}</h3>
                  <div className="text-xs text-slate-400 mt-1">Status: Active Service</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: FRAUD REVIEW */}
        {activeTab === 'fraud' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h2 className="text-lg font-bold text-white mb-2">Spam & Fraud Review Queue</h2>
            <p className="text-xs text-slate-400 mb-6">
              Heuristic and AI flagged submissions requiring human verification.
            </p>

            <div className="space-y-3">
              {fraudList.map((flag) => (
                <div
                  key={flag.id}
                  className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 uppercase">
                        Risk: {flag.riskLevel}
                      </span>
                      <span className="text-xs text-slate-400">Confidence: {Math.round(flag.confidence * 100)}%</span>
                    </div>
                    <div className="text-xs font-semibold text-white">{flag.detectedType}</div>
                  </div>
                  <div className="text-xs text-slate-400">{flag.reviewStatus}</div>
                </div>
              ))}
              {fraudList.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Zero active fraud or spam flags detected.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: DUPLICATES */}
        {activeTab === 'duplicates' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h2 className="text-lg font-bold text-white mb-2">Proximity Duplicate Reports</h2>
            <p className="text-xs text-slate-400 mb-6">
              Reports automatically flagged for high spatial and category proximity.
            </p>

            <div className="space-y-3">
              {duplicateList.map((dup) => (
                <div
                  key={dup.id}
                  className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="text-white font-semibold">Complaint #{dup.complaintId}</span>
                    <span className="text-slate-400 ml-2">Potential Duplicate of #{dup.possibleDuplicateId}</span>
                  </div>
                  <div className="text-amber-400 font-bold">{Math.round(dup.similarityScore * 100)}% Match</div>
                </div>
              ))}
              {duplicateList.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No pending duplicate records to review.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 8: ADMINISTRATOR MANAGEMENT (Section 7) */}
        {activeTab === 'administrators' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">Administrator Management</h2>
                <p className="text-xs text-slate-400">
                  Manage the authorized municipal administrator email accounts. Server-side verified.
                </p>
              </div>
            </div>

            {/* Add Administrator Form */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Authorize New Administrator Email
              </label>
              <div className="flex gap-2 max-w-md">
                <input
                  type="email"
                  placeholder="new.admin@municipality.gov"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddAdmin}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Authorize</span>
                </button>
              </div>

              {adminOpError && (
                <div className="mt-3 text-red-400 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{adminOpError}</span>
                </div>
              )}
            </div>

            {/* Administrator Emails List */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Currently Authorized Administrators ({adminsList.length})
              </div>
              {adminsList.map((adm) => (
                <div
                  key={adm.id || adm.email}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-medium text-white">{adm.email}</span>
                    <span className="text-[10px] text-slate-500">Added by: {adm.addedBy}</span>
                  </div>

                  {adminsList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAdmin(adm.email)}
                      className="text-slate-500 hover:text-red-400 p-1.5 transition-colors"
                      title="Revoke Admin Access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 9: AUDIT LOGS (Section 41) */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h2 className="text-lg font-bold text-white mb-2">Protected Municipal Audit Trail</h2>
            <p className="text-xs text-slate-400 mb-6">
              Immutable server-side logs recording administrative assignments, verifications, and permissions.
            </p>

            <div className="space-y-2 font-mono text-xs">
              {auditLogsList.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <span className="text-blue-400 font-bold">[{log.action}]</span>
                    <span className="text-slate-300 ml-2">{log.entityType} ({log.entityId})</span>
                    <span className="text-slate-500 ml-2">by {log.actorId}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
              {auditLogsList.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">No audit logs recorded yet.</div>
              )}
            </div>
          </div>
        )}

        {/* TAB 10: SYSTEM HEALTH (Section 42) */}
        {activeTab === 'health' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">System Infrastructure Health</h2>
              <p className="text-xs text-slate-400">
                Live connection monitoring for database, authentication, maps, and AI vision services.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-medium">Relational Database (Cloud SQL)</div>
                  <div className="text-base font-bold text-white">PostgreSQL Connection Pool</div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {healthStatus?.database || 'CONNECTED'}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-medium">Authentication Authority</div>
                  <div className="text-base font-bold text-white">Firebase & Google OAuth</div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {healthStatus?.authentication || 'CONNECTED'}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-medium">GIS & Map Engine</div>
                  <div className="text-base font-bold text-white">MapLibre GL & Vector Tiles</div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {healthStatus?.maps || 'CONFIGURED'}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-medium">Civic AI Computer Vision</div>
                  <div className="text-base font-bold text-white">Gemini 2.5 Flash</div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {healthStatus?.ai || 'CONFIGURED'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action / Inspect Modal */}
        {selectedComplaint && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6">
              <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                <div>
                  <span className="font-mono text-xs font-bold text-blue-400">
                    {selectedComplaint.complaintNumber}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-0.5">{selectedComplaint.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 leading-relaxed">
                {selectedComplaint.description}
              </div>

              {selectedComplaint.media && selectedComplaint.media.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Evidence Photos
                  </div>
                  <div className="flex gap-3 overflow-x-auto">
                    {selectedComplaint.media.map((m: any, i: number) => (
                      <div key={i} className="w-36 h-28 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                        <img src={m.fileUrl} alt="Evidence" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action 1: Verify or Reject */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Report Verification
                </div>
                <input
                  type="text"
                  placeholder="Verification note / reason for decision..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVerifyComplaint(selectedComplaint.id, 'VERIFY')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl"
                  >
                    Verify Report
                  </button>
                  <button
                    onClick={() => handleVerifyComplaint(selectedComplaint.id, 'REJECT')}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-xl"
                  >
                    Reject Invalid Report
                  </button>
                </div>
              </div>

              {/* Action 2: Crew Assignment */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Dispatch Field Crew
                </div>
                <div className="flex gap-2">
                  <select
                    value={assignCrewId}
                    onChange={(e) => setAssignCrewId(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 outline-none"
                  >
                    <option value="">Select Response Crew...</option>
                    {crewsList.map((cr) => (
                      <option key={cr.id} value={cr.id}>
                        {cr.crewName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssignCrew(selectedComplaint.id)}
                    disabled={!assignCrewId}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl disabled:opacity-40"
                  >
                    Dispatch Crew
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
