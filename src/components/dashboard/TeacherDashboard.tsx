import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { QrCode, Users, BookOpen, Clock, TrendingUp, Plus, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTeacherSessions, getSessionAttendance } from '../../lib/attendanceDb';
import type { QrSession } from '../../lib/db';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<QrSession[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const s = await getTeacherSessions(user.uid);
        setSessions(s);
        const counts: Record<string, number> = {};
        await Promise.all(
          s.slice(0, 5).map(async (sess) => {
            try {
              const records = await getSessionAttendance(sess.id);
              counts[sess.id] = records.length;
            } catch { counts[sess.id] = 0; }
          })
        );
        setSessionCounts(counts);
      } catch (err) {
        console.error('[TeacherDashboard] Failed to load sessions — Firestore index may be missing:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const todaySessions = sessions.filter((s) => {
    const d = s.createdAt.toDate();
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const activeSessions = sessions.filter((s) => s.active);
  const totalStudentsToday = todaySessions.reduce((acc, s) => acc + (sessionCounts[s.id] || 0), 0);

  const stats = [
    { label: "Today's Sessions", value: todaySessions.length, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
    { label: 'Active Right Now', value: activeSessions.length, icon: QrCode, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
    { label: 'Students Marked Today', value: totalStudentsToday, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
    { label: 'Total Sessions', value: sessions.length, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest mb-1">Teacher Portal</p>
          <h2 className="text-3xl font-black tracking-tight text-brand-text-main">
            Welcome back, {user?.displayName?.split(' ')[0] || 'Teacher'} 👋
          </h2>
          <p className="text-brand-text-muted mt-2 text-sm">
            Manage your class attendance with QR codes — fast, secure, photo-verified.
          </p>
        </div>
        <button
          onClick={() => navigate('/teacher/attendance')}
          className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-200 hover:shadow-xl hover:-translate-y-0.5 transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
          Generate QR Code
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={cn('p-6 rounded-3xl border bg-white flex flex-col gap-4 shadow-sm')}
          >
            <div className={cn('w-10 h-10 rounded-2xl border flex items-center justify-center', stat.bg)}>
              <stat.icon className={cn('w-5 h-5', stat.color)} />
            </div>
            <div>
              <p className="text-3xl font-black text-brand-text-main tabular-nums">
                {loading ? '—' : stat.value}
              </p>
              <p className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider mt-0.5">
                {stat.label}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Sessions */}
      <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-8 py-6 border-b border-brand-border">
          <h3 className="font-black text-brand-text-main text-sm uppercase tracking-widest">Recent Sessions</h3>
          <button
            onClick={() => navigate('/teacher/attendance')}
            className="text-xs font-bold text-brand-primary hover:underline"
          >
            + New Session
          </button>
        </div>
        {sessions.length === 0 && !loading ? (
          <div className="p-16 text-center">
            <QrCode className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm text-brand-text-muted font-medium">No sessions yet.</p>
            <p className="text-xs text-brand-text-muted mt-1">Generate your first QR code to get started.</p>
            <button
              onClick={() => navigate('/teacher/attendance')}
              className="mt-6 px-6 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors"
            >
              Generate QR
            </button>
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {sessions.slice(0, 8).map((sess) => {
              const isActive = sess.active && sess.expiresAt.toMillis() > Date.now();
              const expDate = sess.expiresAt.toDate();
              return (
                <div
                  key={sess.id}
                  onClick={() => navigate(`/teacher/session/${sess.id}`)}
                  className="flex items-center gap-4 px-8 py-5 hover:bg-slate-50/60 cursor-pointer transition-colors group"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border',
                    isActive ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-brand-border'
                  )}>
                    <QrCode className={cn('w-5 h-5', isActive ? 'text-green-600' : 'text-brand-text-muted')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[14px] text-brand-text-main">{sess.subject}</p>
                      {isActive && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-black rounded-full uppercase tracking-wider animate-pulse">
                          Live
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-brand-text-muted mt-0.5">
                      <span>{sess.branch} · Year {sess.year}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {expDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xl font-black text-brand-primary tabular-nums">
                        {sessionCounts[sess.id] ?? '—'}
                      </p>
                      <p className="text-[9px] font-bold text-brand-text-muted uppercase">Present</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-brand-text-muted group-hover:text-brand-primary transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-start gap-4">
        <QrCode className="w-8 h-8 flex-shrink-0 mt-0.5 opacity-80" />
        <div>
          <h4 className="font-black text-sm mb-1">How QR Attendance Works</h4>
          <p className="text-xs text-white/80 leading-relaxed">
            Generate a QR code for your class → Share it via group/projector → Students scan it on their phones,
            enter their college ID, take a selfie, and their GPS location is verified automatically.
            The code expires in 5–10 minutes to prevent misuse.
          </p>
        </div>
      </div>
    </div>
  );
}
