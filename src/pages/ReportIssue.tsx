import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useGPS } from '../context/GPSContext.tsx';
import { CivicMap } from '../components/CivicMap.tsx';
import {
  AlertTriangle,
  Upload,
  Camera,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Eye,
  ShieldAlert,
  Navigation,
  Radio,
  LocateFixed,
  Compass,
  Crosshair,
} from 'lucide-react';

interface ReportIssueProps {
  navigate: (path: string) => void;
}

const CATEGORIES = [
  { id: 'Pothole', label: 'Pothole', icon: '🕳️', desc: 'Road holes, craters, asphalt damage' },
  { id: 'Garbage', label: 'Garbage & Waste', icon: '🗑️', desc: 'Trash overflow, uncollected bins' },
  { id: 'Illegal Dumping', label: 'Illegal Dumping', icon: '🚫', desc: 'Construction debris, discarded junk' },
  { id: 'Road Damage', label: 'Road Damage', icon: '🚧', desc: 'Cracked paving, missing road surface' },
  { id: 'Streetlight', label: 'Streetlight & Electrical', icon: '💡', desc: 'Dark light poles, exposed wires' },
  { id: 'Drainage', label: 'Drainage & Flooding', icon: '🌊', desc: 'Clogged storm drains, stagnant water' },
  { id: 'Water Leakage', label: 'Water Leakage', icon: '💧', desc: 'Burst main pipelines, leaking meters' },
  { id: 'Broken Footpath', label: 'Broken Footpath', icon: '🚶', desc: 'Damaged sidewalks, paving stones' },
  { id: 'Traffic Sign Damage', label: 'Traffic Sign Damage', icon: '🛑', desc: 'Bent stop signs, broken signals' },
  { id: 'Public Infrastructure Damage', label: 'Public Infrastructure', icon: '🏛️', desc: 'Damaged railings, bus stops, benches' },
  { id: 'Other', label: 'Other Civic Issue', icon: '⚠️', desc: 'General municipal concerns' },
];

