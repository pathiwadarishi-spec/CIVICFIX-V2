import React, { useState, useEffect, useMemo } from 'react';
import { CivicMap, MapComplaint } from '../components/CivicMap.tsx';
import { useGPS } from '../context/GPSContext.tsx';
import {
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  Search,
  SlidersHorizontal,
  RotateCcw,
  MapPin,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  Eye,
  EyeOff,
  Navigation,
  Loader2,
  Radio,
  LocateFixed,
  Compass,
} from 'lucide-react';

interface PublicMapProps {
  navigate: (path: string) => void;
}

// Category definition groups for civic issues
const CATEGORY_GROUPS = [
  {
    id: 'roads',
    label: 'Roads & Pavements',
    icon: '🚧',
    categories: ['Pothole', 'Road Damage', 'Broken Footpath'],
    color: 'border-orange-500/40 text-orange-400 bg-orange-500/10',
  },
  {
    id: 'sanitation',
    label: 'Sanitation & Waste',
    icon: '🗑️',
    categories: ['Garbage', 'Illegal Dumping'],
    color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
  },
  {
    id: 'lighting',
    label: 'Lighting & Grid',
    icon: '💡',
    categories: ['Streetlight'],
    color: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
  },
  {
    id: 'water',
    label: 'Water & Drainage',
    icon: '💧',
    categories: ['Drainage', 'Water Leakage'],
    color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
  },
  {
    id: 'infra',
    label: 'Infrastructure & Signs',
    icon: '🏛️',
    categories: ['Traffic Sign Damage', 'Public Infrastructure Damage', 'Other'],
    color: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
  },
];

const ALL_CATEGORIES = [
  'Pothole',
  'Garbage',
  'Illegal Dumping',
  'Road Damage',
  'Streetlight',
  'Drainage',
  'Water Leakage',
  'Broken Footpath',
  'Traffic Sign Damage',
  'Public Infrastructure Damage',
  'Other',
];

const INDIAN_CITIES = [
  { name: '🇮🇳 Pan-India', coords: [78.9629, 21.5937] as [number, number], zoom: 5 },
  { name: 'Delhi NCR', coords: [77.2090, 28.6139] as [number, number], zoom: 12 },
  { name: 'Visakhapatnam', coords: [83.3150, 17.7231] as [number, number], zoom: 13 },
  { name: 'Hyderabad', coords: [78.3789, 17.4498] as [number, number], zoom: 13 },
  { name: 'Bengaluru', coords: [77.5946, 12.9716] as [number, number], zoom: 13 },
  { name: 'Mumbai', coords: [72.8777, 19.0760] as [number, number], zoom: 12 },
  { name: 'Chennai', coords: [80.2707, 13.0827] as [number, number], zoom: 12 },
  { name: 'Kolkata', coords: [88.3639, 22.5726] as [number, number], zoom: 12 },
];

const STATUS_OPTIONS = [
  {
    id: 'REPORTED',
    label: 'Reported',
    dotColor: 'bg-red-500',
    borderColor: 'border-red-500/40',
    badgeColor: 'bg-red-500/10 text-red-400',
    description: 'New issues awaiting review',
  },
  {
    id: 'VERIFIED',
    label: 'Verified',
    dotColor: 'bg-blue-500',
    borderColor: 'border-blue-500/40',
    badgeColor: 'bg-blue-500/10 text-blue-400',
    description: 'Confirmed by municipal inspector',
  },
  {
    id: 'IN_PROGRESS',
    label: 'In Progress',
    dotColor: 'bg-amber-500',
    borderColor: 'border-amber-500/40',
    badgeColor: 'bg-amber-500/10 text-amber-400',
    description: 'Field crew assigned & repairing',
    includes: ['IN_PROGRESS', 'ASSIGNED', 'ACCEPTED', 'ARRIVED', 'COMPLETED'],
  },
  {
    id: 'RESOLVED',
    label: 'Resolved',
    dotColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500/40',
    badgeColor: 'bg-emerald-500/10 text-emerald-400',
    description: 'Work verified & closed',
  },
];

