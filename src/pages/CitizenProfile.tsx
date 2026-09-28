import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Shield,
  User,
  Bell,
  CheckCircle2,
  Clock,
  LogOut,
  Mail,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface CitizenProfileProps {
  navigate: (path: string) => void;
}

export const CitizenProfile: React.FC<CitizenProfileProps> = ({ navigate }) => {
  const { user, profile, logout, getAuthToken } = useAuth();
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoadingNotifs(true);
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotificationsList(await res.json());
      }
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const markNotificationRead = async (id: number) => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotificationsList((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
      }
    } catch (e) {
      console.error('Mark read failed:', e);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 py-16 px-4 text-center">
        <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8">
          <User className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="text-xs text-slate-400 mb-6">
            Sign in with Google to view your private complaint history, anonymous ID, and notifications.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xl font-extrabold text-white shadow-lg shadow-blue-500/20">
                {profile?.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'C'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white">
                    {profile?.displayName || 'Citizen'}
                  </h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                    {profile?.role || 'Citizen'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{user.email}</span>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-red-400 text-xs font-semibold rounded-xl flex items-center gap-2 self-start sm:self-auto cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Anonymity Banner */}
          <div className="mt-6 bg-slate-950 border border-slate-800/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Your Public Identity: <span className="font-mono text-emerald-400">{profile?.anonymousPublicId}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  All civic issues you submit are stamped publicly with this anonymous ID. Your email and identity remain private.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/track')}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl shrink-0 cursor-pointer"
            >
              View My Reports
            </button>
          </div>
        </div>

        {/* In-App Notifications Center (Section 31) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Notifications Center</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {notificationsList.filter((n) => !n.read).length} unread
            </span>
          </div>

          <div className="space-y-3">
            {loadingNotifs ? (
              <div className="py-8 text-center text-slate-500 text-xs">Loading notifications...</div>
            ) : notificationsList.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No notifications yet. You will receive updates when your reports are verified or resolved.
              </div>
            ) : (
              notificationsList.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && markNotificationRead(notif.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    notif.read
                      ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                      : 'bg-slate-950 border-blue-500/40 text-slate-200 shadow-md shadow-blue-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{notif.title}</span>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs mt-1 text-slate-300">{notif.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
