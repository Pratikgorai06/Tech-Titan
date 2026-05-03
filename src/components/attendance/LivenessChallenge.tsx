import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, CheckCircle2, XCircle, Eye, Smile, ArrowLeft,
  ArrowRight, Camera, Shield
} from 'lucide-react';
import {
  loadFaceModels, detectSingleFace, captureFrame,
  checkBlink, checkSmile, checkHeadTurn
} from '../../lib/faceService';
import { cn } from '../../lib/utils';

// ─── Challenge types ──────────────────────────────────────────────────────────

type ChallengeType = 'blink' | 'smile' | 'turn_left' | 'turn_right';

interface Challenge {
  type: ChallengeType;
  label: string;
  instruction: string;
  icon: typeof Eye;
}

const ALL_CHALLENGES: Challenge[] = [
  { type: 'blink', label: 'Blink', instruction: 'Please blink your eyes', icon: Eye },
  { type: 'smile', label: 'Smile', instruction: 'Please smile 😊', icon: Smile },
  { type: 'turn_left', label: 'Turn Left', instruction: 'Turn your head to the left 👈', icon: ArrowLeft },
  { type: 'turn_right', label: 'Turn Right', instruction: 'Turn your head to the right 👉', icon: ArrowRight },
];

/**
 * Pick N random unique challenges from ALL_CHALLENGES.
 */
