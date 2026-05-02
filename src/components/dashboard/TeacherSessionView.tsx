import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft, Users, MapPin, Camera, Clock,
  CheckCircle2, XCircle, Loader2, QrCode
} from 'lucide-react';
import { getQrSession, getSessionAttendance } from '../../lib/attendanceDb';
import type { QrSession, AttendanceRecord } from '../../lib/db';
import { cn } from '../../lib/utils';

export default function TeacherSessionView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<QrSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      getQrSession(sessionId),
      getSessionAttendance(sessionId),
    ]).then(([sess, recs]) => {
      setSession(sess);
      setRecords(recs);
      setLoading(false);
    });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20">
        <QrCode className="w-12 h-12 text-slate-200 mx-auto mb-4" />
        <p className="text-brand-text-muted font-medium">Session not found.</p>
        <button onClick={() => navigate('/teacher/attendance')} className="mt-4 text-sm text-brand-primary font-bold hover:underline">
          Back to Attendance
        </button>
      </div>
    );
  }

  const verified = records.filter((r) => r.verified).length;
  const flagged = records.length - verified;
  const isActive = session.active && session.expiresAt.toMillis() > Date.now();

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header>
        <button
          onClick={() => navigate('/teacher/dashboard')}
          className="flex items-center gap-2 text-brand-text-muted hover:text-brand-text-main transition-colors text-sm font-bold mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black text-brand-text-main">{session.subject}</h2>
              <span className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                isActive ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-slate-100 text-slate-500'
              )}>
                {isActive ? 'Live' : 'Ended'}
              </span>
            </div>
            <p className="text-brand-text-muted text-sm">
              {session.branch} · Year {session.year} · by {session.teacherName}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-brand-text-muted">
              <Clock className="w-3 h-3" />
              Created {session.createdAt.toDate().toLocaleString()} ·
              Expires {session.expiresAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Present', value: records.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Location Verified', value: verified, icon: MapPin, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
          { label: 'Flagged', value: flagged, icon: XCircle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-brand-border rounded-2xl p-6 flex items-center gap-4">
            <div className={cn('w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0', s.bg)}>
              <s.icon className={cn('w-5 h-5', s.color)} />
            </div>
            <div>
              <p className="text-2xl font-black text-brand-text-main tabular-nums">{s.value}</p>
              <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Attendance Table */}
      <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-8 py-5 border-b border-brand-border">
          <h3 className="font-black text-brand-text-main text-sm uppercase tracking-widest">Attendance Records</h3>
          <span className="text-xs text-brand-text-muted font-bold">{records.length} students</span>
        </div>
        {records.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-brand-text-muted">No students marked attendance yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-brand-border text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">College ID</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Selfie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {records.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-[12px] font-black text-brand-text-muted tabular-nums">{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {r.selfieUrl ? (
                          <img
                            src={r.selfieUrl}
                            alt={r.studentName}
                            className="w-9 h-9 rounded-full object-cover border border-brand-border cursor-pointer hover:scale-110 transition-transform"
                            onClick={() => setSelectedRecord(r)}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-black">
                            {r.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                        )}
                        <span className="font-bold text-[13px] text-brand-text-main">{r.studentName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[12px] text-brand-text-muted">{r.collegeId}</td>
                    <td className="px-6 py-4 text-[12px] text-brand-text-muted">
                      {r.markedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      {r.verified ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full w-fit">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          <span className="text-[10px] font-black text-green-700 uppercase">Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full w-fit">
                          <XCircle className="w-3 h-3 text-amber-600" />
                          <span className="text-[10px] font-black text-amber-700 uppercase">Flagged</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {r.selfieUrl ? (
                        <button
                          onClick={() => setSelectedRecord(r)}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-[10px] font-black text-blue-700 uppercase hover:bg-blue-100 transition-colors"
                        >
                          <Camera className="w-3 h-3" />
                          View
                        </button>
                      ) : (
                        <span className="text-[11px] text-brand-text-muted">—</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selfie Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-black text-brand-text-main">{selectedRecord.studentName}</h4>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <XCircle className="w-5 h-5 text-brand-text-muted" />
              </button>
            </div>
            <img
              src={selectedRecord.selfieUrl}
              alt="Student selfie"
              className="w-full rounded-2xl object-cover border border-brand-border"
            />
            <div className="space-y-1.5 text-[12px] text-brand-text-muted">
              <p><span className="font-bold">College ID:</span> {selectedRecord.collegeId}</p>
              <p><span className="font-bold">Time:</span> {selectedRecord.markedAt.toDate().toLocaleString()}</p>
              <p><span className="font-bold">Location:</span> {selectedRecord.verified ? '✅ Verified' : '⚠️ Flagged'}</p>
              <p><span className="font-bold">Coords:</span> {selectedRecord.locationLat.toFixed(4)}, {selectedRecord.locationLng.toFixed(4)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
