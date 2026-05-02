import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  QrCode, X, Users, Clock, CheckCircle2, XCircle,
  Loader2, Copy, RefreshCw, StopCircle, MapPin, Camera
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createQrSession, endQrSession, listenToSession,
  listenToSessionAttendance
} from '../../lib/attendanceDb';
import type { QrSession, AttendanceRecord } from '../../lib/db';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import QRCode from 'qrcode';

const EXPIRY_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '7 min', value: 7 },
  { label: '10 min', value: 10 },
];

export default function TeacherQrAttendance() {
  const { user } = useAuth();

  // Form state
  const [subject, setSubject] = useState('');
  const [branch, setBranch] = useState('CSE');
  const [year, setYear] = useState(2);
  const [expiryMinutes, setExpiryMinutes] = useState(5);

  // Session state
  const [activeSession, setActiveSession] = useState<QrSession | null>(null);
  const [attendees, setAttendees] = useState<AttendanceRecord[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [campusCoords, setCampusCoords] = useState<{ lat: number; lng: number } | null>(null);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionUnsubRef = useRef<(() => void) | null>(null);
  const attendeesUnsubRef = useRef<(() => void) | null>(null);

  // Load campus coords
  useEffect(() => {
    getDoc(doc(db, 'settings', 'institute')).then((snap) => {
      if (snap.exists() && snap.data().latitude && snap.data().longitude) {
        setCampusCoords({ lat: parseFloat(snap.data().latitude), lng: parseFloat(snap.data().longitude) });
      }
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionUnsubRef.current?.();
      attendeesUnsubRef.current?.();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const startCountdown = useCallback((expiresAt: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  }, []);

  const generateQr = async () => {
    if (!user || !subject.trim()) return;
    setCreating(true);
    try {
      const sessionData = {
        teacherUid: user.uid,
        teacherName: user.displayName || 'Teacher',
        subject: subject.trim(),
        branch,
        year,
        campusLat: campusCoords?.lat ?? 0,
        campusLng: campusCoords?.lng ?? 0,
        expiryMinutes,
      };
      const sessionId = await createQrSession(sessionData);

      // Encode sessionId as QR
      const qrPayload = JSON.stringify({ sessionId, v: 1 });
      const dataUrl = await QRCode.toDataURL(qrPayload, {
        width: 400,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);

      // Listen to session doc
      sessionUnsubRef.current?.();
      sessionUnsubRef.current = listenToSession(sessionId, (s) => setActiveSession(s));

      // Listen to attendees
      attendeesUnsubRef.current?.();
      attendeesUnsubRef.current = listenToSessionAttendance(sessionId, setAttendees);

      // Countdown
      startCountdown(Date.now() + expiryMinutes * 60 * 1000);
    } finally {
      setCreating(false);
    }
  };

  const handleEnd = async () => {
    if (!activeSession) return;
    setEnding(true);
    await endQrSession(activeSession.id);
    setEnding(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const handleReset = () => {
    sessionUnsubRef.current?.();
    attendeesUnsubRef.current?.();
    if (countdownRef.current) clearInterval(countdownRef.current);
    setActiveSession(null);
    setAttendees([]);
    setQrDataUrl('');
    setCountdown(0);
    setSubject('');
  };

  const handleCopy = () => {
    if (activeSession) {
      navigator.clipboard.writeText(activeSession.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const isExpired = activeSession && (countdown === 0 || !activeSession.active);

  // ─── QR Active View ──────────────────────────────────────────────────────────
  if (activeSession) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest mb-1">Live Session</p>
            <h2 className="text-2xl font-black text-brand-text-main">{activeSession.subject}</h2>
            <p className="text-sm text-brand-text-muted">{activeSession.branch} · Year {activeSession.year}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-brand-border rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              New Session
            </button>
            {!isExpired && (
              <button
                onClick={handleEnd}
                disabled={ending}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                End Session
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* QR Code Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-brand-border rounded-3xl p-6 flex flex-col items-center gap-6 shadow-sm">
              {/* Countdown Ring */}
              <div className={cn(
                'relative w-full flex flex-col items-center p-6 rounded-2xl transition-colors',
                isExpired ? 'bg-red-50 border border-red-200' : countdown < 60 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className={cn('w-4 h-4', isExpired ? 'text-red-500' : countdown < 60 ? 'text-amber-500' : 'text-green-600')} />
                  <span className={cn('text-xs font-black uppercase tracking-widest', isExpired ? 'text-red-500' : countdown < 60 ? 'text-amber-600' : 'text-green-700')}>
                    {isExpired ? 'Expired' : 'Expires in'}
                  </span>
                </div>
                {!isExpired && (
                  <span className={cn('text-5xl font-black tabular-nums', countdown < 60 ? 'text-amber-600' : 'text-green-700')}>
                    {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                  </span>
                )}
                {isExpired && (
                  <span className="text-2xl font-black text-red-600">Session Ended</span>
                )}
              </div>

              {/* QR Image */}
              {qrDataUrl && !isExpired && (
                <div className="p-3 bg-white rounded-2xl border-2 border-brand-border shadow-inner">
                  <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 rounded-xl" />
                </div>
              )}
              {isExpired && (
                <div className="w-48 h-48 bg-slate-100 rounded-2xl flex items-center justify-center border border-brand-border">
                  <XCircle className="w-16 h-16 text-slate-300" />
                </div>
              )}

              {/* Session ID + Copy */}
              <div className="w-full space-y-2">
                <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest text-center">Session ID</p>
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-brand-border">
                  <code className="flex-1 text-[11px] font-bold text-brand-text-main truncate">{activeSession.id}</code>
                  <button onClick={handleCopy} className="text-brand-primary hover:opacity-70 flex-shrink-0">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-center text-brand-text-muted">
                  Share this QR via projector or group chat
                </p>
              </div>
            </div>
          </div>

          {/* Live Attendees */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between px-6 py-5 border-b border-brand-border">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <h3 className="font-black text-brand-text-main text-sm uppercase tracking-widest">Live Attendance</h3>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full">
                  <Users className="w-3.5 h-3.5 text-brand-primary" />
                  <span className="text-sm font-black text-brand-primary">{attendees.length}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-brand-border">
                {attendees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <Users className="w-10 h-10 text-slate-200" />
                    <p className="text-sm text-brand-text-muted font-medium">Waiting for students to scan...</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {attendees.map((r, i) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-4 px-6 py-4"
                      >
                        <span className="text-[11px] font-black text-brand-text-muted w-6 text-center tabular-nums">{i + 1}</span>
                        {r.selfieUrl ? (
                          <img src={r.selfieUrl} alt={r.studentName} className="w-10 h-10 rounded-full object-cover border-2 border-brand-border flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                            {r.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[13px] text-brand-text-main truncate">{r.studentName}</p>
                          <p className="text-[10px] text-brand-text-muted font-medium">ID: {r.collegeId}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {r.verified ? (
                            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded-full">
                              <MapPin className="w-3 h-3 text-green-600" />
                              <span className="text-[9px] font-black text-green-700 uppercase">Verified</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-full">
                              <MapPin className="w-3 h-3 text-amber-600" />
                              <span className="text-[9px] font-black text-amber-700 uppercase">Flagged</span>
                            </div>
                          )}
                          {r.selfieUrl && <Camera className="w-3.5 h-3.5 text-brand-text-muted" />}
                        </div>
                        <span className="text-[10px] text-brand-text-muted flex-shrink-0">
                          {r.markedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── QR Generation Form ───────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest mb-1">Teacher · QR Attendance</p>
        <h2 className="text-3xl font-black tracking-tight text-brand-text-main">Generate QR Code</h2>
        <p className="text-brand-text-muted mt-2 text-sm">
          Configure your class session and generate a time-limited QR code for students to scan.
        </p>
      </header>

      <div className="bg-white border border-brand-border rounded-3xl p-8 shadow-sm space-y-8">
        {/* Subject */}
        <div className="space-y-2">
          <label className="text-[11px] font-black text-brand-text-muted uppercase tracking-widest">Subject / Course Name *</label>
          <input
            type="text"
            placeholder="e.g. Data Structures, Machine Learning..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-brand-border rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-amber-400/30 outline-none transition-all"
          />
        </div>

        {/* Branch */}
        <div className="space-y-2">
          <label className="text-[11px] font-black text-brand-text-muted uppercase tracking-widest">Branch</label>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full border border-brand-border rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-amber-400/30 outline-none bg-white transition-all"
          >
            {['CSE', 'ECE', 'ME', 'CE', 'EE', 'IT', 'AIDS', 'CSE-AIML'].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div className="space-y-2">
          <label className="text-[11px] font-black text-brand-text-muted uppercase tracking-widest">Academic Year</label>
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={cn(
                  'flex-1 py-3 rounded-xl border font-bold text-sm transition-all',
                  year === y
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-200'
                    : 'bg-white border-brand-border text-brand-text-muted hover:border-amber-300'
                )}
              >
                Year {y}
              </button>
            ))}
          </div>
        </div>

        {/* Expiry */}
        <div className="space-y-2">
          <label className="text-[11px] font-black text-brand-text-muted uppercase tracking-widest">QR Expiry Duration</label>
          <div className="flex gap-3">
            {EXPIRY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setExpiryMinutes(opt.value)}
                className={cn(
                  'flex-1 py-3 rounded-xl border font-bold text-sm transition-all',
                  expiryMinutes === opt.value
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-200'
                    : 'bg-white border-brand-border text-brand-text-muted hover:border-amber-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-brand-text-muted">QR becomes invalid after this time. Students must scan before it expires.</p>
        </div>

        {/* Campus coords warning */}
        {!campusCoords && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-700 font-medium">
              Campus coordinates not configured. Student location verification will be skipped.
              Ask your admin to set campus coordinates in System Config.
            </p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={generateQr}
          disabled={creating || !subject.trim()}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-2xl shadow-lg shadow-amber-200 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3"
        >
          {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
          {creating ? 'Generating…' : 'Generate QR Code'}
        </button>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: QrCode, title: 'Generate', desc: 'Create a time-limited QR code for your class' },
          { icon: Users, title: 'Students Scan', desc: 'Students scan via their phone camera with college ID' },
          { icon: CheckCircle2, title: 'Auto Verified', desc: 'GPS + selfie verify each student instantly' },
        ].map((step) => (
          <div key={step.title} className="bg-white border border-brand-border rounded-2xl p-5 text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
              <step.icon className="w-5 h-5 text-amber-600" />
            </div>
            <p className="font-black text-[12px] text-brand-text-main">{step.title}</p>
            <p className="text-[11px] text-brand-text-muted leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