function pickRandomChallenges(count: number): Challenge[] {
  const shuffled = [...ALL_CHALLENGES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ─── Component Props ──────────────────────────────────────────────────────────

interface LivenessChallengeProps {
  onComplete: (result: {
    passed: boolean;
    selfieDataUrl: string;
    descriptor: Float32Array | null;
  }) => void;
  onCancel: () => void;
  challengeCount?: number;     // how many challenges to present (default 2)
  timeoutSeconds?: number;     // per-challenge timeout (default 10)
}

// ─── LivenessChallenge Component ──────────────────────────────────────────────

export default function LivenessChallenge({
  onComplete,
  onCancel,
  challengeCount = 2,
  timeoutSeconds = 15,
}: LivenessChallengeProps) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'challenge' | 'capturing' | 'done' | 'failed'>('loading');
  const [challenges] = useState<Challenge[]>(() => pickRandomChallenges(challengeCount));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [passedCount, setPassedCount] = useState(0);
  const [countdown, setCountdown] = useState(timeoutSeconds);
  const [faceVisible, setFaceVisible] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkStateRef = useRef({ wasOpen: false, completed: false });

  // ── Initialize: load models + start camera ──
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await loadFaceModels();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setPhase('ready');
      } catch (e) {
        console.error('Liveness init error:', e);
        if (!cancelled) setPhase('failed');
      }
    };
    init();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (loopRef.current) { cancelAnimationFrame(loopRef.current); loopRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  // ── Start a challenge ──
  const startChallenge = useCallback(() => {
    setPhase('challenge');
    setCountdown(timeoutSeconds);
    blinkStateRef.current = { wasOpen: false, completed: false };

    // Countdown timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Time's up — fail this challenge
          if (timerRef.current) clearInterval(timerRef.current);
          if (loopRef.current) cancelAnimationFrame(loopRef.current);
          setPhase('failed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Detection loop
    const challenge = challenges[currentIndex];
    const loop = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        loopRef.current = requestAnimationFrame(loop);
        return;
      }

      try {
        const result = await detectSingleFace(videoRef.current);
        setFaceVisible(!!result);

        if (result) {
          let passed = false;

          switch (challenge.type) {
            case 'blink': {
              const eyesClosed = checkBlink(result.landmarks);
              if (!eyesClosed && !blinkStateRef.current.wasOpen) {
                blinkStateRef.current.wasOpen = true;
              }
              if (eyesClosed && blinkStateRef.current.wasOpen && !blinkStateRef.current.completed) {
                blinkStateRef.current.completed = true;
                passed = true;
              }
              break;
            }
            case 'smile':
              passed = checkSmile(result.landmarks);
              break;
            case 'turn_left':
              passed = checkHeadTurn(result.landmarks, 'left');
              break;
            case 'turn_right':
              passed = checkHeadTurn(result.landmarks, 'right');
              break;
          }

          if (passed) {
            // Challenge passed!
            if (timerRef.current) clearInterval(timerRef.current);
            if (loopRef.current) cancelAnimationFrame(loopRef.current);
            handleChallengePassed();
            return;
          }
        }
      } catch {
        // Detection error — continue
      }

      loopRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = requestAnimationFrame(loop);
  }, [currentIndex, challenges, timeoutSeconds]);

  // ── Challenge passed — move to next or complete ──
  const handleChallengePassed = useCallback(() => {
    const newPassed = passedCount + 1;
    setPassedCount(newPassed);

    if (newPassed >= challenges.length) {
      // All challenges complete — capture final frame
      captureAndComplete();
    } else {
      // Next challenge
      setCurrentIndex(newPassed);
      // Brief pause to show success
      setPhase('ready');
      setTimeout(() => {
        startChallenge();
      }, 800);
    }
  }, [passedCount, challenges.length]);

  // ── Capture final selfie + descriptor ──
  const captureAndComplete = async () => {
    setPhase('capturing');
    try {
      if (!videoRef.current) throw new Error('No video');
      const selfie = captureFrame(videoRef.current, 0.85);
      const result = await detectSingleFace(videoRef.current);
      cleanup();
      setPhase('done');
      onComplete({
        passed: true,
        selfieDataUrl: selfie,
        descriptor: result?.descriptor ?? null,
      });
    } catch {
      cleanup();
      setPhase('done');
      onComplete({ passed: true, selfieDataUrl: '', descriptor: null });
    }
  };

  const handleCancel = () => {
    cleanup();
    onCancel();
  };

  const handleRetry = () => {
    setPhase('loading');
    setCurrentIndex(0);
    setPassedCount(0);
    setCountdown(timeoutSeconds);
    blinkStateRef.current = { wasOpen: false, completed: false };

    // Re-init camera
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setPhase('ready');
      } catch {
        setPhase('failed');
      }
    };
    init();
  };

  const currentChallenge = challenges[currentIndex];

  return (
    <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-primary" />
          <h3 className="font-black text-sm text-brand-text-main uppercase tracking-widest">Liveness Verification</h3>
        </div>
        <button onClick={handleCancel} className="text-xs font-bold text-brand-text-muted hover:text-red-500 transition-colors">
          Cancel
        </button>
      </div>

      {/* Camera viewport */}
      <div className="relative bg-slate-900 aspect-[4/3] flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Loading overlay */}
        {phase === 'loading' && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
            <p className="text-sm text-white/50 font-medium">Initializing camera & AI models...</p>
          </div>
        )}

        {/* Challenge instruction overlay */}
        {(phase === 'challenge' || phase === 'ready') && currentChallenge && (
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/60 backdrop-blur-md rounded-2xl p-4 text-center"
            >
              {phase === 'ready' && passedCount > 0 && (
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-xs font-bold">Previous challenge passed!</span>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 mb-1">
                <currentChallenge.icon className="w-5 h-5 text-white" />
                <p className="text-white font-black text-lg">{currentChallenge.instruction}</p>
              </div>

              {phase === 'challenge' && (
                <div className="flex items-center justify-center gap-3 mt-2">
                  <div className={cn(
                    'text-xs font-bold px-2 py-1 rounded-full',
                    countdown <= 5 ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white/60'
                  )}>
                    {countdown}s remaining
                  </div>
                  <div className={cn(
                    'text-[10px] font-bold px-2 py-1 rounded-full',
                    faceVisible ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'
                  )}>
                    {faceVisible ? '✓ Face detected' : '✗ No face'}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Progress dots */}
        {(phase === 'challenge' || phase === 'ready') && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {challenges.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-3 h-3 rounded-full transition-all duration-300',
                  i < passedCount
                    ? 'bg-green-400 scale-110'
                    : i === currentIndex
                    ? 'bg-white animate-pulse'
                    : 'bg-white/30'
                )}
              />
            ))}
          </div>
        )}

        {/* Capturing overlay */}
        {phase === 'capturing' && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center gap-3">
            <Camera className="w-8 h-8 text-white animate-pulse" />
            <p className="text-sm text-white/70 font-bold">Capturing your photo...</p>
          </div>
        )}

        {/* Failed overlay */}
        {phase === 'failed' && (
          <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-4 p-6">
            <XCircle className="w-12 h-12 text-red-400" />
            <p className="text-white font-bold text-center">Liveness check failed</p>
            <p className="text-white/40 text-xs text-center">
              Time ran out or the camera couldn't detect the required action. Please try again.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={handleCancel}
                className="px-5 py-2.5 bg-white/10 text-white/70 rounded-xl text-sm font-bold hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Start button (shown in 'ready' state before first challenge) */}
      {phase === 'ready' && passedCount === 0 && (
        <div className="p-5">
          <button
            onClick={startChallenge}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 text-sm"
          >
            <Shield className="w-5 h-5" />
            Start Liveness Check ({challenges.length} challenges)
          </button>
          <p className="text-[11px] text-center text-brand-text-muted mt-2">
            You'll be asked to perform {challenges.length} quick actions to verify you're a real person
          </p>
        </div>
      )}

      {/* Auto-start next challenge after ready pause */}
      {phase === 'ready' && passedCount > 0 && passedCount < challenges.length && (
        <div className="p-5 text-center">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
            <span className="text-sm font-bold text-brand-text-muted">Preparing next challenge...</span>
          </div>
        </div>
      )}
    </div>
  );
}
