import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin, UserCheck, Loader2, QrCode, Camera, CheckCircle2,
  XCircle, AlertCircle, ScanLine, ScanFace, Shield
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { dbService, UserProfile } from '../../lib/db';
import { markQrAttendance, getStudentAttendanceHistory } from '../../lib/attendanceDb';
import type { AttendanceRecord } from '../../lib/db';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import { Html5Qrcode } from 'html5-qrcode';
import { matchDescriptors, getDeviceFingerprint } from '../../lib/faceService';
import LivenessChallenge from '../attendance/LivenessChallenge';

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

type ScanStep = 'idle' | 'scanning' | 'location' | 'liveness' | 'verifying' | 'submitting' | 'done' | 'error';

export default function AttendanceView() {
  const { user } = useAuth();

  // ── Database User State ──
  const [dbUser, setDbUser] = useState<UserProfile | null>(null);
  const [campusCoords, setCampusCoords] = useState<{ lat: number; lng: number } | null>(null);

  // ── QR scan state ──
  const [collegeId, setCollegeId] = useState('');
  const [step, setStep] = useState<ScanStep>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [selfieDataUrl, setSelfieDataUrl] = useState('');
  const [scanResult, setScanResult] = useState<{ sessionId: string } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);

  // ── Face verification state ──
  const [faceVerified, setFaceVerified] = useState(false);
  const [livenessVerified, setLivenessVerified] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const dbUserUnsubRef = useRef<(() => void) | null>(null);

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
      dbUserUnsubRef.current = dbService.subscribeUser(user.uid, setDbUser);
      getStudentAttendanceHistory(user.uid).then(setHistory);
    }

    return () => {
      dbUserUnsubRef.current?.();
    };
  }, [user]);

  // ── Cleanup scanner on unmount ──
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  // ── QR: stop any running scanner ──
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
  }, []);

  // ── QR: start camera scan ──
  const startScan = async () => {
    if (!collegeId.trim()) { setErrorMsg('Please enter your College ID first.'); return; }
    setErrorMsg('');
    setStep('scanning');

    await new Promise((r) => setTimeout(r, 300));

    try {
      await stopScanner();
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
        () => {}
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
      setUserLocation({ lat: 0, lng: 0 });
      setStep('liveness');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStep('liveness');
      },
      () => {
        setUserLocation({ lat: 0, lng: 0 });
        setStep('liveness');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // ── Liveness challenge completed ──
  const handleLivenessComplete = async (result: {
    passed: boolean;
    selfieDataUrl: string;
    descriptor: Float32Array | null;
  }) => {
    if (!result.passed) {
      setErrorMsg('Liveness verification failed. Please try again.');
      setStep('error');
      return;
    }

    setLivenessVerified(true);
    setSelfieDataUrl(result.selfieDataUrl);
    setFaceDescriptor(result.descriptor);

    // ── Face matching ──
    setStep('verifying');

    if (result.descriptor && dbUser?.faceDescriptors?.length) {
      const matchResult = matchDescriptors(dbUser.faceDescriptors, result.descriptor);
      setFaceVerified(matchResult.match);

      if (!matchResult.match) {
        setErrorMsg(
          `⚠️ Face verification failed (distance: ${matchResult.distance.toFixed(2)}). ` +
          'Your face does not match the registered profile. Attendance will be saved but flagged.'
        );
      }
    } else {
      // No face data registered — skip face matching, just note it
      setFaceVerified(false);
    }

    // Auto-submit after verification
    await submitAttendance(result.selfieDataUrl, result.descriptor);
  };

  const handleLivenessCancel = () => {
    resetQr();
  };

  // ── QR: submit attendance ──
  const submitAttendance = async (selfie?: string, descriptor?: Float32Array | null) => {
    if (!user || !scanResult || !userLocation) return;
    setStep('submitting');

    const campLat = campusCoords?.lat ?? 0;
    const campLng = campusCoords?.lng ?? 0;

    // Face verification
    let faceMatch = false;
    if (descriptor && dbUser?.faceDescriptors?.length) {
      const matchResult = matchDescriptors(dbUser.faceDescriptors, descriptor);
      faceMatch = matchResult.match;
    }

    const result = await markQrAttendance({
      sessionId: scanResult.sessionId,
      studentUid: user.uid,
      studentName: user.displayName || dbUser?.name || 'Student',
      collegeId: collegeId.trim(),
      selfieUrl: selfie || selfieDataUrl,
      locationLat: userLocation.lat,
      locationLng: userLocation.lng,
      campusLat: campLat,
      campusLng: campLng,
      faceVerified: faceMatch,
      livenessVerified: true,
      deviceId: getDeviceFingerprint(),
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
    setFaceVerified(false);
    setLivenessVerified(false);
    setFaceDescriptor(null);
  };

  const hasFaceData = dbUser?.faceRegistered && (dbUser?.faceDescriptors?.length ?? 0) > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-black tracking-tight text-brand-text-main">Attendance</h2>
        <p className="text-brand-text-muted mt-1 text-sm">Mark your attendance using QR scan with face & liveness verification.</p>
      </header>

      {/* Face registration reminder */}
      {!hasFaceData && step === 'idle' && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <ScanFace className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Face ID not registered</p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              Register your face in <strong>Face ID</strong> (sidebar) for verified attendance. Without it, your records will be flagged.
            </p>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
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

                  {/* How it works — updated */}
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    {[
                      { icon: QrCode, label: 'Scan QR' },
                      { icon: MapPin, label: 'GPS Check' },
                      { icon: Shield, label: 'Liveness' },
                      { icon: ScanFace, label: 'Face Match' },
                    ].map((s) => (
                      <div key={s.label} className="flex flex-col items-center gap-1.5 p-2 bg-slate-50 rounded-xl">
                        <s.icon className="w-4 h-4 text-brand-text-muted" />
                        <span className="text-[9px] font-bold text-brand-text-muted uppercase tracking-wider">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scanning */}
              {step === 'scanning' && (
                <div className="bg-white border border-brand-border rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-brand-text-main">Scanning QR Code...</h3>
                    <button onClick={resetQr} className="text-sm text-brand-text-muted hover:text-brand-emergency font-bold">
                      Cancel
                    </button>
                  </div>
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

              {/* Liveness Challenge */}
              {step === 'liveness' && (
                <div className="space-y-4">
                  {userLocation && userLocation.lat === 0 && userLocation.lng === 0 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-700">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      Location access denied — your attendance will be saved but flagged for review.
                    </div>
                  )}
                  <LivenessChallenge
                    onComplete={handleLivenessComplete}
                    onCancel={handleLivenessCancel}
                    challengeCount={2}
                    timeoutSeconds={15}
                  />
                </div>
              )}

              {/* Verifying face */}
              {step === 'verifying' && (
                <div className="bg-white border border-brand-border rounded-3xl p-12 flex flex-col items-center gap-4 text-center">
                  <ScanFace className="w-10 h-10 text-brand-primary animate-pulse" />
                  <h3 className="font-black text-brand-text-main">Verifying Face...</h3>
                  <p className="text-sm text-brand-text-muted">Comparing your face with registered data.</p>
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                </div>
              )}

              {/* Submitting */}
              {step === 'submitting' && (
                <div className="bg-white border border-brand-border rounded-3xl p-12 flex flex-col items-center gap-4 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
                  <h3 className="font-black text-brand-text-main">Marking Attendance...</h3>
                  <p className="text-sm text-brand-text-muted">Saving your verified attendance record.</p>
                </div>
              )}

              {/* Success */}
              {step === 'done' && (
                <div className="bg-white border border-green-200 rounded-3xl p-10 flex flex-col items-center gap-4 text-center">
                  <div className="w-20 h-20 rounded-full bg-green-50 border-4 border-green-200 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-black text-brand-text-main">Attendance Marked!</h3>

                  {/* Verification badges */}
                  <div className="flex flex-wrap justify-center gap-2 mt-1">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-[10px] font-black text-green-700 uppercase">
                      <Shield className="w-3 h-3" /> Liveness ✓
                    </span>
                    {faceVerified ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-[10px] font-black text-green-700 uppercase">
                        <ScanFace className="w-3 h-3" /> Face Matched ✓
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-black text-amber-700 uppercase">
                        <ScanFace className="w-3 h-3" /> {hasFaceData ? 'Face Mismatch' : 'No Face Data'}
                      </span>
                    )}
                  </div>

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
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-brand-text-muted">
                              {r.markedAt.toDate().toLocaleDateString()}
                            </span>
                            {r.faceVerified && (
                              <span className="text-[8px] font-bold text-green-600 bg-green-50 px-1 py-0.5 rounded">Face ✓</span>
                            )}
                            {r.livenessVerified && (
                              <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded">Live ✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