export const ReportIssue: React.FC<ReportIssueProps> = ({ navigate }) => {
  const { user, getAuthToken } = useAuth();

  // Wizard Step (1 to 6)
  const [step, setStep] = useState(1);

  // Form State
  const [category, setCategory] = useState('Pothole');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 28.6139, lng: 77.2090 }); // Default: New Delhi, India
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [address, setAddress] = useState('Connaught Place, New Delhi, 110001, India');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');

  // AI & Detection states
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // Duplicate states
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  // GPS State & Live Tracking
  const {
    isTracking,
    location: gpsLocation,
    status: gpsStatus,
    errorMessage: gpsContextError,
    startTracking,
    stopTracking,
    refreshLocation,
  } = useGPS();

  const [liveSync, setLiveSync] = useState(true);
  const [locatingGPS, setLocatingGPS] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Auto-sync coordinates with live GPS if liveSync is active
  useEffect(() => {
    if (liveSync && gpsLocation) {
      const newCoords = { lat: gpsLocation.lat, lng: gpsLocation.lng };
      setCoords(newCoords);
      setLocationAccuracy(gpsLocation.accuracy);
      reverseGeocode(newCoords.lat, newCoords.lng);
    }
  }, [liveSync, gpsLocation]);

  // When opening Step 4, ensure GPS tracking starts if not already running
  useEffect(() => {
    if (step === 4 && !isTracking) {
      startTracking();
    }
  }, [step, isTracking, startTracking]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdComplaint, setCreatedComplaint] = useState<any>(null);

  const [addressSearchInput, setAddressSearchInput] = useState('');
  const [searchingAddress, setSearchingAddress] = useState(false);

  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressSearchInput.trim()) return;
    setSearchingAddress(true);
    setGpsError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          addressSearchInput.trim()
        )}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const newLat = Number(parseFloat(data[0].lat).toFixed(6));
          const newLng = Number(parseFloat(data[0].lon).toFixed(6));
          setCoords({ lat: newLat, lng: newLng });
          setAddress(data[0].display_name);
        } else {
          setGpsError(`Could not locate "${addressSearchInput}". Try another address or click the map.`);
        }
      }
    } catch (err) {
      setGpsError('Address lookup service unavailable. Please place marker on map.');
    } finally {
      setSearchingAddress(false);
    }
  };

  // Reverse Geocoding
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          const parts = data.display_name.split(',');
          setAddress(parts.slice(0, 3).join(', ').trim());
        }
      }
    } catch (e) {
      setAddress(`Approx. Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  // Trigger GPS
  const handleUseCurrentLocation = async () => {
    setLocatingGPS(true);
    setGpsError(null);
    setLiveSync(true);

    if (!isTracking) {
      startTracking();
    }

    const loc = await refreshLocation();
    if (loc) {
      setCoords({ lat: loc.lat, lng: loc.lng });
      setLocationAccuracy(loc.accuracy);
      reverseGeocode(loc.lat, loc.lng);
    } else if (gpsContextError) {
      setGpsError(gpsContextError);
    }
    setLocatingGPS(false);
  };

  // Image Upload & AI analysis
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setMediaUrls((prev) => [...prev, base64]);

      // Trigger AI Detection automatically
      setAnalyzingAI(true);
      try {
        const res = await fetch('/api/complaints/ai-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        if (res.ok) {
          const aiData = await res.json();
          setAiResult(aiData);
        }
      } catch (err) {
        console.error('AI analysis error:', err);
      } finally {
        setAnalyzingAI(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Apply AI suggestions
  const handleApplyAISuggestions = () => {
    if (!aiResult) return;
    if (aiResult.predictedCategory) {
      const matched = CATEGORIES.find(
        (c) => c.id.toLowerCase() === aiResult.predictedCategory.toLowerCase()
      );
      if (matched) setCategory(matched.id);
      else setCategory('Other');
    }
    if (aiResult.suggestedTitle && !title) {
      setTitle(aiResult.suggestedTitle);
    }
    if (aiResult.suggestedSeverity) {
      setSeverity(aiResult.suggestedSeverity);
    }
  };

  // Duplicate Check before Step 5
  useEffect(() => {
    if (step === 5) {
      const runDupCheck = async () => {
        setCheckingDuplicates(true);
        try {
          const res = await fetch('/api/complaints/check-duplicate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: coords.lat,
              longitude: coords.lng,
              category,
              title,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setDuplicates(data.duplicates || []);
          }
        } catch (e) {
          // ignore
        } finally {
          setCheckingDuplicates(false);
        }
      };
      runDupCheck();
    }
  }, [step]);

  // Submit Complaint
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          category,
          title,
          description,
          latitude: coords.lat,
          longitude: coords.lng,
          locationAccuracy,
          address,
          mediaUrls,
          severity,
          priority,
          duplicateConfirmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server rejected complaint submission.');
      }

      setCreatedComplaint(data);
      setStep(6); // Success step
    } catch (err: any) {
      setSubmitError(err.message || 'Network failure: complaint could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Step Progress Bar */}
        {step < 6 && (
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
              <span>STEP {step} OF 5</span>
              <span>
                {step === 1 && 'Issue Category'}
                {step === 2 && 'Title & Details'}
                {step === 3 && 'Photo & AI Assist'}
                {step === 4 && 'Location & GPS'}
                {step === 5 && 'Verification & Duplicate Check'}
              </span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* STEP 1: CATEGORY SELECTION */}
        {step === 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Select Issue Category</h2>
              <p className="text-slate-400 text-sm">
                Choose the category that best describes the civic problem you observed.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <div
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{cat.icon}</span>
                      <div>
                        <div className="font-semibold text-sm text-white">{cat.label}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{cat.desc}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: TITLE & DESCRIPTION */}
        {step === 2 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Describe The Issue</h2>
              <p className="text-slate-400 text-sm">
                Provide a clear title and specific details to help municipal inspectors locate and fix it.
              </p>
            </div>

            <div className="space-y-5 mb-8">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Complaint Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deep pothole on North Avenue near bus stop"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Detailed Description *
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the severity, exact landmark, whether it poses immediate hazard to pedestrians or traffic..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 text-slate-400 hover:text-white text-sm font-medium flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={!title.trim() || !description.trim()}
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PHOTO EVIDENCE & AI DETECTION */}
        {step === 3 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Upload Photo Evidence</h2>
              <p className="text-slate-400 text-sm">
                Visual proof accelerates municipal verification and field crew dispatch.
              </p>
            </div>

            {/* Upload Area */}
            <div className="mb-6">
              <label className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 bg-slate-950/60 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-white mb-1">Click or Tap to Upload Photo</span>
                <span className="text-xs text-slate-500">Supports JPG, PNG, WEBP</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Image Preview & AI Analysis Card */}
            {mediaUrls.length > 0 && (
              <div className="space-y-4 mb-8">
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {mediaUrls.map((url, i) => (
                    <div key={i} className="relative w-28 h-28 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                      <img src={url} alt="Evidence" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>

                {/* AI Assistant Card */}
                <div className="bg-blue-950/30 border border-blue-500/20 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" />
                      <span>CivicFix AI Computer Vision</span>
                    </div>
                    {analyzingAI && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-300">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing photo...</span>
                      </div>
                    )}
                  </div>

                  {aiResult && !analyzingAI ? (
                    <div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-400 font-medium">Detected Issue</div>
                          <div className="text-sm font-bold text-white">{aiResult.predictedCategory}</div>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-400 font-medium">Confidence</div>
                          <div className="text-sm font-bold text-emerald-400">
                            {Math.round(aiResult.confidence * 100)}%
                          </div>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-400 font-medium">Suggested Severity</div>
                          <div className="text-sm font-bold text-amber-400">{aiResult.suggestedSeverity}</div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                        <em>Observation:</em> {aiResult.explanation}
                      </p>

                      <button
                        type="button"
                        onClick={handleApplyAISuggestions}
                        className="px-3.5 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Apply AI Suggested Category & Severity
                      </button>
                    </div>
                  ) : !analyzingAI && (
                    <p className="text-xs text-slate-400">
                      Upload a photo to automatically identify the civic issue and receive smart category suggestions.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 text-slate-400 hover:text-white text-sm font-medium flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: LOCATION & GPS */}
        {step === 4 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Set Issue Location</h2>
                <p className="text-slate-400 text-sm">
                  Pinpoint defect coordinates via live satellite GPS or adjust the pin manually.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locatingGPS}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all self-start sm:self-auto cursor-pointer shadow-md shadow-blue-600/20"
                >
                  {locatingGPS ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Navigation className="w-4 h-4" />
                  )}
                  <span>Snap to Live GPS</span>
                </button>
              </div>
            </div>

            {/* Live GPS Telemetry & Status Card */}
            <div className={`mb-4 p-3.5 rounded-2xl border transition-all ${
              isTracking && gpsLocation
                ? 'bg-emerald-950/30 border-emerald-800/60'
                : 'bg-slate-950 border-slate-800'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    {isTracking && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-3 w-3 ${
                        isTracking ? 'bg-emerald-500' : 'bg-slate-500'
                      }`}
                    ></span>
                  </span>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{isTracking ? 'Live GPS Satellite Tracking: Active' : 'Live GPS Detection: Idle'}</span>
                      {locationAccuracy !== null && (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
                          locationAccuracy <= 10
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          ±{locationAccuracy}m {locationAccuracy <= 10 ? 'High Precision' : 'Estimated'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Lat: {coords.lat.toFixed(6)} • Lng: {coords.lng.toFixed(6)}
                      {gpsLocation?.speed !== null && gpsLocation?.speed !== undefined && gpsLocation.speed > 0 && (
                        <span className="ml-2 text-emerald-400">• Speed: {gpsLocation.speed} km/h</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Live Sync Auto-Follow Toggle */}
                  {isTracking && (
                    <button
                      type="button"
                      onClick={() => setLiveSync(!liveSync)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                        liveSync
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                      title={liveSync ? 'Pin automatically follows your physical movement' : 'Click to lock pin to your live movement'}
                    >
                      <Crosshair className={`w-3.5 h-3.5 ${liveSync ? 'animate-pulse text-emerald-400' : ''}`} />
                      <span>{liveSync ? 'Auto-Sync Pin: ON' : 'Auto-Sync Pin: OFF'}</span>
                    </button>
                  )}

                  {!isTracking && (
                    <button
                      type="button"
                      onClick={startTracking}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5 text-blue-400" />
                      <span>Enable Live Tracking</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {gpsError && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{gpsError}</span>
              </div>
            )}

            {/* Address Search Bar */}
            <form onSubmit={handleSearchAddress} className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search Indian city, district, street, or landmark (e.g. Visakhapatnam, Hyderabad, Delhi)..."
                  value={addressSearchInput}
                  onChange={(e) => setAddressSearchInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={searchingAddress || !addressSearchInput.trim()}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {searchingAddress ? 'Searching...' : 'Go to Location'}
                </button>
              </div>
            </form>

            {/* Quick Indian City Selection Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">Quick Jump:</span>
              {[
                { name: 'Delhi NCR', lat: 28.6139, lng: 77.2090, addr: 'Connaught Place, New Delhi, 110001' },
                { name: 'Visakhapatnam', lat: 17.7142, lng: 83.3236, addr: 'RK Beach Road, Visakhapatnam, 530017' },
                { name: 'Hyderabad', lat: 17.4498, lng: 78.3789, addr: 'Hitec City, Madhapur, Hyderabad, 500081' },
                { name: 'Bengaluru', lat: 12.9754, lng: 77.6066, addr: 'MG Road, Central Bengaluru, 560001' },
                { name: 'Mumbai', lat: 18.9438, lng: 72.8234, addr: 'Marine Drive, Mumbai, 400020' },
                { name: 'Chennai', lat: 13.0827, lng: 80.2707, addr: 'Anna Salai, Chennai, 600002' },
                { name: 'Kolkata', lat: 22.5726, lng: 88.3639, addr: 'Park Street, Kolkata, 700016' },
              ].map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    setLiveSync(false);
                    setCoords({ lat: c.lat, lng: c.lng });
                    setAddress(c.addr);
                  }}
                  className="px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Address Display */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 mb-4 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-red-400 shrink-0" />
              <div className="flex-1">
                <div className="text-[11px] text-slate-400 font-semibold uppercase flex items-center gap-2">
                  <span>Resolved Address</span>
                  {liveSync && (
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded uppercase">
                      Live GPS Sync
                    </span>
                  )}
                </div>
                <div className="text-sm text-white font-medium">{address}</div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </div>
            </div>

            {/* Draggable Map Picker */}
            <div className="mb-8">
              <CivicMap
                pickerMode={true}
                pickerCoords={coords}
                userLocation={gpsLocation}
                onPickerCoordsChange={(c) => {
                  setLiveSync(false); // Citizen manually placed/dragged pin
                  setCoords(c);
                  reverseGeocode(c.lat, c.lng);
                }}
                heightClass="h-[380px]"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                <span>
                  Tip: Drag the red pin to fine-tune exact defect spot.
                </span>
                {!liveSync && isTracking && (
                  <button
                    type="button"
                    onClick={() => setLiveSync(true)}
                    className="text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
                  >
                    Snap back to Live GPS
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2.5 text-slate-400 hover:text-white text-sm font-medium flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(5)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Review & Verify</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: VERIFICATION & DUPLICATE CHECK */}
        {step === 5 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Review & Submit</h2>
              <p className="text-slate-400 text-sm">
                Verify details before submitting your report to the municipal resolution queue.
              </p>
            </div>

            {/* Potential Duplicate Alert */}
            {duplicates.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>A similar issue has already been reported nearby</span>
                </div>
                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  We found {duplicates.length} active complaint(s) in this immediate vicinity:
                </p>

                <div className="space-y-2 mb-4">
                  {duplicates.map((dup) => (
                    <div
                      key={dup.complaintId}
                      className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{dup.title}</div>
                        <div className="text-slate-400">
                          {dup.complaintNumber} • {dup.distanceMeters}m away • {dup.status}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/track?id=${dup.complaintNumber}`)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
                      >
                        View Report
                      </button>
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={duplicateConfirmed}
                    onChange={(e) => setDuplicateConfirmed(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span>This is a distinct problem / I wish to report separately</span>
                </label>
              </div>
            )}

            {/* Severity and Priority selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Assessed Severity
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverity(sev)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        severity === sev
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Urgency Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((pri) => (
                    <button
                      key={pri}
                      type="button"
                      onClick={() => setPriority(pri)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        priority === pri
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {pri}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 mb-6 text-xs space-y-2.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="text-white font-semibold">{category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Title:</span>
                <span className="text-white font-semibold">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Location:</span>
                <span className="text-white font-semibold">{address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Evidence Attached:</span>
                <span className="text-emerald-400 font-semibold">{mediaUrls.length} file(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Identity:</span>
                <span className="text-blue-400 font-semibold">Anonymous Citizen</span>
              </div>
            </div>

            {submitError && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={submitting}
                className="px-4 py-2.5 text-slate-400 hover:text-white text-sm font-medium flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Civic Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: SUBMISSION CONFIRMATION */}
        {step === 6 && createdComplaint && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              Database Insertion Confirmed
            </div>

            <h2 className="text-3xl font-extrabold text-white mb-2">Complaint Submitted Successfully</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-8">
              Your civic report has been securely registered in the municipal database and routed to the responsible department.
            </p>

            {/* Tracking Badge */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-md mx-auto mb-8 text-left space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <span className="text-xs text-slate-400">Complaint ID:</span>
                <span className="font-mono text-base font-extrabold text-blue-400">
                  {createdComplaint.complaintNumber}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Category:</span>
                <span className="text-xs font-semibold text-white">{createdComplaint.category}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Status:</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {createdComplaint.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Public Anonymity:</span>
                <span className="text-xs font-mono text-emerald-400">
                  {createdComplaint.anonymousPublicId}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/track?id=${createdComplaint.complaintNumber}`)}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                Track This Complaint Now
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setTitle('');
                  setDescription('');
                  setMediaUrls([]);
                  setCreatedComplaint(null);
                }}
                className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl transition-all cursor-pointer"
              >
                Report Another Issue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
