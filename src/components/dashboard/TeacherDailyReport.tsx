import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Users, Download, Loader2, Search, 
  MapPin, ScanFace, Shield, Filter, ArrowLeftRight,
  ChevronLeft, ChevronRight, FileText
} from 'lucide-react';
import { getAttendanceByDateRange } from '../../lib/attendanceDb';
import type { AttendanceRecord } from '../../lib/db';
import { cn } from '../../lib/utils';

export default function TeacherDailyReport() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'flagged'>('all');

  useEffect(() => {
    fetchDailyRecords();
  }, [selectedDate]);

  const fetchDailyRecords = async () => {
    setLoading(true);
    // Get start and end of selected day
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);

    try {
      const data = await getAttendanceByDateRange(start, end);
      setRecords(data);
    } catch (e) {
      console.error('Failed to fetch daily records:', e);
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (days: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + days);
    setSelectedDate(next);
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.collegeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.regNo?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'verified') return matchesSearch && r.verified && r.faceVerified;
    if (filter === 'flagged') return matchesSearch && (!r.verified || !r.faceVerified);
    return matchesSearch;
  });

  const exportToCsv = () => {
    if (records.length === 0) return;
    const headers = ['S.No', 'Name', 'Reg No', 'Branch', 'Year', 'Section', 'Batch', 'Time', 'Location', 'Face Match', 'Device ID'];
    const rows = records.map((r, i) => [
      i + 1,
      r.studentName,
      r.regNo || r.collegeId,
      r.department || 'N/A',
      r.academicYear || 'N/A',
      r.section || 'N/A',
      r.batch || 'N/A',
      r.markedAt.toDate().toLocaleTimeString(),
      r.verified ? 'Verified' : 'Flagged',
      r.faceVerified ? 'Match' : 'Mismatch',
      r.deviceId || 'N/A'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Attendance_${selectedDate.toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest mb-1">Teacher Portal · Reports</p>
          <h2 className="text-3xl font-black tracking-tight text-brand-text-main">Daily Attendance</h2>
          <p className="text-brand-text-muted mt-1 text-sm">Review all students present on a specific date across all sessions.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-brand-border shadow-sm">
          <button 
            onClick={() => changeDate(-1)}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-brand-text-muted" />
          </button>
          <div className="flex flex-col items-center px-4 min-w-[140px]">
            <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">
              {selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}
            </span>
            <span className="text-sm font-black text-brand-text-main">
              {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <button 
            onClick={() => changeDate(1)}
            disabled={selectedDate.toDateString() === new Date().toDateString()}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5 text-brand-text-muted" />
          </button>
          <div className="w-px h-8 bg-brand-border mx-1" />
          <input 
            type="date" 
            className="hidden" 
            id="date-picker" 
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
          />
          <button 
            onClick={() => (document.getElementById('date-picker') as any)?.showPicker()}
            className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl hover:bg-brand-primary/20 transition-colors"
          >
            <Calendar className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Present', value: records.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'GPS Verified', value: records.filter(r => r.verified).length, icon: MapPin, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Face Verified', value: records.filter(r => r.faceVerified).length, icon: ScanFace, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Flagged/Suspicious', value: records.filter(r => !r.verified || !r.faceVerified).length, icon: Shield, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-brand-border rounded-2xl p-5 shadow-sm">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", stat.bg)}>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <p className="text-2xl font-black text-brand-text-main tabular-nums">{loading ? '—' : stat.value}</p>
            <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
          <input 
            type="text" 
            placeholder="Search student name, ID or reg no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-brand-border rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-brand-primary/10 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex p-1 bg-white border border-brand-border rounded-xl">
            {(['all', 'verified', 'flagged'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                  filter === f ? "bg-brand-primary text-white shadow-sm" : "text-brand-text-muted hover:text-brand-text-main"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button 
            onClick={exportToCsv}
            disabled={records.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
            <p className="text-sm font-bold text-brand-text-muted">Analyzing attendance records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-20 text-center">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-bold text-brand-text-muted">No records found for this date.</p>
            <p className="text-xs text-brand-text-muted mt-1">Try selecting a different date or clearing your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-brand-border text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                  <th className="px-6 py-4">S.No</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Reg No / ID</th>
                  <th className="px-6 py-4">Class Details</th>
                  <th className="px-6 py-4">Marked At</th>
                  <th className="px-6 py-4">Verification</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {filteredRecords.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-black text-brand-text-muted tabular-nums">{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {r.selfieUrl ? (
                          <img src={r.selfieUrl} alt={r.studentName} className="w-10 h-10 rounded-full object-cover border border-brand-border" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-xs uppercase">
                            {r.studentName.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-[13px] text-brand-text-main leading-tight">{r.studentName}</p>
                          <p className="text-[10px] text-brand-text-muted">{r.department || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[12px] font-bold text-brand-text-main">{r.regNo || r.collegeId}</p>
                      <p className="text-[9px] text-brand-text-muted uppercase font-black">ID: {r.collegeId.slice(0, 8)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] font-medium text-brand-text-main">
                        {r.academicYear} · {r.section}
                      </p>
                      <p className="text-[10px] text-brand-text-muted">{r.batch}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[12px] font-medium text-brand-text-main">
                        {r.markedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        {r.verified ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 w-fit uppercase">
                            <MapPin className="w-2.5 h-2.5" /> GPS OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 w-fit uppercase">
                            <MapPin className="w-2.5 h-2.5" /> Flagged
                          </span>
                        )}
                        {r.faceVerified ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100 w-fit uppercase">
                            <ScanFace className="w-2.5 h-2.5" /> Face Match
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 w-fit uppercase">
                            <ScanFace className="w-2.5 h-2.5" /> Mismatch
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-[11px] font-bold text-brand-primary hover:underline">View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
