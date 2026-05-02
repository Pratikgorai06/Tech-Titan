import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../../lib/db';
import { getAllSessions, getSessionAttendance } from '../../lib/attendanceDb';
import type { QrSession } from '../../lib/db';
import {
  Users, Search, GraduationCap, TrendingUp, ChevronRight,
  Loader2, Mail, X, BookOpen, BarChart2, QrCode, ShieldCheck,
  UserCheck, ArrowUpRight, Clock, CheckCircle2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

type AdminTab = 'students' | 'staff' | 'sessions';

export default function AdminAttendance() {
  const [tab, setTab] = useState<AdminTab>('students');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]); // teachers + club_presidents
  const [sessions, setSessions] = useState<QrSession[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [allUsers, allSessions] = await Promise.all([
      dbService.getAllUsers(),
      getAllSessions(),
    ]);
    // FIX: include club_president in staff list (they were invisible before)
    setUsers(allUsers.filter(u => u.role === 'student'));
    setStaff(allUsers.filter(u => u.role === 'teacher' || u.role === 'club_president'));
    setSessions(allSessions);

    const counts: Record<string, number> = {};
    await Promise.all(allSessions.slice(0, 20).map(async (s) => {
      const recs = await getSessionAttendance(s.id);
      counts[s.id] = recs.length;
    }));
    setSessionCounts(counts);
    setLoading(false);
  };

  const handlePromote = async (uid: string) => {
    setPromoting(uid);
    await dbService.promoteToTeacher(uid);
    await fetchData();
    setPromoting(null);
  };

  const handleDemote = async (uid: string) => {
    setPromoting(uid);
    await dbService.demoteToStudent(uid);
    await fetchData();
    setPromoting(null);
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredStaff = staff.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Loading Data...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-text-main uppercase">User & Attendance Analytics</h2>
          <p className="text-brand-text-muted mt-2 max-w-xl text-sm font-medium">
            Manage students, promote teachers, and review QR attendance sessions.
          </p>
        </div>
        <div className="flex bg-white border border-brand-border rounded-2xl px-6 py-4 shadow-sm items-center gap-6">
          <div className="text-center">
            <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Students</p>
            <p className="text-2xl font-black text-brand-primary">{users.length}</p>
          </div>
          <div className="w-px h-8 bg-brand-border" />
          <div className="text-center">
            <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Staff</p>
            <p className="text-2xl font-black text-amber-600">{staff.length}</p>
          </div>
          <div className="w-px h-8 bg-brand-border" />
          <div className="text-center">
            <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Sessions</p>
            <p className="text-2xl font-black text-green-600">{sessions.length}</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {([
          { key: 'students', label: 'Students', icon: Users },
          { key: 'staff', label: 'Staff', icon: GraduationCap },
          { key: 'sessions', label: 'QR Sessions', icon: QrCode },
        ] as { key: AdminTab; label: string; icon: any }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearchQuery(''); }}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
              tab === t.key ? 'bg-white shadow-sm text-brand-primary' : 'text-brand-text-muted hover:text-brand-text-main'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab !== 'sessions' && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-brand-border rounded-2xl pl-12 pr-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none shadow-sm"
          />
        </div>
      )}

      {/* ── Students Tab ── */}
      {tab === 'students' && (
        <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-brand-border text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                  <th className="px-6 py-5">Student Information</th>
                  <th className="px-6 py-5">Academic Details</th>
                  <th className="px-6 py-5">Attendance</th>
                  <th className="px-6 py-5">Performance</th>
                  <th className="px-6 py-5">Promote</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center border border-brand-border group-hover:scale-110 transition-transform">
                          <Users className="w-6 h-6 text-brand-text-muted" />
                        </div>
                        <div>
                          <p className="text-[14px] font-black text-brand-text-main">{user.name}</p>
                          <div className="flex items-center gap-2 text-[11px] font-medium text-brand-text-muted mt-0.5">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-brand-text-main">
                        <GraduationCap className="w-3.5 h-3.5 opacity-60" />
                        {user.department}
                      </div>
                      <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider pl-5">Year {user.academicYear}</p>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-primary text-sm font-black">
                          {user.totalAttendance}
                        </div>
                        <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden border border-brand-border">
                          <div className="h-full bg-brand-primary" style={{ width: `${Math.min((user.totalAttendance / 20) * 100, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2">
                        <TrendingUp className={cn('w-4 h-4', (user.gpa || 0) >= 3.5 ? 'text-green-600' : 'text-amber-500')} />
                        <p className="text-[14px] font-black text-brand-text-main">{user.gpa?.toFixed(2) || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <button
                        onClick={() => handlePromote(user.uid)}
                        disabled={promoting === user.uid}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[11px] font-black hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        {promoting === user.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpRight className="w-3 h-3" />}
                        Make Teacher
                      </button>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <button onClick={() => setSelectedUser(user)} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-brand-border transition-all hover:text-brand-primary">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="p-20 text-center">
                <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-sm text-brand-text-muted font-medium">No students found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Staff Tab (Teachers + Club Presidents) ── */}
      {tab === 'staff' && (
        <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
          {filteredStaff.length === 0 ? (
            <div className="p-16 text-center">
              <GraduationCap className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-sm text-brand-text-muted font-medium">No staff assigned yet.</p>
              <p className="text-xs text-brand-text-muted mt-1">Use Admin Settings → Role Management to promote users.</p>
            </div>
          ) : (
            <div className="divide-y divide-brand-border">
              {filteredStaff.map((member) => {
                const isTeacher = member.role === 'teacher';
                const isPresident = member.role === 'club_president';
                return (
                  <div key={member.uid} className="flex items-center gap-4 px-8 py-6">
                    <div className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0',
                      isTeacher ? 'bg-amber-50 border border-amber-200' : 'bg-violet-50 border border-violet-200'
                    )}>
                      <GraduationCap className={cn('w-6 h-6', isTeacher ? 'text-amber-600' : 'text-violet-600')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[14px] text-brand-text-main">{member.name}</p>
                      <p className="text-[11px] text-brand-text-muted">{member.email}</p>
                      <p className="text-[11px] text-brand-text-muted">{member.department}</p>
                    </div>
                    <div className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-full',
                      isTeacher ? 'bg-amber-50 border border-amber-200' : 'bg-violet-50 border border-violet-200'
                    )}>
                      <ShieldCheck className={cn('w-3 h-3', isTeacher ? 'text-amber-600' : 'text-violet-600')} />
                      <span className={cn('text-[10px] font-black uppercase', isTeacher ? 'text-amber-700' : 'text-violet-700')}>
                        {isTeacher ? 'Teacher' : 'Club President'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDemote(member.uid)}
                      disabled={promoting === member.uid}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-[11px] font-black hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {promoting === member.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                      Demote
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── QR Sessions Tab ── */}
      {tab === 'sessions' && (
        <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
          {sessions.length === 0 ? (
            <div className="p-16 text-center">
              <QrCode className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-sm text-brand-text-muted font-medium">No QR sessions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-brand-border text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                    <th className="px-6 py-5">Subject</th>
                    <th className="px-6 py-5">Teacher</th>
                    <th className="px-6 py-5">Branch · Year</th>
                    <th className="px-6 py-5">Created</th>
                    <th className="px-6 py-5">Expiry</th>
                    <th className="px-6 py-5">Status</th>
                    <th className="px-6 py-5">Present</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {sessions.map((s) => {
                    const isActive = s.active && s.expiresAt.toMillis() > Date.now();
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5">
                          <p className="font-black text-[13px] text-brand-text-main">{s.subject}</p>
                          <p className="text-[10px] text-brand-text-muted font-mono">{s.id.slice(0, 10)}…</p>
                        </td>
                        <td className="px-6 py-5 text-[12px] font-bold text-brand-text-muted">{s.teacherName}</td>
                        <td className="px-6 py-5 text-[12px] font-bold text-brand-text-muted">{s.branch} · Year {s.year}</td>
                        <td className="px-6 py-5 text-[12px] text-brand-text-muted">
                          {s.createdAt.toDate().toLocaleDateString()}<br />
                          <span className="text-[10px]">{s.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="px-6 py-5 text-[12px] text-brand-text-muted flex items-center gap-1.5 pt-6">
                          <Clock className="w-3 h-3" />
                          {s.expiresAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-5">
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                            isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          )}>
                            {isActive ? 'Live' : 'Ended'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-lg font-black text-brand-primary tabular-nums">
                              {sessionCounts[s.id] ?? '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Student Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
            <motion.div
              initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-brand-text-muted uppercase tracking-widest">Student Profile</h3>
                  <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-col items-center text-center gap-4 py-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-brand-primary to-blue-700 rounded-3xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-200">
                    {selectedUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-brand-text-main">{selectedUser.name}</h2>
                    <p className="text-sm text-brand-text-muted font-medium mt-1">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Department', value: selectedUser.department, icon: GraduationCap },
                    { label: 'Academic Year', value: `Year ${selectedUser.academicYear}`, icon: BookOpen },
                    { label: 'Attendance', value: `${selectedUser.totalAttendance} sessions`, icon: BarChart2 },
                    { label: 'GPA', value: selectedUser.gpa?.toFixed(2) || 'N/A', icon: TrendingUp },
                  ].map(item => (
                    <div key={item.label} className="p-4 bg-slate-50 border border-brand-border rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-brand-text-muted">
                        <item.icon className="w-3.5 h-3.5" />
                        <p className="text-[10px] font-black uppercase tracking-widest">{item.label}</p>
                      </div>
                      <p className="text-[15px] font-black text-brand-text-main">{item.value}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setSelectedUser(null)}
                  className="w-full py-4 bg-slate-950 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">
                  Close Profile
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
