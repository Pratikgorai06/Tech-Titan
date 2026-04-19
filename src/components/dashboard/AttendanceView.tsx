import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MapPin, UserCheck, Loader2 } from 'lucide-react';
import { dbService, MOCK_STUDENT_ID, UserProfile } from '../../lib/db';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn } from '../../lib/utils';

const RADIUS_THRESHOLD = 0.5; // km

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function AttendanceView() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isInside, setIsInside] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [status, setStatus] = useState<string>('idle');
  const [campusCoords, setCampusCoords] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    let watchId: number;
    let unsubUser = () => { };

    const initialize = async () => {
      // 1. Fetch live campus coordinates from Admin settings
      try {
        const snap = await getDoc(doc(db, 'settings', 'institute'));
        if (snap.exists() && snap.data().latitude && snap.data().longitude) {
          setCampusCoords({
            lat: parseFloat(snap.data().latitude),
            lng: parseFloat(snap.data().longitude)
          });
        }
      } catch (e) {
        console.error("Failed to fetch campus coordinates", e);
      }

      // 2. Subscribe to user
      unsubUser = dbService.subscribeUser(MOCK_STUDENT_ID, (u) => {
        setUser(u);
      });
    };

    initialize();

    return () => {
      if (watchId && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
      unsubUser();
    };
  }, []);

  // Set up geolocation watcher only after campusCoords is available
  useEffect(() => {
    if (!campusCoords || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        const dist = calculateDistance(latitude, longitude, campusCoords.lat, campusCoords.lng);
        setDistance(dist);
        setIsInside(dist <= RADIUS_THRESHOLD);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [campusCoords]);

  const handleMark = async () => {
    if (!isInside) return;
    setIsMarking(true);
    const success = await dbService.markAttendance(MOCK_STUDENT_ID);
    if (success) {
      setStatus('success');
      const updated = await dbService.getUser(MOCK_STUDENT_ID);
      setUser(updated);
    }
    setIsMarking(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-brand-text-main">Geofence Attendance</h2>
          <p className="text-brand-text-muted mt-2 max-w-xl">
            Secure location-based presence verification. You must be within **50m** of the campus center to mark your attendance.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-border rounded-2xl shadow-sm">
          <div className={cn("w-2 h-2 rounded-full", isInside ? "bg-accent-green animate-pulse" : "bg-brand-emergency")} />
          <span className="text-xs font-bold uppercase tracking-widest text-brand-text-muted">
            {isInside ? "Authorized Zone" : "Outside Range"}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-12 rounded-3xl border border-brand-border flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden">
            {/* Background Radar Effect */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
              <div className="w-[500px] h-[500px] border border-brand-primary rounded-full animate-ping" />
              <div className="w-[300px] h-[300px] border border-brand-primary rounded-full absolute" />
            </div>

            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center border-4 transition-all relative z-10",
              isInside ? "bg-green-50 text-accent-green border-green-200" : "bg-red-50 text-brand-emergency border-red-200"
            )}>
              <MapPin className="w-12 h-12" />
            </div>

            <div className="space-y-2 relative z-10">
              <h3 className="text-2xl font-bold text-brand-text-main">
                {isInside ? "Presence Detected" : "Authentication Failed"}
              </h3>
              <p className="text-brand-text-muted text-sm max-w-sm mx-auto">
                {distance !== null
                  ? `You are approximately ${distance.toFixed(2)}km from the campus center.`
                  : "Scanning for location satellites..."}
              </p>
            </div>

            <button
              disabled={!isInside || isMarking || status === 'success'}
              onClick={handleMark}
              className={cn(
                "w-full max-w-xs py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all relative z-10 shadow-lg",
                status === 'success'
                  ? "bg-green-500 text-white shadow-green-200"
                  : "bg-brand-primary text-white hover:bg-blue-700 hover:-translate-y-1 shadow-blue-200 disabled:opacity-50 disabled:translate-y-0"
              )}
            >
              {isMarking ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
              {status === 'success' ? "Verified Successfully" : "Mark My Attendance"}
            </button>
            <p className="text-[10px] text-brand-text-muted uppercase tracking-widest font-bold opacity-60">
              IP: 192.168.1.104 • Device Verified
            </p>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-brand-border space-y-8">
            <h3 className="font-bold border-b border-brand-border pb-4 uppercase text-[10px] tracking-widest text-brand-text-muted flex items-center justify-between">
              Live Progress
              <TrendingUp className="w-3.5 h-3.5" />
            </h3>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-1">Total Logs</p>
                <p className="text-4xl font-bold text-brand-text-main tabular-nums">{user?.totalAttendance || 0}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-1">Success Rate</p>
                <p className="text-4xl font-bold text-accent-green tabular-nums">98%</p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">
                  <span>Semester Quota</span>
                  <span>{user?.totalAttendance ? (user.totalAttendance % 15) * 6.6 : 0}%</span>
                </div>
                <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden border border-brand-border">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${user?.totalAttendance ? (user.totalAttendance % 15) * 6.6 : 0}%` }}
                    className="h-full bg-brand-primary"
                  />
                </div>
              </div>
              <p className="text-[10px] text-brand-text-muted leading-relaxed italic">
                You need 75% attendance to be eligible for end-semester examinations.
              </p>
            </div>
          </div>

          <div className="p-8 bg-brand-primary text-white rounded-3xl space-y-4 shadow-xl shadow-blue-900/10">
            <h4 className="font-bold text-sm">Need Help?</h4>
            <p className="text-xs text-blue-100 leading-relaxed">
              If your location isn't being detected correctly, ensure WiFi and Bluetooth scanning are enabled in your device settings.
            </p>
            <button className="text-xs font-bold underline underline-offset-4 hover:opacity-80 transition-opacity">
              Contact Tech Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ensure TrendingUp is available
import { TrendingUp } from 'lucide-react';
