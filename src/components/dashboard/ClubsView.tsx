import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, X, ChevronRight, CheckCircle2, Loader2,
  Send, Users, AlertCircle, Star
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  CLUBS_LIST, ClubDef, ClubCategory, ClubApplication,
  hasApplied, submitClubApplication, getStudentApplications, ClubApplicationFormData
} from '../../lib/clubsDb';
import { cn } from '../../lib/utils';

const DEPARTMENTS = ['Computer Science', 'Electronics & Communication', 'Mechanical', 'Civil', 'Electrical', 'Information Technology', 'Chemical', 'Production & Industrial', 'Metallurgy'];
const RATINGS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const CATEGORIES: ClubCategory[] = ['Technical Society', 'Cultural Society', 'Council'];

const CATEGORY_STYLE: Record<ClubCategory, string> = {
  'Technical Society': 'bg-blue-50 text-blue-700 border-blue-200',
  'Cultural Society': 'bg-pink-50 text-pink-700 border-pink-200',
  'Council': 'bg-violet-50 text-violet-700 border-violet-200',
};

const EMPTY_FORM: ClubApplicationFormData = {
  email: '', fullName: '', rollNumber: '', contactNumber: '', department: '',
  technicalSkills: '', additionalSkills: '', leadershipExp: '',
  communicationSkills: '', writingSkills: '', startupIdea: '', motivation: '', queries: '',
};

