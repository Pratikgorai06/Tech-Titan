import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, Loader2, CheckCircle2, XCircle, Trash2,
  ScanFace, Save, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { loadFaceModels, detectSingleFace, captureFaceCrop } from '../../lib/faceService';
import { cn } from '../../lib/utils';

const MAX_PHOTOS = 3;

export default function FaceRegistration() {
  const { user } = useAuth();

  const [modelsReady, setModelsReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [captureError, setCaptureError] = useState('');

  const [photos, setPhotos] = useState<string[]>([]);
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [existingRegistered, setExistingRegistered] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Load models + existing face data ──
  useEffect(() => {
    loadFaceModels()
      .then(() => setModelsReady(true))
      .catch((e) => console.error('Model load failed:', e))
      .finally(() => setLoadingModels(false));

    if (user) {
      getDoc(doc(db, 'users', user.uid)).then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.facePhotos?.length) setPhotos(d.facePhotos);
          if (d.faceDescriptors?.length) setDescriptors(d.faceDescriptors);
          if (d.faceRegistered) setExistingRegistered(true);
        }
      });
    }
    return () => stopCamera();
  }, [user]);

  // ── Camera ──
  const startCamera = async () => {
    setCaptureError('');
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
      setCaptureError('Could not access camera. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  // ── Single-shot capture: snap photo → detect face → extract descriptor ──
  const capturePhoto = async () => {
    if (!videoRef.current || photos.length >= MAX_PHOTOS) return;
    setCapturing(true);
    setCaptureError('');

    try {
      const result = await detectSingleFace(videoRef.current);
      if (!result) {
        setCaptureError('No face detected. Make sure your face is clearly visible and well-lit.');
        setCapturing(false);
        return;
      }

      const thumbnail = captureFaceCrop(videoRef.current, result.detection, 200);
      const descArray = Array.from(result.descriptor);

      setPhotos((prev) => [...prev, thumbnail]);
      setDescriptors((prev) => [...prev, descArray]);
      setCaptureError('');
    } catch (e) {
      setCaptureError('Face detection failed. Please try again.');
      console.error('Capture error:', e);
    } finally {
      setCapturing(false);
    }
  };

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

  const handleReset = async () => {
    if (!user) return;
    setPhotos([]);
    setDescriptors([]);
    setExistingRegistered(false);
    await setDoc(doc(db, 'users', user.uid), {
      facePhotos: [], faceDescriptors: [], faceRegistered: false,
    }, { merge: true });
  };

  // ── Loading ──
  if (loadingModels) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col items-center justify-center p-20 space-y-4 animate-in fade-in">
        <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
        <p className="text-sm font-bold text-brand-text-muted">Loading face recognition models...</p>
        <p className="text-[11px] text-brand-text-muted">First load may take a few seconds</p>
      </div>
    );
  }

  if (!modelsReady) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col items-center justify-center p-20 space-y-4 animate-in fade-in">
        <XCircle className="w-10 h-10 text-red-500" />
        <p className="text-sm font-bold text-brand-text-main">Failed to load face models</p>
        <p className="text-[11px] text-brand-text-muted">Check your internet connection and reload the page.</p>
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
          Capture 1–3 photos of your face. These are used to verify your identity during attendance.
        </p>
      </header>

      {/* Status */}
      {existingRegistered && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-green-800">Face ID registered ✓</p>
            <p className="text-[11px] text-green-600">{photos.length} photo(s) stored. You can re-register anytime.</p>
          </div>
          <button onClick={handleReset} className="px-3 py-1.5 text-[11px] font-bold text-red-600 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
            Reset
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Camera */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
            <div className="relative bg-slate-900 aspect-[4/3] flex items-center justify-center">
              <video
                ref={videoRef}
                className={cn('w-full h-full object-cover', cameraActive ? 'block' : 'hidden')}
                playsInline muted
                style={{ transform: 'scaleX(-1)' }}
              />
              {!cameraActive && (
                <div className="flex flex-col items-center gap-4 text-white/50">
                  <Camera className="w-16 h-16" />
                  <p className="text-sm font-medium">Camera is off</p>
                </div>
              )}
              {cameraActive && (
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white/70 text-[10px] font-bold">
                  {photos.length}/{MAX_PHOTOS}
                </div>
              )}
            </div>

            <div className="p-5 space-y-3">
              {captureError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {captureError}
                </div>
              )}

              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  disabled={photos.length >= MAX_PHOTOS}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3 text-sm"
                >
                  <Camera className="w-5 h-5" />
                  {photos.length === 0 ? 'Open Camera' : 'Take Another Photo'}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={capturePhoto}
                    disabled={capturing || photos.length >= MAX_PHOTOS}
                    className="flex-1 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    {capturing ? 'Detecting face...' : '📸 Snap Photo'}
                  </button>
                  <button onClick={stopCamera} className="px-5 py-3.5 bg-slate-100 text-brand-text-muted rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors">
                    Stop
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Captured photos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-brand-border rounded-3xl p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-black text-brand-text-main uppercase tracking-widest">
              Registered Faces ({photos.length}/{MAX_PHOTOS})
            </h3>

            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <ScanFace className="w-10 h-10 text-slate-200" />
                <p className="text-xs text-brand-text-muted text-center">No photos yet. Open camera and snap 1–3 photos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <AnimatePresence>
                  {photos.map((photo, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="relative group">
                      <img src={photo} alt={`Face ${i + 1}`} className="w-full aspect-square rounded-2xl object-cover border-2 border-brand-border" />
                      <button onClick={() => removePhoto(i)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-black text-white bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        #{i + 1}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {photos.length > 0 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  'w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg',
                  saved ? 'bg-green-500 text-white' : 'bg-brand-primary text-white hover:bg-blue-700'
                )}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : saved ? 'Saved!' : `Save ${photos.length} Photo${photos.length > 1 ? 's' : ''}`}
              </button>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
              Use good lighting. Remove glasses/masks. Take photos from slightly different angles for better matching accuracy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