export const PublicMap: React.FC<PublicMapProps> = ({ navigate }) => {
  const [allComplaints, setAllComplaints] = useState<MapComplaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<MapComplaint | null>(null);
  const [loading, setLoading] = useState(true);

  // Live GPS Integration
  const {
    isTracking,
    location: gpsLocation,
    status: gpsStatus,
    errorMessage: gpsError,
    startTracking,
    stopTracking,
    toggleTracking,
    refreshLocation,
    calculateDistance,
    formatDistance,
  } = useGPS();

  const [nearMeRadius, setNearMeRadius] = useState<number | null>(null); // null = all, 2, 5, 10 km
  const [followUser, setFollowUser] = useState(false);

  // Filter States: Multi-select toggles!
  const [selectedCategories, setSelectedCategories] = useState<string[]>(ALL_CATEGORIES);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    'REPORTED',
    'VERIFIED',
    'IN_PROGRESS',
    'RESOLVED',
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showGranularCategories, setShowGranularCategories] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
  const [locatingUser, setLocatingUser] = useState(false);

  const handleLocateMe = async () => {
    if (gpsLocation) {
      setMapCenter([gpsLocation.lng, gpsLocation.lat]);
    } else {
      setLocatingUser(true);
      const loc = await refreshLocation();
      if (loc) {
        setMapCenter([loc.lng, loc.lat]);
      }
      setLocatingUser(false);
    }
  };

  // Fetch all complaints from server
  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/public/complaints?limit=300');
      if (res.ok) {
        const data = await res.json();
        setAllComplaints(data);
      }
    } catch (e) {
      console.error('Failed to load map data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  // Compute category issue counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of ALL_CATEGORIES) {
      counts[cat] = 0;
    }
    for (const c of allComplaints) {
      counts[c.category] = (counts[c.category] || 0) + 1;
    }
    return counts;
  }, [allComplaints]);

  // Compute status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      REPORTED: 0,
      VERIFIED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
    };
    for (const c of allComplaints) {
      if (c.status === 'REPORTED') counts.REPORTED++;
      else if (c.status === 'VERIFIED') counts.VERIFIED++;
      else if (c.status === 'RESOLVED') counts.RESOLVED++;
      else counts.IN_PROGRESS++; // ASSIGNED, ACCEPTED, ARRIVED, IN_PROGRESS, COMPLETED
    }
    return counts;
  }, [allComplaints]);

  // Toggle single category
  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // Toggle category group (e.g. Roads, Sanitation, etc.)
  const toggleCategoryGroup = (groupCats: string[]) => {
    const allSelected = groupCats.every((c) => selectedCategories.includes(c));
    if (allSelected) {
      // Unselect all in group
      setSelectedCategories((prev) => prev.filter((c) => !groupCats.includes(c)));
    } else {
      // Select all in group
      setSelectedCategories((prev) => Array.from(new Set([...prev, ...groupCats])));
    }
  };

  // Toggle single status
  const toggleStatus = (statusId: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(statusId) ? prev.filter((s) => s !== statusId) : [...prev, statusId]
    );
  };

  // Select all / none
  const selectAllCategories = () => setSelectedCategories(ALL_CATEGORIES);
  const clearAllCategories = () => setSelectedCategories([]);
  const selectAllStatuses = () =>
    setSelectedStatuses(['REPORTED', 'VERIFIED', 'IN_PROGRESS', 'RESOLVED']);
  const clearAllStatuses = () => setSelectedStatuses([]);

  // Reset all filters
  const resetAllFilters = () => {
    setSelectedCategories(ALL_CATEGORIES);
    setSelectedStatuses(['REPORTED', 'VERIFIED', 'IN_PROGRESS', 'RESOLVED']);
    setSearchQuery('');
  };

  // Active filter count indicator
  const isFiltered =
    selectedCategories.length < ALL_CATEGORIES.length ||
    selectedStatuses.length < 4 ||
    Boolean(searchQuery.trim()) ||
    nearMeRadius !== null;

  // Filter complaints in memory for immediate 0ms responsiveness
  const visibleComplaints = useMemo(() => {
    const filtered = allComplaints.filter((comp) => {
      // 1. Category check
      if (!selectedCategories.includes(comp.category)) return false;

      // 2. Status check
      let matchesStatus = false;
      for (const st of selectedStatuses) {
        if (st === 'IN_PROGRESS') {
          if (
            ['IN_PROGRESS', 'ASSIGNED', 'ACCEPTED', 'ARRIVED', 'COMPLETED'].includes(comp.status)
          ) {
            matchesStatus = true;
            break;
          }
        } else if (comp.status === st) {
          matchesStatus = true;
          break;
        }
      }
      if (!matchesStatus) return false;

      // 3. Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = comp.title.toLowerCase().includes(q);
        const matchesRef = comp.complaintNumber.toLowerCase().includes(q);
        const matchesAddress = (comp.address || '').toLowerCase().includes(q);
        const matchesCat = comp.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesRef && !matchesAddress && !matchesCat) return false;
      }

      // 4. Live GPS Near Me Distance Check
      if (nearMeRadius !== null && gpsLocation) {
        const lat = comp.publicLatitude ?? comp.latitude;
        const lng = comp.publicLongitude ?? comp.longitude;
        if (typeof lat === 'number' && typeof lng === 'number') {
          const dist = calculateDistance(lat, lng);
          if (dist === null || dist > nearMeRadius) return false;
        }
      }

      return true;
    });

    if (nearMeRadius !== null && gpsLocation) {
      filtered.sort((a, b) => {
        const latA = a.publicLatitude ?? a.latitude ?? 0;
        const lngA = a.publicLongitude ?? a.longitude ?? 0;
        const latB = b.publicLatitude ?? b.latitude ?? 0;
        const lngB = b.publicLongitude ?? b.longitude ?? 0;
        const distA = calculateDistance(latA, lngA) ?? 99999;
        const distB = calculateDistance(latB, lngB) ?? 99999;
        return distA - distB;
      });
    }

    return filtered;
  }, [allComplaints, selectedCategories, selectedStatuses, searchQuery, nearMeRadius, gpsLocation, calculateDistance]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 flex flex-col font-sans">
      {/* Top Filter & Control Ribbon */}
      <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          {/* Main Top Row: Search + Quick Stats + Toggle Panel Button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold tracking-tight text-white uppercase">
                  Civic Issues Map
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {visibleComplaints.length} of {allComplaints.length} visible
                </span>
              </div>

              {isFiltered && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Quick Search & Filter Drawer Toggle */}
            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by keyword, street, CF-ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locatingUser}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Center map on my current location"
              >
                {locatingUser ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span className="hidden md:inline">My Location</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                  showFiltersPanel || isFiltered
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
                {isFiltered && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/report')}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-blue-600/20 shrink-0 cursor-pointer hidden sm:flex items-center gap-1"
              >
                <span>+ Report Issue</span>
              </button>
            </div>
          </div>

          {/* Quick Status Toggle Bar (Always Visible) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-blue-400" />
              <span>Status:</span>
            </span>

            {STATUS_OPTIONS.map((status) => {
              const active = selectedStatuses.includes(status.id);
              const count = statusCounts[status.id] || 0;

              return (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => toggleStatus(status.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all shrink-0 cursor-pointer ${
                    active
                      ? `${status.borderColor} ${status.badgeColor} shadow-sm`
                      : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                  title={`${status.label}: ${status.description}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${status.dotColor} ${
                      active ? 'opacity-100' : 'opacity-30'
                    }`}
                  />
                  <span>{status.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                      active ? 'bg-white/10' : 'bg-slate-800/60 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            <div className="h-4 w-px bg-slate-800 mx-1 shrink-0 hidden sm:block" />

            {/* Quick Status Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={selectAllStatuses}
                className="text-[10px] text-slate-400 hover:text-blue-400 px-1 py-0.5 transition-colors cursor-pointer"
              >
                All
              </button>
              <span className="text-slate-600 text-[10px]">•</span>
              <button
                type="button"
                onClick={clearAllStatuses}
                className="text-[10px] text-slate-400 hover:text-red-400 px-1 py-0.5 transition-colors cursor-pointer"
              >
                None
              </button>
            </div>
          </div>

          {/* Quick Category Groups Toggle Bar (Always Visible) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
              <Layers className="w-3 h-3 text-emerald-400" />
              <span>Category:</span>
            </span>

            {CATEGORY_GROUPS.map((grp) => {
              const activeCount = grp.categories.filter((c) =>
                selectedCategories.includes(c)
              ).length;
              const totalInGroup = grp.categories.reduce(
                (sum, c) => sum + (categoryCounts[c] || 0),
                0
              );
              const isAllActive = activeCount === grp.categories.length;
              const isSomeActive = activeCount > 0 && !isAllActive;

              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => toggleCategoryGroup(grp.categories)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all shrink-0 cursor-pointer ${
                    isAllActive
                      ? grp.color
                      : isSomeActive
                      ? 'bg-slate-950 border-blue-500/50 text-blue-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className="text-sm leading-none">{grp.icon}</span>
                  <span>{grp.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                      isAllActive ? 'bg-white/10' : 'bg-slate-800/60 text-slate-500'
                    }`}
                  >
                    {totalInGroup}
                  </span>
                </button>
              );
            })}

            <div className="h-4 w-px bg-slate-800 mx-1 shrink-0 hidden sm:block" />

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={selectAllCategories}
                className="text-[10px] text-slate-400 hover:text-blue-400 px-1 py-0.5 transition-colors cursor-pointer"
              >
                All
              </button>
              <span className="text-slate-600 text-[10px]">•</span>
              <button
                type="button"
                onClick={clearAllCategories}
                className="text-[10px] text-slate-400 hover:text-red-400 px-1 py-0.5 transition-colors cursor-pointer"
              >
                None
              </button>
            </div>
          </div>

          {/* Quick Indian Cities / Region Selector Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-red-400" />
              <span>Region:</span>
            </span>

            {INDIAN_CITIES.map((city) => (
              <button
                key={city.name}
                type="button"
                onClick={() => setMapCenter(city.coords)}
                className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer flex items-center gap-1"
              >
                <span>{city.name}</span>
              </button>
            ))}
          </div>

          {/* Live GPS Detection & Near Me Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Live GPS Toggle */}
              <button
                type="button"
                onClick={toggleTracking}
                className={`px-3 py-1.5 rounded-xl font-semibold border flex items-center gap-2 transition-all cursor-pointer ${
                  isTracking
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="relative flex h-2.5 w-2.5">
                  {isTracking && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      isTracking ? 'bg-emerald-500' : 'bg-slate-500'
                    }`}
                  ></span>
                </span>
                <Radio className={`w-3.5 h-3.5 ${isTracking ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{isTracking ? 'Live GPS: Active' : 'Start Live GPS'}</span>
                {isTracking && gpsLocation && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-700/50">
                    ±{gpsLocation.accuracy}m
                  </span>
                )}
              </button>

              {/* Center on Me */}
              {gpsLocation && (
                <button
                  type="button"
                  onClick={() => setMapCenter([gpsLocation.lng, gpsLocation.lat])}
                  className="px-2.5 py-1.5 rounded-xl font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Recenter map to my live GPS coordinates"
                >
                  <LocateFixed className="w-3.5 h-3.5 text-blue-400" />
                  <span>Center On Me</span>
                </button>
              )}

              {/* Follow User Movement */}
              {isTracking && (
                <button
                  type="button"
                  onClick={() => setFollowUser(!followUser)}
                  className={`px-2.5 py-1.5 rounded-xl font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    followUser
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Keep map camera centered as you move"
                >
                  <Compass className={`w-3.5 h-3.5 ${followUser ? 'text-blue-400 animate-spin' : 'text-slate-400'}`} />
                  <span>{followUser ? 'Following You' : 'Follow Movement'}</span>
                </button>
              )}

              {/* Near Me Radius Filters */}
              {isTracking && gpsLocation && (
                <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Radius:
                  </span>
                  {[
                    { label: 'All', value: null },
                    { label: '< 2 km', value: 2 },
                    { label: '< 5 km', value: 5 },
                    { label: '< 10 km', value: 10 },
                  ].map((r) => {
                    const active = nearMeRadius === r.value;
                    return (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => setNearMeRadius(r.value)}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live GPS Telemetry Readout */}
            {isTracking && gpsLocation && (
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span className="hidden sm:inline">Live Coordinates:</span>
                <span className="text-slate-200 font-semibold">
                  {gpsLocation.lat.toFixed(5)}° N, {gpsLocation.lng.toFixed(5)}° E
                </span>
                {gpsLocation.speed !== null && gpsLocation.speed > 0 && (
                  <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {gpsLocation.speed} km/h
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Advanced Filters Panel Drawer */}
      {showFiltersPanel && (
        <div className="bg-slate-900 border-b border-slate-800 p-4 sm:p-6 z-30 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="max-w-7xl mx-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                  <span>Granular Civic Issue Filter Panel</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Toggle individual problem types, review issue counts, and customize map density.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Reset All
                </button>
                <button
                  type="button"
                  onClick={() => setShowFiltersPanel(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Granular Individual Categories Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Individual Category Toggles ({selectedCategories.length} / {ALL_CATEGORIES.length}{' '}
                  selected)
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAllCategories}
                    className="text-blue-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={clearAllCategories}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {ALL_CATEGORIES.map((cat) => {
                  const active = selectedCategories.includes(cat);
                  const count = categoryCounts[cat] || 0;

                  return (
                    <div
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-between cursor-pointer transition-all ${
                        active
                          ? 'bg-blue-600/15 border-blue-500/70 text-white shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-500 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate mr-2">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center text-[10px] border ${
                            active
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-slate-900 border-slate-700 text-transparent'
                          }`}
                        >
                          ✓
                        </div>
                        <span className="truncate">{cat}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          active ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Breakdown & Descriptions */}
            <div className="pt-3 border-t border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                Lifecycle Status Filter ({selectedStatuses.length} / 4 active)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {STATUS_OPTIONS.map((st) => {
                  const active = selectedStatuses.includes(st.id);
                  const count = statusCounts[st.id] || 0;

                  return (
                    <div
                      key={st.id}
                      onClick={() => toggleStatus(st.id)}
                      className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                        active
                          ? `${st.borderColor} bg-slate-950 shadow-md`
                          : 'bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 font-bold text-white">
                          <span className={`w-2.5 h-2.5 rounded-full ${st.dotColor}`} />
                          <span>{st.label}</span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-400">
                          {count} issues
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{st.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Map View */}
      <div className="relative flex-1 w-full">
        <CivicMap
          complaints={visibleComplaints}
          selectedComplaintId={selectedComplaint?.id}
          onSelectComplaint={(c) => setSelectedComplaint(c)}
          center={mapCenter}
          userLocation={gpsLocation}
          followUser={followUser}
          autoGeolocate={true}
          heightClass="h-[calc(100vh-10rem)]"
        />

        {/* Floating Map Legend Indicator (Bottom-Right) */}
        <div className="absolute top-4 right-4 z-20 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-xl hidden md:block">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Status Pin Legend
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
              <span>Reported (New)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <span>Verified by City</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span>Crew In Progress</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Resolved & Fixed</span>
            </div>
          </div>
        </div>

        {/* Zero Results Notice */}
        {visibleComplaints.length === 0 && !loading && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-slate-900/95 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl max-w-sm">
            <EyeOff className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-white mb-1">No Matching Issues Visible</h4>
            <p className="text-xs text-slate-400 mb-4">
              All complaints are currently hidden by your category or status filters.
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Reset Filters & Show All
            </button>
          </div>
        )}

        {/* Selected Complaint Floating Detail Card */}
        {selectedComplaint && (
          <div className="absolute bottom-6 left-4 right-4 sm:left-6 sm:right-auto sm:w-96 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-3xl p-5 shadow-2xl shadow-black z-20 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-mono text-xs font-bold text-blue-400">
                  {selectedComplaint.complaintNumber}
                </span>
                <span
                  className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    selectedComplaint.status === 'RESOLVED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : selectedComplaint.status === 'IN_PROGRESS' ||
                        selectedComplaint.status === 'ASSIGNED'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : selectedComplaint.status === 'VERIFIED'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {selectedComplaint.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className="text-slate-500 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-base font-bold text-white mb-1">{selectedComplaint.title}</h3>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-2">
              <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="truncate">{selectedComplaint.address || 'Reported Location'}</span>
            </div>

            <div className="text-[11px] text-slate-400 font-semibold mb-3 flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                {selectedComplaint.category}
              </span>
              {selectedComplaint.priority && (
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-400">
                  Priority: {selectedComplaint.priority}
                </span>
              )}
              {calculateDistance(
                selectedComplaint.publicLatitude ?? selectedComplaint.latitude ?? 0,
                selectedComplaint.publicLongitude ?? selectedComplaint.longitude ?? 0
              ) !== null && (
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1 font-mono">
                  <LocateFixed className="w-3 h-3 text-blue-400" />
                  <span>
                    {formatDistance(
                      calculateDistance(
                        selectedComplaint.publicLatitude ?? selectedComplaint.latitude ?? 0,
                        selectedComplaint.publicLongitude ?? selectedComplaint.longitude ?? 0
                      )
                    )}
                  </span>
                </span>
              )}
            </div>

            {selectedComplaint.description && (
              <p className="text-xs text-slate-300 line-clamp-2 mb-4 leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                {selectedComplaint.description}
              </p>
            )}

            <button
              type="button"
              onClick={() => navigate(`/track?id=${selectedComplaint.complaintNumber}`)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-600/20"
            >
              <span>View Full Lifecycle Timeline</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
