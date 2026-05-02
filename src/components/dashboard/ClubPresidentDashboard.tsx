import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, CheckCircle2, XCircle, Clock, ChevronRight,
  Loader2, X, Star, Phone, Mail, GraduationCap, MessageSquare, Lightbulb, Download, MessageCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  CLUBS_LIST, ClubApplication,
  getClubApplications, getClubRecord, updateApplicationStatus
} from '../../lib/clubsDb';
import { cn } from '../../lib/utils';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';

type AppTab = 'all' | 'pending' | 'accepted' | 'rejected';

const STATUS_STYLE = {
  pending: { bg: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500', label: 'Pending' },
  accepted: { bg: 'bg-green-50 border-green-200 text-green-700', dot: 'bg-green-500', label: 'Accepted' },
  rejected: { bg: 'bg-red-50 border-red-200 text-red-600', dot: 'bg-red-500', label: 'Rejected' },
};

export default function ClubPresidentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState('');
  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AppTab>('all');
  const [selected, setSelected] = useState<ClubApplication | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  
  // First-time setup modal states
  const [showSetup, setShowSetup] = useState(false);
  const [setupData, setSetupData] = useState({ collegeId: '', section: '', academicYear: '' });
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Find which club this president manages
    getDoc(doc(db, 'users', user.uid)).then(async snap => {
      if (!snap.exists()) return;
      const userData = snap.data();
      const presidingClubId = userData.presidingClubId as string | undefined;
      
      // Check if setup is needed
      if (!userData.collegeId || !userData.section || !userData.academicYear) {
        setShowSetup(true);
      }

      if (!presidingClubId) { setLoading(false); return; }
      setClubId(presidingClubId);
      const clubDef = CLUBS_LIST.find(c => c.id === presidingClubId);
      setClubName(clubDef?.name || presidingClubId);
      const apps = await getClubApplications(presidingClubId);
      setApplications(apps);
      setLoading(false);
    });
  }, [user]);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !setupData.collegeId || !setupData.section || !setupData.academicYear) return;
    setSetupSubmitting(true);
    await updateDoc(doc(db, 'users', user.uid), {
      collegeId: setupData.collegeId,
      section: setupData.section,
      academicYear: setupData.academicYear
    });
    setSetupSubmitting(false);
    setShowSetup(false);
  };

  const handleStatus = async (appId: string, status: 'accepted' | 'rejected') => {
    setUpdating(appId);
    await updateApplicationStatus(appId, status);
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
    if (selected?.id === appId) setSelected(prev => prev ? { ...prev, status } : null);
    setUpdating(null);
  };

  const filtered = applications.filter(a => tab === 'all' || a.status === tab);
  const counts = {
    all: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    accepted: applications.filter(a => a.status === 'accepted').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const downloadCSV = () => {
    if (filtered.length === 0) return;
    
    const headers = ['Name', 'Roll Number', 'Email', 'Contact', 'Department', 'Technical Skills', 'Status', 'Submitted At'];
    
    const rows = filtered.map(app => [
      `"${app.formData.fullName || ''}"`,
      `"${app.formData.rollNumber || ''}"`,
      `"${app.studentEmail || ''}"`,
      `"${app.formData.contactNumber || ''}"`,
      `"${app.formData.department || ''}"`,
      `"${(app.formData.technicalSkills || '').replace(/"/g, '""')}"`,
      `"${app.status}"`,
      `"${app.submittedAt?.toDate().toLocaleString() || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clubName.replace(/\s+/g, '_')}_Registrations.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
    </div>
  );

  if (!clubId) return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <AnimatePresence>
        {showSetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-black text-brand-text-main mb-2">Complete Your Profile</h3>
              <p className="text-sm text-brand-text-muted mb-6">Before you manage the club, please provide your academic details.</p>
              
              <form onSubmit={handleSetupSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted px-1">Registration No. (College ID)</label>
                  <input required value={setupData.collegeId} onChange={e => setSetupData({...setupData, collegeId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" placeholder="e.g. 21BCE1001" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted px-1">Section</label>
                  <input required value={setupData.section} onChange={e => setSetupData({...setupData, section: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" placeholder="e.g. CS-A" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted px-1">Academic Year</label>
                  <select required value={setupData.academicYear} onChange={e => setSetupData({...setupData, academicYear: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all appearance-none">
                    <option value="">Select Year</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
                
                <button type="submit" disabled={setupSubmitting} className="w-full py-3 mt-4 bg-brand-primary text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  {setupSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Profile
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="max-w-xl mx-auto text-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
          <Users className="w-8 h-8 text-amber-600" />
        </div>
        <h3 className="text-xl font-black text-brand-text-main">Club Not Assigned</h3>
        <p className="text-brand-text-muted text-sm">You haven't been assigned to any club yet. Please contact the admin to assign your club.</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* First-time Setup Modal */}
      <AnimatePresence>
        {showSetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-black text-brand-text-main mb-2">Complete Your Profile</h3>
              <p className="text-sm text-brand-text-muted mb-6">Before you manage the club, please provide your academic details.</p>
              
              <form onSubmit={handleSetupSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted px-1">Registration No. (College ID)</label>
                  <input required value={setupData.collegeId} onChange={e => setSetupData({...setupData, collegeId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" placeholder="e.g. 21BCE1001" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted px-1">Section</label>
                  <input required value={setupData.section} onChange={e => setSetupData({...setupData, section: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" placeholder="e.g. CS-A" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted px-1">Academic Year</label>
                  <select required value={setupData.academicYear} onChange={e => setSetupData({...setupData, academicYear: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-brand-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all appearance-none">
                    <option value="">Select Year</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
                
                <button type="submit" disabled={setupSubmitting} className="w-full py-3 mt-4 bg-brand-primary text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  {setupSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Profile
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-3xl border border-brand-border shadow-sm">
        <div>
          <p className="text-[11px] font-bold text-brand-text-muted uppercase tracking-widest mb-2">Club President Portal</p>
          <h2 className="text-3xl font-black tracking-tight text-brand-text-main">{clubName}</h2>
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-brand-border">
            <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-black text-lg">
              {user?.displayName?.charAt(0).toUpperCase() || 'P'}
            </div>
            <div>
              <p className="text-sm font-black text-brand-text-main">{user?.displayName}</p>
              <p className="text-[11px] text-brand-text-muted font-medium">{user?.email}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/club_president/chat')}
          className="px-6 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-200"
        >
          <MessageCircle className="w-4 h-4" />
          Go to Club Chat
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { key: 'all', label: 'Total', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { key: 'pending', label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { key: 'accepted', label: 'Accepted', color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
          { key: 'rejected', label: 'Rejected', color: 'text-red-500', bg: 'bg-red-50 border-red-100' },
        ] as const).map(s => (
          <motion.div key={s.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className={cn('p-5 rounded-2xl border cursor-pointer transition-all', s.bg, tab === s.key ? 'ring-2 ring-brand-primary/30' : '')}
            onClick={() => setTab(s.key)}>
            <p className={cn('text-3xl font-black tabular-nums', s.color)}>{counts[s.key]}</p>
            <p className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Applications list */}
      <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-8 py-5 border-b border-brand-border bg-slate-50/50">
          <div>
            <h3 className="font-black text-brand-text-main text-sm uppercase tracking-widest">
              Registrations Detail (Event & Induction)
            </h3>
            <p className="text-[11px] text-brand-text-muted font-medium mt-1">
              Showing {tab} records
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-brand-text-muted font-bold bg-white border border-brand-border px-3 py-1.5 rounded-lg shadow-sm">
              {filtered.length} records
            </span>
            <button
              onClick={downloadCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-border rounded-lg text-xs font-bold text-brand-text-main hover:bg-slate-50 hover:border-brand-primary transition-colors disabled:opacity-50 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" />
              Download Excel
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-brand-text-muted">No {tab !== 'all' ? tab : ''} applications yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {filtered.map((app, i) => {
              const s = STATUS_STYLE[app.status];
              return (
                <motion.div key={app.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 px-8 py-5 hover:bg-slate-50/50 transition-colors">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                    {app.studentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-[14px] text-brand-text-main">{app.formData.fullName}</p>
                    <div className="flex items-center gap-3 text-[11px] text-brand-text-muted mt-0.5">
                      <span>{app.formData.rollNumber}</span>
                      <span>·</span>
                      <span>{app.formData.department}</span>
                      <span>·</span>
                      <span>Comm: {app.formData.communicationSkills}/10, Write: {app.formData.writingSkills}/10</span>
                    </div>
                  </div>
                  <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black border flex items-center gap-1.5', s.bg)}>
                    <div className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
                    {s.label}
                  </span>
                  <span className="text-[11px] text-brand-text-muted hidden sm:block">
                    {app.submittedAt.toDate().toLocaleDateString()}
                  </span>
                  <button onClick={() => setSelected(app)}
                    className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-brand-border transition-all hover:text-brand-primary">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Application Detail Panel */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setSelected(null)} />
            <motion.div
              initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 80 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-brand-border flex-shrink-0">
                <h3 className="font-black text-brand-text-main">Application Details</h3>
                <button onClick={() => setSelected(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Student info */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                    {selected.studentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-black text-xl text-brand-text-main">{selected.formData.fullName}</h4>
                    <p className="text-sm text-brand-text-muted">{selected.formData.rollNumber} · {selected.formData.department}</p>
                  </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 border border-brand-border rounded-xl flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-brand-text-muted flex-shrink-0" />
                    <p className="text-[11px] font-bold text-brand-text-main truncate">{selected.formData.email}</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-brand-border rounded-xl flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-brand-text-muted flex-shrink-0" />
                    <p className="text-[11px] font-bold text-brand-text-main">{selected.formData.contactNumber}</p>
                  </div>
                </div>

                {/* Ratings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-center">
                    <p className="text-3xl font-black text-blue-700">{selected.formData.communicationSkills}<span className="text-base text-blue-400">/10</span></p>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider mt-1">Communication</p>
                  </div>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-center">
                    <p className="text-3xl font-black text-purple-700">{selected.formData.writingSkills}<span className="text-base text-purple-400">/10</span></p>
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-wider mt-1">Writing</p>
                  </div>
                </div>

                {/* Fields */}
                {[
                  { icon: Star, label: 'Technical Skills', value: selected.formData.technicalSkills },
                  { icon: Star, label: 'Additional Skills', value: selected.formData.additionalSkills },
                  { icon: GraduationCap, label: 'Leadership Experience', value: selected.formData.leadershipExp },
                  { icon: Lightbulb, label: 'Startup / Idea', value: selected.formData.startupIdea },
                  { icon: MessageSquare, label: 'Motivation', value: selected.formData.motivation },
                  { icon: MessageSquare, label: 'Queries', value: selected.formData.queries },
                ].filter(f => f.value?.trim()).map(f => (
                  <div key={f.label} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-brand-text-muted">
                      <f.icon className="w-3.5 h-3.5" />
                      <p className="text-[10px] font-black uppercase tracking-widest">{f.label}</p>
                    </div>
                    <p className="text-sm text-brand-text-main bg-slate-50 border border-brand-border rounded-xl p-3 leading-relaxed">{f.value}</p>
                  </div>
                ))}

                <div className="text-[11px] text-brand-text-muted pb-2">
                  Submitted: {selected.submittedAt.toDate().toLocaleString()}
                </div>
              </div>

              {/* Action buttons */}
              {selected.status === 'pending' && (
                <div className="flex gap-3 p-6 border-t border-brand-border flex-shrink-0">
                  <button
                    onClick={() => handleStatus(selected.id, 'rejected')}
                    disabled={!!updating}
                    className="flex-1 py-3.5 bg-red-50 border border-red-200 text-red-600 font-black rounded-2xl hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updating === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Reject
                  </button>
                  <button
                    onClick={() => handleStatus(selected.id, 'accepted')}
                    disabled={!!updating}
                    className="flex-1 py-3.5 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                  >
                    {updating === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Accept
                  </button>
                </div>
              )}
              {selected.status !== 'pending' && (
                <div className="px-6 pb-6 flex-shrink-0">
                  <div className={cn('flex items-center gap-2 p-3 rounded-2xl border font-bold text-sm', STATUS_STYLE[selected.status].bg)}>
                    {selected.status === 'accepted' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    Application {selected.status}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