export default function ClubsView() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ClubCategory | 'All'>('All');
  const [selectedClub, setSelectedClub] = useState<ClubDef | null>(null);
  const [appliedClubs, setAppliedClubs] = useState<Set<string>>(new Set());
  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [loadingApplied, setLoadingApplied] = useState(true);
  const [formData, setFormData] = useState<ClubApplicationFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [errors, setErrors] = useState<Partial<ClubApplicationFormData>>({});
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    getStudentApplications(user.uid).then(apps => {
      const clubIds = new Set(apps.map(a => a.clubId));
      setAppliedClubs(clubIds);
      setApplications(apps);
      setLoadingApplied(false);
    });
  }, [user]);

  // Prefill email when club selected
  useEffect(() => {
    if (selectedClub) {
      setFormData(prev => ({ ...EMPTY_FORM, email: user?.email || '', fullName: user?.displayName || '' }));
      setSubmitDone(false);
      setErrors({});
    }
  }, [selectedClub]);

  const filtered = CLUBS_LIST.filter(c => {
    const matchCat = activeCategory === 'All' || c.category === activeCategory;
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const validate = (): boolean => {
    const e: Partial<ClubApplicationFormData> = {};
    if (!formData.email.trim()) e.email = 'Required';
    if (!formData.fullName.trim()) e.fullName = 'Required';
    if (!formData.rollNumber.trim()) e.rollNumber = 'Required';
    if (!formData.contactNumber.trim()) e.contactNumber = 'Required';
    if (!formData.department) e.department = 'Required';
    if (!formData.communicationSkills) e.communicationSkills = 'Required';
    if (!formData.writingSkills) e.writingSkills = 'Required';
    if (!formData.motivation.trim()) e.motivation = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!user || !selectedClub || !validate()) return;
    setSubmitting(true);
    await submitClubApplication({
      clubId: selectedClub.id,
      clubName: selectedClub.name,
      studentUid: user.uid,
      studentEmail: user.email || '',
      studentName: user.displayName || '',
      formData,
    });
    setAppliedClubs(prev => new Set([...prev, selectedClub.id]));
    setSubmitting(false);
    setSubmitDone(true);
  };

  const Field = ({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black text-brand-text-muted uppercase tracking-widest">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );

  const Input = ({ field, placeholder, type = 'text' }: { field: keyof ClubApplicationFormData; placeholder: string; type?: string }) => (
    <input
      type={type}
      placeholder={placeholder}
      value={formData[field]}
      onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
      className={cn('w-full border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all',
        errors[field] ? 'border-red-300 bg-red-50' : 'border-brand-border bg-white')}
    />
  );

  const Textarea = ({ field, placeholder }: { field: keyof ClubApplicationFormData; placeholder: string }) => (
    <textarea
      rows={3}
      placeholder={placeholder}
      value={formData[field]}
      onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
      className={cn('w-full border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all resize-none',
        errors[field] ? 'border-red-300 bg-red-50' : 'border-brand-border bg-white')}
    />
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header>
        <h2 className="text-3xl font-black tracking-tight text-brand-text-main">Clubs & Societies</h2>
        <p className="text-brand-text-muted mt-1 text-sm">
          Explore all campus clubs, societies, and councils. Click any card to view details and apply for membership.
        </p>
      </header>

      {/* Applied count banner */}
      {appliedClubs.size > 0 && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700 font-bold">
            You've applied to <span className="font-black">{appliedClubs.size}</span> club{appliedClubs.size > 1 ? 's' : ''}. 
            {' '}<span className="text-green-600">You can apply to multiple clubs.</span>
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
          <input
            type="text"
            placeholder="Search clubs and societies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-brand-border bg-white rounded-2xl pl-12 pr-5 py-3.5 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['All', ...CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-[12px] font-bold border transition-all',
                activeCategory === cat
                  ? 'bg-brand-primary text-white border-brand-primary shadow-md'
                  : 'bg-white text-brand-text-muted border-brand-border hover:border-brand-primary/40'
              )}
            >
              {cat === 'All' ? '✦ All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Club Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((club, i) => {
          const applied = appliedClubs.has(club.id);
          return (
            <motion.div
              key={club.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelectedClub(club)}
              className="bg-white border border-brand-border rounded-3xl p-5 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all group relative overflow-hidden"
            >
              {/* Gradient accent */}
              <div className={cn('absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10 bg-gradient-to-br', club.color)} />

              <div className="relative z-10 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br flex-shrink-0', club.color)}>
                    {club.emoji}
                  </div>
                  {applied && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded-full flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      <span className="text-[9px] font-black text-green-700 uppercase">Applied</span>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-black text-[13px] text-brand-text-main leading-tight group-hover:text-brand-primary transition-colors">{club.name}</h3>
                  <span className={cn('inline-block mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider', CATEGORY_STYLE[club.category])}>
                    {club.category}
                  </span>
                </div>
                <p className="text-[11px] text-brand-text-muted leading-relaxed line-clamp-2">{club.description}</p>
                <div className="flex items-center gap-1.5 text-brand-primary text-[11px] font-black group-hover:gap-2.5 transition-all">
                  <span>{applied ? 'View Details' : 'Apply Now'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-brand-text-muted font-medium">No clubs found matching "{search}".</p>
        </div>
      )}

      {/* ── Club Detail + Form Panel ── */}
      <AnimatePresence>
        {selectedClub && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setSelectedClub(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: '100%' }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Panel Header */}
              <div className={cn('p-6 flex-shrink-0 bg-gradient-to-r', selectedClub.color)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl backdrop-blur-sm">
                      {selectedClub.emoji}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white leading-tight">{selectedClub.name}</h3>
                      <span className="text-white/70 text-[11px] font-bold uppercase tracking-wider">{selectedClub.category}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedClub(null)} className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-colors flex-shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-white/80 text-sm mt-4 leading-relaxed">{selectedClub.description}</p>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto" ref={formRef}>
                {appliedClubs.has(selectedClub.id) && !submitDone ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="font-black text-brand-text-main text-xl">Already Applied!</h4>
                    <p className="text-sm text-brand-text-muted">You have already submitted your application for <strong>{selectedClub.name}</strong>. The club president will review it soon.</p>
                  </div>
                ) : submitDone ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}
                      className="w-20 h-20 rounded-full bg-green-50 border-4 border-green-200 flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </motion.div>
                    <h4 className="font-black text-brand-text-main text-2xl">Application Submitted!</h4>
                    <p className="text-sm text-brand-text-muted">Your application for <strong>{selectedClub.name}</strong> has been sent. The president will review and get back to you.</p>
                    <button onClick={() => setSelectedClub(null)} className="mt-2 px-6 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
                      Explore More Clubs
                    </button>
                  </div>
                ) : (
                  <div className="p-6 space-y-8">
                    {/* Form intro */}
                    <div className="p-4 bg-slate-50 border border-brand-border rounded-2xl">
                      <h4 className="font-black text-brand-text-main text-sm mb-1">Registration Form</h4>
                      <p className="text-[12px] text-brand-text-muted">Join {selectedClub.name} and be part of fostering excellence in your field.</p>
                    </div>

                    {/* Section: Basic Information */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-brand-border">
                        <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <h4 className="font-black text-[12px] text-brand-text-muted uppercase tracking-widest">Basic Information</h4>
                      </div>
                      <Field label="Email Address" required error={errors.email}><Input field="email" placeholder="your.email@example.com" type="email" /></Field>
                      <Field label="Full Name" required error={errors.fullName}><Input field="fullName" placeholder="Enter your full name" /></Field>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Roll Number" required error={errors.rollNumber}><Input field="rollNumber" placeholder="Enter your roll number" /></Field>
                        <Field label="Contact Number" required error={errors.contactNumber}><Input field="contactNumber" placeholder="+91 9876543210" type="tel" /></Field>
                      </div>
                      <Field label="Department" required error={errors.department}>
                        <select
                          value={formData.department}
                          onChange={e => setFormData(p => ({ ...p, department: e.target.value }))}
                          className={cn('w-full border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none bg-white transition-all',
                            errors.department ? 'border-red-300' : 'border-brand-border')}
                        >
                          <option value="">Select Department</option>
                          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </Field>
                    </section>

                    {/* Section: Skills & Experience */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-brand-border">
                        <div className="w-6 h-6 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center">
                          <Star className="w-3.5 h-3.5 text-purple-600" />
                        </div>
                        <h4 className="font-black text-[12px] text-brand-text-muted uppercase tracking-widest">Skills & Experience</h4>
                      </div>
                      <Field label="Technical Skills (If any)">
                        <Textarea field="technicalSkills" placeholder="e.g., Programming languages, frameworks, tools, etc." />
                      </Field>
                      <Field label="Additional Skills (photography, videography, etc.)">
                        <Textarea field="additionalSkills" placeholder="Share your creative and additional skills" />
                      </Field>
                      <Field label="Leadership / Management Experience">
                        <Textarea field="leadershipExp" placeholder="Have you ever held a role involving management or organizing tasks? Describe your experiences." />
                      </Field>
                    </section>

                    {/* Section: Self Assessment */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-brand-border">
                        <div className="w-6 h-6 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        </div>
                        <h4 className="font-black text-[12px] text-brand-text-muted uppercase tracking-widest">Self Assessment</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Communication Skills (Out of 10)" required error={errors.communicationSkills}>
                          <select value={formData.communicationSkills} onChange={e => setFormData(p => ({ ...p, communicationSkills: e.target.value }))}
                            className={cn('w-full border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none bg-white',
                              errors.communicationSkills ? 'border-red-300' : 'border-brand-border')}>
                            <option value="">Select Rating</option>
                            {RATINGS.map(r => <option key={r} value={r}>{r} / 10</option>)}
                          </select>
                        </Field>
                        <Field label="Writing Skills (Out of 10)" required error={errors.writingSkills}>
                          <select value={formData.writingSkills} onChange={e => setFormData(p => ({ ...p, writingSkills: e.target.value }))}
                            className={cn('w-full border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none bg-white',
                              errors.writingSkills ? 'border-red-300' : 'border-brand-border')}>
                            <option value="">Select Rating</option>
                            {RATINGS.map(r => <option key={r} value={r}>{r} / 10</option>)}
                          </select>
                        </Field>
                      </div>
                    </section>

                    {/* Section: Additional Information */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-brand-border">
                        <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                          <Send className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <h4 className="font-black text-[12px] text-brand-text-muted uppercase tracking-widest">Additional Information</h4>
                      </div>
                      <Field label="Startup / Innovation Idea (optional)">
                        <Textarea field="startupIdea" placeholder="Do you have any startup idea? Share briefly." />
                      </Field>
                      <Field label={`Why do you want to join ${selectedClub.name}?`} required error={errors.motivation}>
                        <Textarea field="motivation" placeholder="Share your motivation and what you hope to contribute." />
                      </Field>
                      <Field label="Any Queries?">
                        <Textarea field="queries" placeholder="Feel free to ask any questions or clarifications." />
                      </Field>
                    </section>

                    {/* Submit */}
                    <div className="pb-8 space-y-3">
                      <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full py-4 bg-gradient-to-r from-brand-primary to-blue-700 text-white font-black rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3"
                      >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        {submitting ? 'Submitting…' : 'Submit Registration'}
                      </button>
                      <p className="text-[11px] text-center text-brand-text-muted">Please ensure all required fields are filled before submitting.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
