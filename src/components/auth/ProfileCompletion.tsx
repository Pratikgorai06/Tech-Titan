import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  GraduationCap, User, BookOpen, Users, Save,
  Loader2, CheckCircle2, Sparkles, Hash
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

// ─── Default fallback options (used when admin hasn't configured institute settings) ──
const DEFAULT_BRANCHES = ['CSE', 'ECE', 'ME', 'CE', 'EE', 'IT', 'AIDS', 'CSE-AIML'];
const DEFAULT_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const DEFAULT_BATCHES = ['2k22', '2k23', '2k24', '2k25', '2k26'];

interface ProfileCompletionProps {
  onComplete: () => void;
}

export default function ProfileCompletion({ onComplete }: ProfileCompletionProps) {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [department, setDepartment] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [section, setSection] = useState('');
  const [batch, setBatch] = useState('');

  const [branches, setBranches] = useState<string[]>(DEFAULT_BRANCHES);
  const [years, setYears] = useState<string[]>(DEFAULT_YEARS);
  const [batches, setBatches] = useState<string[]>(DEFAULT_BATCHES);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load institute settings for dropdowns + pre-fill name from Google auth
  useEffect(() => {
    if (!user) return;
    setName(user.displayName || '');

    getDoc(doc(db, 'settings', 'institute')).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.branches) setBranches(data.branches.split(',').map((s: string) => s.trim()));
        if (data.years) setYears(data.years.split(',').map((s: string) => s.trim()));
        if (data.batches) setBatches(data.batches.split(',').map((s: string) => s.trim()));
      }
    }).finally(() => setLoading(false));
  }, [user]);

  const isValid = name.trim() && collegeId.trim() && department && academicYear && section.trim() && batch;

  const handleSubmit = async () => {
    if (!user || !isValid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        collegeId: collegeId.trim(),
        department,
        academicYear,
        section: section.trim(),
        batch,
        profileComplete: true,
      }, { merge: true });
      onComplete();
    } catch (e) {
      console.error('Profile save error:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0f1a]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0d0f1a] px-4">
      {/* Animated background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full bg-indigo-600/10 blur-[80px]" />
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
        className="relative z-10 w-full max-w-lg"
      >
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/[0.09] rounded-3xl p-6 sm:p-8 shadow-2xl">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4, type: 'spring', stiffness: 200 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-purple-700 flex items-center justify-center shadow-xl shadow-blue-500/30 mb-4"
            >
              <GraduationCap className="w-7 h-7 text-white" />
            </motion.div>
            <h1 className="text-xl font-black text-white tracking-tight">Complete Your Profile</h1>
            <p className="text-sm text-white/40 mt-1 font-medium text-center">
              Fill in your academic details to get started with Campus Mate
            </p>
          </div>

          {/* Form */}
          <div className="space-y-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5 px-1">
                <User className="w-3 h-3" /> Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pratik Gorai"
                className="w-full bg-white/[0.06] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder-white/20 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Registration Number */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5 px-1">
                <Hash className="w-3 h-3" /> Registration No. *
              </label>
              <input
                type="text"
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                placeholder="e.g. 21BCE1001"
                className="w-full bg-white/[0.06] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder-white/20 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Branch + Year row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5 px-1">
                  <BookOpen className="w-3 h-3" /> Branch *
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm font-semibold text-white outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
                >
                  <option value="" disabled className="bg-[#1a1d2e] text-white/50">Select Branch</option>
                  {branches.map((b) => (
                    <option key={b} value={b} className="bg-[#1a1d2e] text-white">{b}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5 px-1">
                  <GraduationCap className="w-3 h-3" /> Year *
                </label>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm font-semibold text-white outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
                >
                  <option value="" disabled className="bg-[#1a1d2e] text-white/50">Select Year</option>
                  {years.map((y) => (
                    <option key={y} value={y} className="bg-[#1a1d2e] text-white">{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section + Batch row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5 px-1">
                  <Users className="w-3 h-3" /> Section *
                </label>
                <input
                  type="text"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="e.g. CS-A"
                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder-white/20 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5 px-1">
                  <Users className="w-3 h-3" /> Batch *
                </label>
                <select
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm font-semibold text-white outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
                >
                  <option value="" disabled className="bg-[#1a1d2e] text-white/50">Select Batch</option>
                  {batches.map((b) => (
                    <option key={b} value={b} className="bg-[#1a1d2e] text-white">{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!isValid || saving}
              className={cn(
                'w-full flex items-center justify-center gap-3 px-5 py-3.5 font-black rounded-2xl transition-all shadow-lg text-sm uppercase tracking-widest mt-2',
                isValid && !saving
                  ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-purple-700 text-white hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0'
                  : 'bg-white/[0.06] text-white/30 cursor-not-allowed'
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Complete Profile & Continue
                </>
              )}
            </button>

            <p className="text-center text-[10px] text-white/20 mt-2">
              All fields are required. You can update these later from Settings.
            </p>
          </div>
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
