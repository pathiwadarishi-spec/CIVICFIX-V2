import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useGPS } from '../context/GPSContext.tsx';
import {
  AlertTriangle,
  MapPin,
  Search,
  BarChart3,
  Shield,
  Wrench,
  Bell,
  LogIn,
  LogOut,
  User,
  Menu,
  X,
  CheckCircle,
  Radio,
} from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, navigate }) => {
  const { user, profile, loginWithGoogle, logout, getAuthToken } = useAuth();
  const { isTracking, location: gpsLocation, toggleTracking, status: gpsStatus } = useGPS();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const notifs = await res.json();
          const unread = notifs.filter((n: any) => !n.read).length;
          setUnreadCount(unread);
        }
      } catch (err) {
        // ignore
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Report Issue', path: '/report', highlight: true },
    { label: 'Live Map', path: '/map' },
    { label: 'Track Complaint', path: '/track' },
    { label: 'Transparency', path: '/transparency' },
  ];

  if (profile?.role === 'admin') {
    navLinks.push({ label: 'Admin Portal', path: '/admin' });
  }

  if (profile?.role === 'admin' || profile?.role === 'worker' || profile?.role === 'supervisor') {
    navLinks.push({ label: 'Field Crew', path: '/worker' });
  }

  const handleNav = (p: string) => {
    navigate(p);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div
            onClick={() => handleNav('/')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight text-white">CIVIC<span className="text-blue-500">FIX</span></span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  V2
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">Report • Resolve • Transparent City</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => {
              const active = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    item.highlight
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 ml-2 font-semibold'
                      : active
                      ? 'text-white bg-slate-800/80 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Actions (Auth & Notifications & GPS) */}
          <div className="hidden md:flex items-center gap-3">
            {/* Live GPS Detection Button */}
            <button
              type="button"
              onClick={toggleTracking}
              title={
                isTracking
                  ? `Live GPS Active (±${gpsLocation?.accuracy ?? '?'}m) - Click to pause tracking`
                  : 'Click to enable continuous Live GPS detection'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isTracking
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80 shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {isTracking && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isTracking ? 'bg-emerald-500' : 'bg-slate-500'
                  }`}
                ></span>
              </span>
              <Radio className={`w-3.5 h-3.5 ${isTracking ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="hidden lg:inline text-[11px]">
                {isTracking ? `Live GPS (±${gpsLocation?.accuracy ?? '—'}m)` : 'Live GPS: Off'}
              </span>
            </button>

            {user ? (
              <div className="flex items-center gap-2.5">
                {/* Notifications Button */}
                <button
                  onClick={() => handleNav('/profile')}
                  className="relative p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition-all"
                  title="Notifications & Profile"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Profile Pill */}
                <div
                  onClick={() => handleNav('/profile')}
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs text-blue-400 font-bold border border-slate-700">
                    {profile?.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'C'}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-slate-200">
                      {profile?.anonymousPublicId || 'Citizen'}
                    </div>
                    {profile?.role === 'admin' && (
                      <div className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" />
                        <span>Admin</span>
                      </div>
                    )}
                    {profile?.role === 'worker' && (
                      <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                        <Wrench className="w-2.5 h-2.5" />
                        <span>Field Worker</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-red-400 bg-slate-900 border border-slate-800 rounded-xl transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-blue-400" />
                <span>Sign In</span>
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-b border-slate-800 px-4 pt-2 pb-6 space-y-2">
          {navLinks.map((item) => (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium ${
                currentPath === item.path
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}

          {/* Live GPS Mobile Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={toggleTracking}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                isTracking
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                  : 'bg-slate-900 text-slate-300 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${isTracking ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>Live GPS Detection</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isTracking ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                {isTracking ? `ACTIVE (±${gpsLocation?.accuracy ?? '—'}m)` : 'OFF'}
              </span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800">
            {user ? (
              <div className="flex items-center justify-between">
                <div onClick={() => handleNav('/profile')} className="cursor-pointer">
                  <div className="text-sm font-semibold text-white">{profile?.anonymousPublicId}</div>
                  <div className="text-xs text-slate-400">{user.email}</div>
                </div>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
