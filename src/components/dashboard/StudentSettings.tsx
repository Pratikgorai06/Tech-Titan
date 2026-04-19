import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { dbService, MOCK_STUDENT_ID, UserProfile } from '../../lib/db';
import { Settings, Save, Loader2, CheckCircle2, User, Mail, BookOpen, GraduationCap, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function StudentSettings() {
  const { user: authUser } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Settings drop downs
  const [branches, setBranches] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [batches, setBatches] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const u = await dbService.getUser(MOCK_STUDENT_ID);
        // Create user if not exists
        if (!u) {
          const newUser: UserProfile = {
            uid: MOCK_STUDENT_ID,
            name: authUser?.displayName || 'Alex Johnson',
            email: authUser?.email || 'alex@campusmate.edu',
            role: 'student',
            department: '',
            academicYear: '',
            totalAttendance: 0,
            gpa: 4.0,
            batch: ''
          };
          setUserProfile(newUser);
        } else {
          setUserProfile(u);
        }

        const snap = await getDoc(doc(db, 'settings', 'institute'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.branches) setBranches(data.branches.split(',').map((s: string) => s.trim()));
          if (data.years) setYears(data.years.split(',').map((s: string) => s.trim()));
          if (data.batches) setBatches(data.batches.split(',').map((s: string) => s.trim()));
        }
      } catch (e) {
        console.warn('Settings load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authUser]);

  const handleSave = async () => {
    if (!userProfile) return;
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, 'users', MOCK_STUDENT_ID), userProfile, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof UserProfile,
    placeholder: string,
    icon?: any,
    span?: string,
    disabled = false
  ) => (
    <div className={cn('space-y-2', span)}>
      <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1 flex items-center gap-1.5">
        {icon && <icon.type {...icon.props} className="w-3 h-3" />}
        {label}
      </label>
      <input
        value={(userProfile?.[key] as string) || ''}
        onChange={e => setUserProfile(prev => prev ? ({ ...prev, [key]: e.target.value }) : null)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold outline-none transition-all",
          disabled ? "opacity-60 cursor-not-allowed" : "focus:ring-2 focus:ring-brand-primary/20"
        )}
      />
    </div>
  );

  const selectField = (
    label: string,
    key: keyof UserProfile,
    options: string[],
    placeholder: string,
    icon?: any,
    span?: string
  ) => (
    <div className={cn('space-y-2', span)}>
      <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1 flex items-center gap-1.5">
        {icon && <icon.type {...icon.props} className="w-3 h-3" />}
        {label}
      </label>
      <select
        value={(userProfile?.[key] as string) || ''}
        onChange={e => setUserProfile(prev => prev ? ({ ...prev, [key]: e.target.value }) : null)}
        className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all appearance-none"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Loading Profile...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 pb-12 w-full px-4 sm:px-0">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-text-main flex items-center gap-3">
            <Settings className="w-8 h-8 text-brand-primary" />
            Profile Settings
          </h2>
          <p className="text-brand-text-muted mt-2 max-w-xl text-sm font-medium">
            Manage your personal information, batch, branch, and academic identity.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg w-full md:w-auto',
            saved
              ? 'bg-accent-green text-white shadow-green-200/50'
              : 'bg-brand-primary text-white hover:bg-blue-700 shadow-blue-200/50'
          )}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </motion.button>
      </header>

      {/* Basic Info */}
      <div className="bg-white border border-brand-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-brand-border pb-5">
          <div className="w-10 h-10 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black text-brand-text-main">Basic Information</h3>
            <p className="text-[11px] text-brand-text-muted font-medium">Your identity details across the platform.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {field('Full Name', 'name', 'e.g. Alex Johnson', <User />, 'md:col-span-2')}
          {field('Email Address', 'email', 'e.g. user@college.edu', <Mail />, 'md:col-span-2', true)}
        </div>
      </div>

      {/* Academic Info */}
      <div className="bg-white border border-brand-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-brand-border pb-5">
          <div className="w-10 h-10 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-brand-text-main">Academic Placement</h3>
            <p className="text-[11px] text-brand-text-muted font-medium">Select your branch, year and section/batch.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {branches.length > 0 ? selectField('Current Branch', 'department', branches, 'Select Branch', <BookOpen />, 'sm:col-span-2') : field('Current Branch', 'department', 'e.g. Computer Science', <BookOpen />, 'sm:col-span-2')}
          {years.length > 0 ? selectField('Academic Year', 'academicYear', years, 'Select Year', <GraduationCap />) : field('Academic Year', 'academicYear', 'e.g. 3rd Year', <GraduationCap />)}
          {batches.length > 0 ? selectField('Student Batch', 'batch', batches, 'Select Batch', <Users />) : field('Student Batch', 'batch', 'e.g. Batch A1', <Users />)}
        </div>
      </div>
    </div>
  );
}
