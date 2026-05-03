import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin, Loader2, QrCode, Camera, CheckCircle2,
  XCircle, AlertCircle, ScanFace, Shield, Upload,
  Keyboard, Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { dbService, UserProfile } from '../../lib/db';
import { markQrAttendance, getStudentAttendanceHistory } from '../../lib/attendanceDb';
import type { AttendanceRecord } from '../../lib/db';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import {
  loadFaceModels, detectSingleFace, captureFrame,
  matchDescriptors, getDeviceFingerprint
} from '../../lib/faceService';

type ScanStep = 'idle' | 'location' | 'camera' | 'verifying' | 'submitting' | 'done' | 'error';

export default function AttendanceView() {
  const { user } = useAuth();

  const [dbUser, setDbUser] = useState<UserProfile | null>(null);
  const [campusCoords, setCampusCoords] = useState<{ lat: number; lng: number } | null>(null);

  // ── Input state ──
  const [sessionCode, setSessionCode] = useState('');
  const [inputMode, setInputMode] = useState<'code' | 'image'>('code');
  const [step, setStep] = useState<ScanStep>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [selfieDataUrl, setSelfieDataUrl] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);

  // ── Face state ──
  const [faceVerified, setFaceVerified] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrImageRef = useRef<HTMLInputElement>(null);
  const dbUserUnsubRef = useRef<(() => void) | null>(null);

  // ── Load data on mount ──
  useEffect(() => {
    // Load campus coords
    getDoc(doc(db, 'settings', 'institute')).then((snap) => {
      if (snap.exists() && snap.data().latitude) {
        setCampusCoords({ lat: parseFloat(snap.data().latitude), lng: parseFloat(snap.data().longitude) });
      }
    });

    if (user) {
      dbUserUnsubRef.current = dbService.subscribeUser(user.uid, setDbUser);
      getStudentAttendanceHistory(user.uid).then(setHistory);
    }

    // Load face models in background (don't block UI)
    loadFaceModels().then(() => setModelsReady(true)).catch(() => {});

    return () => {
      dbUserUnsubRef.current?.();
      stopCamera();
    };
  }, [user]);

  // ── Stop camera ──
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  // ── Extract session ID from QR image upload ──
  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');

    // Decode QR from image using a canvas + the html5-qrcode library
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-decode-hidden');
      const result = await scanner.scanFile(file, true);
      const data = JSON.parse(result);
      if (!data.sessionId) throw new Error('No sessionId');
      setSessionCode(data.sessionId);
      scanner.clear();
    } catch {
      setErrorMsg('Could not read QR code from image. Make sure it\'s a valid QR code.');
    }

    // Reset input
    if (qrImageRef.current) qrImageRef.current.value = '';
  };

  // ── Start attendance flow ──
  const startAttendance = () => {
    if (!sessionCode.trim()) {
      setErrorMsg('Please enter a session code or upload a QR image.');
      return;
    }
    setErrorMsg('');
    setStep('location');
    getLocation();
  };

  // ── Get GPS ──
  const getLocation = () => {
    if (!navigator.geolocation) {
      setUserLocation({ lat: 0, lng: 0 });
      openCamera();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        openCamera();
      },
      () => {
        setUserLocation({ lat: 0, lng: 0 });
        openCamera();
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // ── Open front camera for selfie ──
  const openCamera = async () => {
    setStep('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setErrorMsg('Could not access camera. Please allow camera permissions.');
      setStep('error');
    }
  };

  // ── Capture selfie & verify face (single-shot) ──
  const captureSelfie = async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    setErrorMsg('');

    try {
      // 1. Capture frame
      const selfie = captureFrame(videoRef.current);
      setSelfieDataUrl(selfie);
      stopCamera();

      // 2. Face verification (if models loaded and user has registered face)
      setStep('verifying');
      let faceMatch = false;

      if (modelsReady && dbUser?.faceDescriptors?.length) {
        try {
          const result = await detectSingleFace(videoRef.current!);
          if (result) {
            const matchResult = matchDescriptors(dbUser.faceDescriptors, result.descriptor);
            faceMatch = matchResult.match;
            if (!faceMatch) {
              setErrorMsg(`⚠️ Face mismatch (score: ${matchResult.distance.toFixed(2)}). Attendance saved but flagged.`);
            }
          }
        } catch {
          // Face detection failed — proceed without face verification
        }
      }

      setFaceVerified(faceMatch);

      // 3. Submit
      await submitAttendance(selfie, faceMatch);
    } catch {
      setErrorMsg('Failed to capture photo. Please try again.');
      setStep('error');
    } finally {
      setCapturing(false);
    }
  };

  // ── Submit attendance ──
  const submitAttendance = async (selfie: string, faceMatch: boolean) => {
    if (!user || !userLocation) return;
    setStep('submitting');

    const campLat = campusCoords?.lat ?? 0;
    const campLng = campusCoords?.lng ?? 0;

    const result = await markQrAttendance({
      sessionId: sessionCode.trim(),
      studentUid: user.uid,
      studentName: user.displayName || dbUser?.name || 'Student',
      collegeId: dbUser?.collegeId || '',
      selfieUrl: selfie,
      locationLat: userLocation.lat,
      locationLng: userLocation.lng,
      campusLat: campLat,
      campusLng: campLng,
      faceVerified: faceMatch,
      livenessVerified: true,
      deviceId: getDeviceFingerprint(),
      regNo: dbUser?.collegeId || '',
      department: dbUser?.department || '',
      academicYear: dbUser?.academicYear || '',
      section: dbUser?.section || '',
      batch: dbUser?.batch || '',
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

  // ── Reset ──
  const resetFlow = () => {
    stopCamera();
    setStep('idle');
    setErrorMsg('');
    setSessionCode('');
    setSelfieDataUrl('');
    setUserLocation(null);
    setFaceVerified(false);
  };

  const hasFaceData = dbUser?.faceRegistered && (dbUser?.faceDescriptors?.length ?? 0) > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-black tracking-tight text-brand-text-main">Attendance</h2>
        <p className="text-brand-text-muted mt-1 text-sm">Enter session code or upload QR image, then take a selfie to mark attendance.</p>
      </header>

      {/* Face ID reminder */}
      {!hasFaceData && step === 'idle' && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <ScanFace className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Face ID not registered</p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              Go to <strong>Face ID</strong> in the sidebar to register your face for verified attendance.
            </p>
          </div>
        </div>
      )}

      {/* Hidden div for QR decode */}
      <div id="qr-decode-hidden" style={{ display: 'none' }} />

      <AnimatePresence mode="wait">
        <motion.div
          key="main"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          <div className="lg:col-span-2 space-y-6">

            {/* ── IDLE: Enter code or upload QR ── */}
            {step === 'idle' && (
              <div className="bg-white border border-brand-border rounded-3xl p-8 space-y-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-200">
                    <QrCode className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-brand-text-main">QR Attendance</h3>
                    <p className="text-sm text-brand-text-muted mt-1">Enter the session code or upload a QR image from your teacher.</p>
                  </div>
                </div>

                {/* Input mode tabs */}
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    onClick={() => setInputMode('code')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all',
                      inputMode === 'code' ? 'bg-white text-brand-text-main shadow-sm' : 'text-brand-text-muted hover:text-brand-text-main'
                    )}
                  >
                    <Keyboard className="w-4 h-4" />
                    Enter Code
                  </button>
                  <button
                    onClick={() => setInputMode('image')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all',
                      inputMode === 'image' ? 'bg-white text-brand-text-main shadow-sm' : 'text-brand-text-muted hover:text-brand-text-main'
                    )}
                  >
                    <ImageIcon className="w-4 h-4" />
                    Upload QR Image
                  </button>
                </div>

                {/* Code input */}
                {inputMode === 'code' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-brand-text-muted uppercase tracking-widest">
                      Session Code *
                    </label>
                    <input
                      type="text"
                      placeholder="Paste the session code from your teacher..."
                      value={sessionCode}
                      onChange={(e) => setSessionCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sessionCode.trim() && startAttendance()}
                      className="w-full border border-brand-border rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none font-mono"
                    />
                  </div>
                )}

                {/* QR image upload */}
                {inputMode === 'image' && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-brand-text-muted uppercase tracking-widest">
                      Upload QR Code Image
                    </label>
                    <input
                      ref={qrImageRef}
                      type="file"
                      accept="image/*"
                      onChange={handleQrImageUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => qrImageRef.current?.click()}
                      className="w-full py-6 border-2 border-dashed border-brand-border rounded-2xl flex flex-col items-center gap-3 text-brand-text-muted hover:border-brand-primary hover:text-brand-primary transition-colors"
                    >
                      <Upload className="w-8 h-8" />
                      <span className="text-sm font-bold">Click to upload QR image</span>
                      <span className="text-[10px]">or screenshot from your teacher</span>
                    </button>
                    {sessionCode && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        Session code extracted: <code className="font-mono text-[11px] bg-green-100 px-1.5 py-0.5 rounded">{sessionCode.slice(0, 15)}...</code>
                      </div>
                    )}
                  </div>
                )}

                {errorMsg && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errorMsg}
                  </div>
                )}

                <button
                  onClick={startAttendance}
                  disabled={!sessionCode.trim()}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3"
                >
                  <Camera className="w-5 h-5" />
                  Continue & Take Selfie
                </button>

                {/* Steps indicator */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[
                    { icon: QrCode, label: 'Enter Code' },
                    { icon: MapPin, label: 'GPS Check' },
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

            {/* ── LOCATION: Getting GPS ── */}
            {step === 'location' && (
              <div className="bg-white border border-brand-border rounded-3xl p-12 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-brand-primary animate-pulse" />
                </div>
                <h3 className="font-black text-brand-text-main">Getting Location...</h3>
                <p className="text-sm text-brand-text-muted">Allow location access when prompted.</p>
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              </div>
            )}

            {/* ── CAMERA: Take selfie ── */}
            {step === 'camera' && (
              <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
                <div className="relative bg-slate-900 aspect-[4/3] flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className={cn('w-full h-full object-cover', cameraActive ? 'block' : 'hidden')}
                    playsInline muted
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  {!cameraActive && (
                    <div className="flex flex-col items-center gap-3 text-white/50">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-sm font-medium">Starting camera...</p>
                    </div>
                  )}
                  {userLocation && userLocation.lat === 0 && userLocation.lng === 0 && (
                    <div className="absolute top-3 left-3 right-3 flex items-center gap-2 px-3 py-2 bg-amber-500/20 backdrop-blur-md rounded-xl text-amber-300 text-[10px] font-bold">
                      <AlertCircle className="w-3 h-3" /> Location denied — attendance will be flagged
                    </div>
                  )}
                </div>
                <div className="p-5 space-y-3">
                  <button
                    onClick={captureSelfie}
                    disabled={!cameraActive || capturing}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {capturing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    {capturing ? 'Processing...' : '📸 Take Selfie & Mark Attendance'}
                  </button>
                  <button onClick={resetFlow} className="w-full py-2 text-sm text-brand-text-muted font-bold hover:text-red-500 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── VERIFYING ── */}
            {step === 'verifying' && (
              <div className="bg-white border border-brand-border rounded-3xl p-12 flex flex-col items-center gap-4 text-center">
                <ScanFace className="w-10 h-10 text-brand-primary animate-pulse" />
                <h3 className="font-black text-brand-text-main">Verifying Face...</h3>
                <p className="text-sm text-brand-text-muted">Matching your selfie with registered face data.</p>
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              </div>
            )}

            {/* ── SUBMITTING ── */}
            {step === 'submitting' && (
              <div className="bg-white border border-brand-border rounded-3xl p-12 flex flex-col items-center gap-4 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
                <h3 className="font-black text-brand-text-main">Marking Attendance...</h3>
                <p className="text-sm text-brand-text-muted">Saving your attendance record.</p>
              </div>
            )}

            {/* ── DONE ── */}
            {step === 'done' && (
              <div className="bg-white border border-green-200 rounded-3xl p-10 flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 rounded-full bg-green-50 border-4 border-green-200 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-2xl font-black text-brand-text-main">Attendance Marked!</h3>
                <div className="flex flex-wrap justify-center gap-2 mt-1">
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
                <button onClick={resetFlow} className="mt-2 px-6 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
                  Done
                </button>
              </div>
            )}

            {/* ── ERROR ── */}
            {step === 'error' && (
              <div className="bg-white border border-red-200 rounded-3xl p-8 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="font-black text-brand-text-main">Something went wrong</h3>
                <p className="text-sm text-red-600 max-w-xs">{errorMsg}</p>
                <button onClick={resetFlow} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors">
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* Right: history */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-brand-border rounded-3xl p-6 space-y-4">
              <h3 className="font-black text-[11px] uppercase tracking-widest text-brand-text-muted">
                Recent Attendance
              </h3>
              {history.length === 0 ? (
                <p className="text-xs text-brand-text-muted text-center py-6">No attendance records yet.</p>
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
                          {r.sessionId.slice(0, 12)}…
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-brand-text-muted">
                            {r.markedAt.toDate().toLocaleDateString()}
                          </span>
                          {r.faceVerified && (
                            <span className="text-[8px] font-bold text-green-600 bg-green-50 px-1 py-0.5 rounded">Face ✓</span>
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
