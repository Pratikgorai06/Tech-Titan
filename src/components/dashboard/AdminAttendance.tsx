import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../../lib/db';
import {
  Users, Search, GraduationCap, TrendingUp, ChevronRight,
  Loader2, Mail, X, Phone, BookOpen, BarChart2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminAttendance() {
  const [users, setUsers]           = useState<UserProfile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const data = await dbService.getAllUsers();
    setUsers(data);
    setLoading(false);
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Loading User Database...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-text-main uppercase">Student Analytics</h2>
          <p className="text-brand-text-muted mt-2 max-w-xl text-sm font-medium">
            Monitor campus-wide attendance, GPA trends, and student participation across all departments.
          </p>
        </div>
        <div className="flex bg-white border border-brand-border rounded-2xl px-6 py-4 shadow-sm items-center gap-6">
          <div className="text-center">
            <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Total Students</p>
            <p className="text-2xl font-black text-brand-primary">{users.length}</p>
          </div>
          <div className="w-px h-8 bg-brand-border" />
          <div className="text-center">
            <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Avg. Attendance</p>
            <p className="text-2xl font-black text-accent-green">92%</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col space-y-6">
        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
            <input
              type="text"
              placeholder="Search by name, email, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-brand-border rounded-2xl pl-12 pr-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all shadow-sm"
            />
          </div>
          <button className="px-8 py-4 bg-white border border-brand-border rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-sm">
            Export Records
          </button>
        </div>

        {/* User Table */}
        <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-brand-border text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                  <th className="px-6 py-5">Student Information</th>
                  <th className="px-6 py-5">Academic Details</th>
                  <th className="px-6 py-5">Attendance</th>
                  <th className="px-6 py-5">Performance</th>
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
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-brand-text-main">
                          <GraduationCap className="w-3.5 h-3.5 opacity-60" />
                          {user.department}
                        </div>
                        <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider pl-5">Year {user.academicYear}</p>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-primary text-sm font-black">
                          {user.totalAttendance}
                        </div>
                        <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden border border-brand-border">
                          <div
                            className="h-full bg-brand-primary"
                            style={{ width: `${Math.min((user.totalAttendance / 20) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2">
                        <TrendingUp className={cn(
                          'w-4 h-4',
                          (user.gpa || 0) >= 3.5 ? 'text-accent-green' : 'text-amber-500'
                        )} />
                        <p className="text-[14px] font-black text-brand-text-main">{user.gpa?.toFixed(2) || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-brand-border transition-all hover:text-brand-primary"
                        title="View student details"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="p-20 text-center">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-sm text-brand-text-muted font-medium">No students found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Student Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
              onClick={() => setSelectedUser(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-8 space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-brand-text-muted uppercase tracking-widest">Student Profile</h3>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Avatar + Name */}
                <div className="flex flex-col items-center text-center gap-4 py-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-brand-primary to-blue-700 rounded-3xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-200">
                    {selectedUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-brand-text-main">{selectedUser.name}</h2>
                    <p className="text-sm text-brand-text-muted font-medium mt-1">{selectedUser.email}</p>
                  </div>
                </div>

                {/* Info Cards */}
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

                {/* Attendance Bar */}
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-brand-text-muted">
                    <span>Attendance Progress</span>
                    <span>{Math.min(Math.round((selectedUser.totalAttendance / 20) * 100), 100)}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-brand-border">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((selectedUser.totalAttendance / 20) * 100, 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-brand-primary to-blue-600 rounded-full"
                    />
                  </div>
                  <p className="text-[11px] text-brand-text-muted">
                    {selectedUser.totalAttendance >= 15
                      ? '✅ Attendance is within acceptable limits.'
                      : '⚠️ Attendance is below the required 75% threshold.'}
                  </p>
                </div>

                {/* GPA Gauge */}
                <div className="p-5 rounded-2xl border border-brand-border bg-white">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted mb-3">Performance Rating</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-brand-text-main tabular-nums">{selectedUser.gpa?.toFixed(2) || '0.00'}</span>
                    <span className="text-sm text-brand-text-muted font-bold">/ 4.00 GPA</span>
                  </div>
                  <div className={cn(
                    'mt-3 inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                    (selectedUser.gpa || 0) >= 3.5 ? 'bg-green-50 text-accent-green border border-green-200' :
                    (selectedUser.gpa || 0) >= 3.0 ? 'bg-blue-50 text-brand-primary border border-blue-200' :
                    'bg-amber-50 text-amber-600 border border-amber-200'
                  )}>
                    {(selectedUser.gpa || 0) >= 3.5 ? 'Outstanding' : (selectedUser.gpa || 0) >= 3.0 ? 'Good Standing' : 'Needs Attention'}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-full py-4 bg-slate-950 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
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
