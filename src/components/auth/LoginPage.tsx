import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Shield, Loader2, AlertCircle, Sparkles, ExternalLink, CheckSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// ─── Firebase project ID (used to build Console links) ───────────────────────
const FIREBASE_PROJECT_ID = 'gen-lang-client-0163119021';
const FIREBASE_AUTH_SETTINGS_URL = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`;

// ─── Google G SVG ─────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─── Unauthorized Domain Fix Card ─────────────────────────────────────────────
function UnauthorizedDomainCard() {
  const steps = [
    { label: 'Open Firebase Console', action: 'Click the button below' },
    { label: 'Go to Authentication → Settings', action: 'Left sidebar → Build → Authentication → Settings tab' },
    { label: 'Scroll to "Authorized domains"', action: 'Find the list of allowed domains' },
    { label: 'Click "Add domain"', action: 'Type  localhost  and click Add' },
    { label: 'Come back and try again', action: 'Refresh this page and sign in' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-4 p-4 bg-orange-500/10 border border-orange-400/25 rounded-2xl space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-orange-300 leading-tight">
              One-time Firebase setup required
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">
              <code className="bg-white/10 px-1 py-0.5 rounded text-orange-300/80">localhost</code> must be added
              to your Firebase project's authorized domains list. This takes ~30 seconds.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-1.5 pl-1">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-white/70 leading-tight">{step.label}</p>
                <p className="text-[10px] text-white/30 leading-tight">{step.action}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Direct link button */}
        <a
          href={FIREBASE_AUTH_SETTINGS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 hover:border-orange-400/50 text-orange-300 text-[13px] font-semibold rounded-xl transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Firebase Auth Settings
        </a>

        <p className="text-[10px] text-white/20 text-center">
          After adding localhost, refresh this page and try signing in again.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { signInWithGoogle, isLoading, authError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const isUnauthorizedDomain = authError === 'UNAUTHORIZED_DOMAIN';

  const handleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0d0f1a]">
      {/* Animated background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] rounded-full bg-indigo-600/10 blur-[80px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/[0.09] rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-purple-700 flex items-center justify-center shadow-xl shadow-blue-500/30 mb-4"
            >
              <GraduationCap className="w-8 h-8 text-white" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="text-center"
            >
              <h1 className="text-2xl font-black text-white tracking-tight">Campus Mate</h1>
              <p className="text-sm text-white/40 mt-1 font-medium">Your unified college experience</p>
            </motion.div>
          </div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="flex flex-wrap justify-center gap-2 mb-8"
          >
            {['Attendance', 'Campus Chat', 'Events', 'Career Hub', 'Complaints'].map(f => (
              <span
                key={f}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-white/50 border border-white/[0.08] bg-white/[0.04]"
              >
                {f}
              </span>
            ))}
          </motion.div>

          {/* Sign-in section */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            className="space-y-4"
          >
            <p className="text-center text-xs text-white/30 uppercase tracking-widest font-bold">
              Sign in to continue
            </p>

            {/* Google Sign-In button */}
            <button
              onClick={handleSignIn}
              disabled={signingIn || isLoading}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 font-semibold rounded-2xl transition-all shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {signingIn
                ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                : <GoogleIcon />
              }
              <span className="text-[15px]">{signingIn ? 'Signing in…' : 'Continue with Google'}</span>
            </button>

            {/* Unauthorized domain error — rich fix card */}
            <AnimatePresence>
              {isUnauthorizedDomain && <UnauthorizedDomainCard />}
            </AnimatePresence>

            {/* Generic errors */}
            <AnimatePresence>
              {authError && !isUnauthorizedDomain && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2.5 px-4 py-3 bg-red-500/15 border border-red-500/25 rounded-xl text-sm text-red-300"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {authError}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Admin note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="mt-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-yellow-500/[0.08] border border-yellow-500/15"
          >
            <Shield className="w-4 h-4 text-yellow-400/70 flex-shrink-0" />
            <p className="text-[11px] text-white/30 leading-relaxed">
              Admin access is automatically granted based on your verified email address.
            </p>
          </motion.div>

          <p className="text-center text-[11px] text-white/20 mt-6">
            By signing in, you agree to your college's usage policies.
          </p>
        </div>

        {/* Floating sparkle */}
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-4 -right-4 text-blue-400/60"
        >
          <Sparkles className="w-8 h-8" />
        </motion.div>
      </motion.div>
    </div>
  );
}
