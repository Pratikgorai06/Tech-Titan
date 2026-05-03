import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, Loader2, CheckCircle2, XCircle, Trash2,
  ScanFace, Plus, Save, AlertCircle, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  loadFaceModels, detectSingleFace, captureFaceCrop, areModelsLoaded
} from '../../lib/faceService';
import { cn } from '../../lib/utils';

const MAX_PHOTOS = 3;

export default function FaceRegistration() {
  const { user } = useAuth();

  const [modelsReady, setModelsReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Stored face data
  const [photos, setPhotos] = useState<string[]>([]);
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [existingRegistered, setExistingRegistered] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionLoopRef = useRef<number | null>(null);

  // ── Load models + existing face data ──
  useEffect(() => {
    const init = async () => {
      try {
        await loadFaceModels();
        setModelsReady(true);
      } catch (e) {
        console.error('Face model load failed:', e);
      } finally {
        setLoadingModels(false);
      }
    };
    init();

    // Load existing face data
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.facePhotos?.length) setPhotos(data.facePhotos);
          if (data.faceDescriptors?.length) setDescriptors(data.faceDescriptors);
          if (data.faceRegistered) setExistingRegistered(true);
        }
      });
    }

    return () => {
      stopCamera();
    };
  }, [user]);

  // ── Camera control ──
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      startDetectionLoop();
    } catch (e: any) {
      console.error('Camera error:', e);
    }
  };

  const stopCamera = useCallback(() => {
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setFaceDetected(false);
  }, []);

  // ── Real-time face detection loop ──
  const startDetectionLoop = () => {
    const loop = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        detectionLoopRef.current = requestAnimationFrame(loop);
        return;
      }
      try {
        const result = await detectSingleFace(videoRef.current);
        setFaceDetected(!!result);
      } catch {
        setFaceDetected(false);
      }
      detectionLoopRef.current = requestAnimationFrame(loop);
    };
    detectionLoopRef.current = requestAnimationFrame(loop);
  };

  // ── Capture photo ──
  const capturePhoto = async () => {
    if (!videoRef.current || photos.length >= MAX_PHOTOS) return;
    setCapturing(true);

    try {
      const result = await detectSingleFace(videoRef.current);
      if (!result) {
        setCapturing(false);
        return;
      }

      const thumbnail = captureFaceCrop(videoRef.current, result.detection, 200);
      const descArray = Array.from(result.descriptor);

      setPhotos((prev) => [...prev, thumbnail]);
      setDescriptors((prev) => [...prev, descArray]);
    } catch (e) {
      console.error('Capture error:', e);
    } finally {
      setCapturing(false);
    }
  };

  // ── Remove photo ──
  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setDescriptors((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Save to Firestore ──
  const handleSave = async () => {
    if (!user || photos.length === 0) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        facePhotos: photos,
        faceDescriptors: descriptors,
        faceRegistered: true,
      }, { merge: true });
      setSaved(true);
      setExistingRegistered(true);
      stopCamera();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── Reset all face data ──
  const handleReset = async () => {
    if (!user) return;
    setPhotos([]);
    setDescriptors([]);
    setExistingRegistered(false);
    await setDoc(doc(db, 'users', user.uid), {
      facePhotos: [],
      faceDescriptors: [],
      faceRegistered: false,
    }, { merge: true });
  };

  // ── Loading state ──
  if (loadingModels) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col items-center justify-center p-20 space-y-4 animate-in fade-in">
        <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
        <p className="text-sm font-bold text-brand-text-muted">Loading face recognition models...</p>
        <p className="text-[11px] text-brand-text-muted">This may take a few seconds on first load</p>
      </div>
    );
  }

  if (!modelsReady) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col items-center justify-center p-20 space-y-4 animate-in fade-in">
        <XCircle className="w-10 h-10 text-red-500" />
        <p className="text-sm font-bold text-brand-text-main">Failed to load face models</p>
        <p className="text-[11px] text-brand-text-muted">Please check your internet connection and reload.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <header>
        <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest mb-1">Biometric Setup</p>
        <h2 className="text-3xl font-black tracking-tight text-brand-text-main flex items-center gap-3">
          <ScanFace className="w-8 h-8 text-brand-primary" />
          Face Registration
        </h2>
        <p className="text-brand-text-muted mt-2 text-sm">
          Register your face for secure attendance verification. Capture 1–3 photos from different angles.
        </p>
      </header>

      {/* Status banner */}
      {existingRegistered && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-green-800">Face ID registered</p>
            <p className="text-[11px] text-green-600">Your face data is stored for attendance verification. You can re-register anytime.</p>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-[11px] font-bold text-red-600 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Camera panel */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
            {/* Camera viewport */}
            <div className="relative bg-slate-900 aspect-[4/3] flex items-center justify-center">
              <video
                ref={videoRef}
                className={cn(
                  'w-full h-full object-cover',
                  cameraActive ? 'block' : 'hidden'
                )}
                playsInline
                muted
                style={{ transform: 'scaleX(-1)' }}
              />

              {!cameraActive && (
                <div className="flex flex-col items-center gap-4 text-white/50">
                  <Camera className="w-16 h-16" />
                  <p className="text-sm font-medium">Camera is off</p>
                </div>
              )}

              {/* Face detection indicator */}
              {cameraActive && (
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md',
                    faceDetected
                      ? 'bg-green-500/20 text-green-400 border border-green-400/30'
                      : 'bg-red-500/20 text-red-400 border border-red-400/30'
                  )}>
                    <div className={cn('w-2 h-2 rounded-full', faceDetected ? 'bg-green-400 animate-pulse' : 'bg-red-400')} />
                    {faceDetected ? 'Face detected' : 'No face found'}
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white/70 text-[10px] font-bold">
                    {photos.length}/{MAX_PHOTOS}
                  </div>
                </div>
              )}

              {/* Face alignment guide */}
              {cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={cn(
                    'w-48 h-60 rounded-[50%] border-2 border-dashed transition-colors duration-300',
                    faceDetected ? 'border-green-400/50' : 'border-white/20'
                  )} />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-5 space-y-3">
              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  disabled={photos.length >= MAX_PHOTOS}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3 text-sm"
                >
                  <Camera className="w-5 h-5" />
                  {photos.length === 0 ? 'Open Camera' : 'Capture Another Photo'}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={capturePhoto}
                    disabled={!faceDetected || capturing || photos.length >= MAX_PHOTOS}
                    className="flex-1 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2 text-sm"
                  >
                    {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    {capturing ? 'Capturing...' : 'Capture'}
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-5 py-3.5 bg-slate-100 text-brand-text-muted rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors"
                  >
                    Stop
                  </button>
                </div>
              )}

              {!faceDetected && cameraActive && (
                <p className="text-[11px] text-center text-amber-600 font-medium">
                  Position your face inside the oval guide for detection
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Captured photos panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-brand-border rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-brand-text-main uppercase tracking-widest">
                Registered Faces
              </h3>
              <span className="text-[10px] font-bold text-brand-text-muted bg-slate-100 px-2 py-1 rounded-full">
                {photos.length}/{MAX_PHOTOS}
              </span>
            </div>

            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <ScanFace className="w-10 h-10 text-slate-200" />
                <p className="text-xs text-brand-text-muted text-center">
                  No photos captured yet. Open the camera and take 1–3 photos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <AnimatePresence>
                  {photos.map((photo, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative group"
                    >
                      <img
                        src={photo}
                        alt={`Face ${i + 1}`}
                        className="w-full aspect-square rounded-2xl object-cover border-2 border-brand-border"
                      />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-1 left-1 right-1 text-center">
                        <span className="text-[9px] font-black text-white bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                          Photo {i + 1}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Add more slot */}
                {photos.length < MAX_PHOTOS && (
                  <button
                    onClick={cameraActive ? capturePhoto : startCamera}
                    disabled={cameraActive && !faceDetected}
                    className="w-full aspect-square rounded-2xl border-2 border-dashed border-brand-border flex flex-col items-center justify-center gap-1 text-brand-text-muted hover:border-brand-primary hover:text-brand-primary transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-[9px] font-bold">Add</span>
                  </button>
                )}
              </div>
            )}

            {/* Save button */}
            {photos.length > 0 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  'w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg',
                  saved
                    ? 'bg-green-500 text-white'
                    : 'bg-brand-primary text-white hover:bg-blue-700'
                )}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : saved ? 'Face Data Saved!' : `Save ${photos.length} Photo${photos.length > 1 ? 's' : ''}`}
              </button>
            )}
          </div>

          {/* Info cards */}
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                Take photos with good lighting, different angles, and no accessories covering your face for best results.
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-start gap-3">
              <ScanFace className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-purple-700 font-medium leading-relaxed">
                Your face data is used only for attendance verification and stored securely. During attendance, you'll complete a liveness challenge (blink, smile) to prevent spoofing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
