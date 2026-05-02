import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin, UserCheck, Loader2, QrCode, Camera, CheckCircle2,
  XCircle, AlertCircle, ScanLine, TrendingUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { dbService, UserProfile } from '../../lib/db';
import { markQrAttendance, getStudentAttendanceHistory } from '../../lib/attendanceDb';
import type { AttendanceRecord } from '../../lib/db';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import { Html5Qrcode } from 'html5-qrcode';

const RADIUS_THRESHOLD = 0.5;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Tab = 'geofence' | 'qr';
type ScanStep = 'idle' | 'scanning' | 'location' | 'selfie' | 'submitting' | 'done' | 'error';

export default function AttendanceView() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('qr');

  // ── Geofence state ──
  const [geoUser, setGeoUser] = useState<UserProfile | null>(null);
  const [isInside, setIsInside] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string>('idle');
  const [campusCoords, setCampusCoords] = useState<{ lat: number; lng: number } | null>(null);

  // ── QR scan state ──
  const [collegeId, setCollegeId] = useState('');
  const [step, setStep] = useState<ScanStep>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [selfieDataUrl, setSelfieDataUrl] = useState('');
  const [scanResult, setScanResult] = useState<{ sessionId: string } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  // FIX: store unsubscribe fn so we can clean up the Firestore listener
  const geoUnsubRef = useRef<(() => void) | null>(null);
  const geoWatchRef = useRef<number | null>(null);

  // ── Load campus coords + subscribe user (with cleanup) ──
  useEffect(() => {
    getDoc(doc(db, 'settings', 'institute')).then((snap) => {
      if (snap.exists() && snap.data().latitude) {
        setCampusCoords({
          lat: parseFloat(snap.data().latitude),
          lng: parseFloat(snap.data().longitude),
        });
      }
    });

    if (user) {
      // FIX: capture and store the unsubscribe fn
      geoUnsubRef.current = dbService.subscribeUser(user.uid, setGeoUser);
      getStudentAttendanceHistory(user.uid).then(setHistory);
    }

    return () => {
      // FIX: clean up Firestore listener on unmount
      geoUnsubRef.current?.();
    };
  }, [user]);

  // ── Geofence watcher (with cleanup) ──
  useEffect(() => {
    if (!campusCoords || !navigator.geolocation) return;

    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const d = haversineKm(latitude, longitude, campusCoords.lat, campusCoords.lng);
        setDistance(d);
        setIsInside(d <= RADIUS_THRESHOLD);
      },
      (err) => console.error('[Geofence]', err),
      { enableHighAccuracy: true }
    );

    return () => {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
    };
  }, [campusCoords]);

  // ── Stop scanner when leaving QR tab ──
  useEffect(() => {
    if (tab !== 'qr' && scannerRef.current) {
      scannerRef.current.stop().catch(() => {}).finally(() => {
        // FIX: null the ref after stopping
        scannerRef.current = null;
      });
      setStep('idle');
    }
  }, [tab]);

  // ── Cleanup scanner on unmount ──
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  // ── Geofence mark ──
  const handleGeoMark = async () => {
    if (!isInside || !user) return;
    setIsMarking(true);
    await dbService.markAttendance(user.uid);
    setGeoStatus('success');
    setIsMarking(false);
  };

  // ── QR: stop any running scanner ──
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      // FIX: null after stopping
      scannerRef.current = null;
    }
  }, []);

  // ── QR: start camera scan ──
  const startScan = async () => {
    if (!collegeId.trim()) { setErrorMsg('Please enter your College ID first.'); return; }
    setErrorMsg('');
    setStep('scanning');

    // Wait one frame for the #qr-reader div to mount
    await new Promise((r) => setTimeout(r, 300));

    try {
      await stopScanner(); // ensure no previous scanner running
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await stopScanner();
          try {
            const data = JSON.parse(decodedText);
            if (!data.sessionId) throw new Error('No sessionId in QR');
            setScanResult(data);
            setStep('location');
            getLocationForAttendance();
          } catch {
            setErrorMsg('Invalid QR code. Please scan the one your teacher generated.');
            setStep('error');
          }
        },
        () => {} // frame error — ignore
      );
    } catch (e: any) {
      setErrorMsg(`Camera error: ${e.message || 'Could not access camera.'}`);
      setStep('error');
      await stopScanner();
    }
  };

  // ── QR: get GPS location ──
  const getLocationForAttendance = () => {
    if (!navigator.geolocation) {
      // No GPS API — mark as denied
      setUserLocation({ lat: 0, lng: 0 });
      setStep('selfie');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStep('selfie');
      },
      () => {
        // Permission denied → (0,0) sentinel; attendanceDb will flag it
        setUserLocation({ lat: 0, lng: 0 });
        setStep('selfie');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // ── QR: selfie captured ──
  const handleSelfieCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSelfieDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── QR: submit attendance ──
  const submitAttendance = async () => {
    if (!user || !scanResult || !userLocation) return;
    setStep('submitting');

    // FIX: use campusCoords already in state — avoids a second Firestore read
    const campLat = campusCoords?.lat ?? 0;
    const campLng = campusCoords?.lng ?? 0;

    const result = await markQrAttendance({
      sessionId: scanResult.sessionId,
      studentUid: user.uid,
      studentName: user.displayName || geoUser?.name || 'Student',
      collegeId: collegeId.trim(),
      selfieUrl: selfieDataUrl,
      locationLat: userLocation.lat,
      locationLng: userLocation.lng,
      campusLat: campLat,
      campusLng: campLng,
    });

    if (result.success) {
      setStep('done');
      if (result.error) setErrorMsg(result.error);
      getStudentAttendanceHistory(user.uid).then(setHistory);
    } else {
      setErrorMsg(result.error || 'Failed to mark attendance.');
      setStep('error');
    }
  };

  // ── QR: reset flow ──
  const resetQr = async () => {
    await stopScanner();
    setStep('idle');
    setErrorMsg('');
    setScanResult(null);
    setSelfieDataUrl('');
    setUserLocation(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-black tracking-tight text-brand-text-main">Attendance</h2>
        <p className="text-brand-text-muted mt-1 text-sm">Mark your attendance using QR scan or geofence.</p>
      </header>

      {/* Tab switcher */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {(['qr', 'geofence'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
              tab === t ? 'bg-white shadow-sm text-brand-primary' : 'text-brand-text-muted hover:text-brand-text-main'
            )}
          >
            {t === 'qr' ? '📷 QR Scan' : '📍 Geofence'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── QR Tab ── */}
        {tab === 'qr' && (
          <motion.div
            key="qr"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 space-y-6">

              {/* Idle — enter college ID */}
              {step === 'idle' && (
                <div className="bg-white border border-brand-border rounded-3xl p-8 space-y-6">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-200">
                      <QrCode className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-brand-text-main">QR Attendance</h3>
                      <p className="text-sm text-brand-text-muted mt-1">Enter your college ID, then scan the QR your teacher shared.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-brand-text-muted uppercase tracking-widest">
                      College ID / Roll Number *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CSE2024001"
                      value={collegeId}
                      onChange={(e) => setCollegeId(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && collegeId.trim() && startScan()}
                      className="w-full border border-brand-border rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    />
                  </div>
                  {errorMsg && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {errorMsg}
                    </div>
                  )}
                  <button
                    onClick={startScan}
                    disabled={!collegeId.trim()}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3"
                  >
                    <ScanLine className="w-5 h-5" />
                    Open Camera &amp; Scan QR
                  </button>
                </div>
              )}

              {/* Scanning — FIX: div only rendered when step==='scanning' */}
              {step === 'scanning' && (
                <div className="bg-white border border-brand-border rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-brand-text-main">Scanning QR Code...</h3>
                    <button onClick={resetQr} className="text-sm text-brand-text-muted hover:text-brand-emergency font-bold">
                      Cancel
                    </button>
                  </div>
                  {/* FIX: only rendered during scanning step — Html5Qrcode mounts here */}
                  <div id="qr-reader" className="w-full rounded-2xl overflow-hidden" />
                  <p className="text-xs text-center text-brand-text-muted">
                    Point your camera at the QR code on the board/screen
                  </p>
                </div>
              )}

              {/* Location fetching */}
              {step === 'location' && (
                <div className="bg-white border border-brand-border rounded-3xl p-12 flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-brand-primary animate-pulse" />
                  </div>
                  <h3 className="font-black text-brand-text-main">Verifying Location...</h3>
                  <p className="text-sm text-brand-text-muted">Please allow location access when prompted.</p>
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                </div>
              )}

              {/* Selfie capture */}
              {step === 'selfie' && (
                <div className="bg-white border border-brand-border rounded-3xl p-8 space-y-6">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center mx-auto mb-4">
                      <Camera className="w-7 h-7 text-purple-600" />
                    </div>
                    <h3 className="font-black text-brand-text-main">Take a Selfie</h3>
                    <p className="text-sm text-brand-text-muted mt-1">Photo verification confirms your physical presence.</p>
                  </div>
                  {userLocation && userLocation.lat === 0 && userLocation.lng === 0 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-700">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      Location access denied — your attendance will be saved but flagged for review.
                    </div>
                  )}
                  {selfieDataUrl ? (
                    <div className="space-y-4">
                      <img src={selfieDataUrl} alt="Selfie preview" className="w-48 h-48 object-cover rounded-2xl mx-auto border-2 border-brand-border" />
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setSelfieDataUrl(''); selfieInputRef.current?.click(); }}
                          className="flex-1 py-3 border border-brand-border rounded-xl text-sm font-bold text-brand-text-muted hover:bg-slate-50 transition-colors"
                        >
                          Retake
                        </button>
                        <button
                          onClick={submitAttendance}
                          className="flex-1 py-3 bg-brand-primary text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Submit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        ref={selfieInputRef}
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={handleSelfieCapture}
                        className="hidden"
                      />
                      <button
                        onClick={() => selfieInputRef.current?.click()}
                        className="w-full py-4 bg-purple-600 text-white font-black rounded-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3"
                      >
                        <Camera className="w-5 h-5" />
                        Open Camera
                      </button>
                      <button
                        onClick={submitAttendance}
                        className="w-full py-3 border border-brand-border rounded-2xl text-sm font-bold text-brand-text-muted hover:bg-slate-50 transition-colors"
                      >
                        Skip Photo &amp; Submit
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Submitting */}
              {step === 'submitting' && (
                <div className="bg-white border border-brand-border rounded-3xl p-12 flex flex-col items-center gap-4 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
                  <h3 className="font-black text-brand-text-main">Marking Attendance...</h3>
                  <p className="text-sm text-brand-text-muted">Verifying location and saving your record.</p>
                </div>
              )}

              {/* Success */}
              {step === 'done' && (
                <div className="bg-white border border-green-200 rounded-3xl p-12 flex flex-col items-center gap-4 text-center">
                  <div className="w-20 h-20 rounded-full bg-green-50 border-4 border-green-200 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-black text-brand-text-main">Attendance Marked!</h3>
                  {errorMsg && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 text-left max-w-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {errorMsg}
                    </div>
                  )}
                  <p className="text-sm text-brand-text-muted">Your attendance has been recorded successfully.</p>
                  <button
                    onClick={resetQr}
                    className="mt-2 px-6 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Error */}
              {step === 'error' && (
                <div className="bg-white border border-red-200 rounded-3xl p-8 flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="font-black text-brand-text-main">Something went wrong</h3>
                  <p className="text-sm text-red-600 max-w-xs">{errorMsg}</p>
                  <button
                    onClick={resetQr}
                    className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>

            {/* Right: attendance history */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white border border-brand-border rounded-3xl p-6 space-y-4">
                <h3 className="font-black text-[11px] uppercase tracking-widest text-brand-text-muted">
                  Recent QR Attendance
                </h3>
                {history.length === 0 ? (
                  <p className="text-xs text-brand-text-muted text-center py-6">No QR attendance yet.</p>
                ) : (
                  <div className="space-y-3">
                    {history.slice(0, 6).map((r) => (
                      <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-brand-border">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                          r.verified ? 'bg-green-100' : 'bg-amber-100'
                        )}>
                          {r.verified
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            : <AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-brand-text-main truncate">
                            {r.sessionId.slice(0, 10)}…
                          </p>
                          <p className="text-[10px] text-brand-text-muted">
                            {r.markedAt.toDate().toLocaleDateString()} · {r.verified ? '✅ Verified' : '⚠️ Flagged'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Geofence Tab ── */}
        {tab === 'geofence' && (
          <motion.div key="geo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white p-12 rounded-3xl border border-brand-border flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                  <div className="w-[500px] h-[500px] border border-brand-primary rounded-full animate-ping" />
                </div>
                <div className={cn(
                  'w-24 h-24 rounded-full flex items-center justify-center border-4 transition-all relative z-10',
                  isInside ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-500 border-red-200'
                )}>
                  <MapPin className="w-12 h-12" />
                </div>
                <div className="space-y-2 relative z-10">
                  <h3 className="text-2xl font-bold text-brand-text-main">
                    {isInside ? 'Presence Detected' : 'Outside Campus Range'}
                  </h3>
                  <p className="text-brand-text-muted text-sm">
                    {distance !== null ? `${distance.toFixed(2)} km from campus center` : 'Scanning for location…'}
                  </p>
                  {!campusCoords && (
                    <p className="text-[12px] text-amber-600 font-medium">
                      ⚠️ Campus coordinates not configured — contact admin.
                    </p>
                  )}
                </div>
                <button
                  disabled={!isInside || isMarking || geoStatus === 'success'}
                  onClick={handleGeoMark}
                  className={cn(
                    'w-full max-w-xs py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all relative z-10 shadow-lg',
                    geoStatus === 'success'
                      ? 'bg-green-500 text-white'
                      : 'bg-brand-primary text-white hover:-translate-y-1 shadow-blue-200 disabled:opacity-50 disabled:translate-y-0'
                  )}
                >
                  {isMarking ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
                  {geoStatus === 'success' ? 'Verified Successfully' : 'Mark My Attendance'}
                </button>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white p-8 rounded-3xl border border-brand-border space-y-6">
                <h3 className="font-bold border-b border-brand-border pb-4 uppercase text-[10px] tracking-widest text-brand-text-muted flex items-center justify-between">
                  Live Progress <TrendingUp className="w-3.5 h-3.5" />
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-1">Total Logs</p>
                    <p className="text-4xl font-bold text-brand-text-main tabular-nums">{geoUser?.totalAttendance || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-1">Success Rate</p>
                    <p className="text-4xl font-bold text-green-600 tabular-nums">98%</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
