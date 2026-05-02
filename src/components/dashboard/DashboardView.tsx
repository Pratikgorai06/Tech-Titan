import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Users,
  UserCheck, 
  Calendar, 
  Clock, 
  MapPin, 
  ExternalLink,
  ChevronRight,
  CircleCheck,
  AlertTriangle
} from 'lucide-react';
import { dbService, UserProfile, CampusEvent, FeeRecord } from '../../lib/db';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

export default function DashboardView() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);

  useEffect(() => {
    if (!authUser) return;
    const uid = authUser.uid;

    async function loadData() {
      const [e, f] = await Promise.all([
        dbService.getEvents(),
        dbService.getFees(uid)
      ]);
      setEvents(e.slice(0, 3));
      setFees(f);
    }
    loadData();

    // Subscribe to realtime user updates for attendance/info
    const unsubscribe = dbService.subscribeUser(uid, (u) => {
      setUser(u);
    });

    return () => unsubscribe();
  }, [authUser]);

  const pendingFeesCount = fees.filter(f => f.status === 'pending').length;
  const totalPendingAmount = fees.filter(f => f.status === 'pending').reduce((a, b) => a + b.amount, 0);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Welcome Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-text-main">Welcome back, {user?.name || 'Student'}!</h2>
          <p className="text-brand-text-muted text-sm mt-1">{user?.department || 'Computer Science'} • Year {user?.academicYear || '3'}</p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="text-right">
            <div className="font-semibold text-sm">{user?.name}</div>
            <div className="text-[10px] text-brand-text-muted uppercase tracking-wider font-bold">ID: {user?.collegeId || authUser?.uid?.slice(0, 10)}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm border border-brand-border">
            {user?.name?.split(' ').map(n => n[0]).join('') || 'ST'}
          </div>
        </div>
      </header>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Attendance', value: `${((user?.totalAttendance || 0) * 5) % 100}%`, sub: 'Active Geofenced Range', icon: UserCheck, color: 'bg-accent-green' },
          { label: 'Academic GPA', value: user?.gpa || '3.82', sub: 'Top 5% of class', icon: TrendingUp, color: 'bg-brand-primary' },
          { label: 'Upcoming Events', value: events.length.toString(), sub: 'Campus updates', icon: Calendar, color: 'bg-accent-purple' },
          { label: 'Fee Overdue', value: `₹${totalPendingAmount.toLocaleString('en-IN')}`, sub: `${pendingFeesCount} pending dues`, icon: AlertTriangle, color: 'bg-accent-orange' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-5 bg-white rounded-xl border border-brand-border flex flex-col"
          >
            <div className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider mb-4 flex items-center justify-between">
              {stat.label}
              <stat.icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-brand-text-main">{stat.value}</h3>
              <p className="text-[12px] text-brand-text-muted mt-1">{stat.sub}</p>
              
              <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden mt-4">
                <div className={cn("h-full", stat.color)} style={{ width: '75%' }} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {/* Upcoming Events Feed */}
        <section className="bg-white rounded-xl border border-brand-border overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between">
            <h3 className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Recent Events</h3>
          </div>
          <div className="divide-y divide-brand-border">
            {events.length === 0 ? (
              <div className="p-8 text-center text-xs text-brand-text-muted">No recent events</div>
            ) : (
              events.map((event, i) => (
                <div key={i} onClick={() => navigate('/student/events')} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-4">
                  <div>
                    <h5 className="text-[13px] font-bold text-brand-text-main leading-tight">{event.title}</h5>
                    <p className="text-[11px] text-brand-text-muted">{event.location}</p>
                  </div>
                  <div className="px-2 py-1 bg-blue-50 text-brand-primary text-[10px] font-bold rounded uppercase tracking-tighter">
                    {event.date}
                  </div>
                </div>
              ))
            )}
          </div>
          <button 
            onClick={() => navigate('/student/events')}
            className="w-full py-3 text-[11px] font-bold text-brand-primary hover:bg-slate-50 border-t border-brand-border transition-colors uppercase tracking-widest"
          >
            View All Events
          </button>
        </section>
      </div>
    </div>
  );
}
