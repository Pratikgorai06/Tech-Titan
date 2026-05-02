import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbService, CampusEvent, Complaint, UserProfile, FeeRecord } from '../../lib/db';
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowUpRight,
  MessageSquare,
  TrendingUp,
  Activity,
  ChevronRight,
  CreditCard
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    users: 0,
    complaints: 0,
    events: 0,
    attendance: 94.2,
    pendingFees: 0,
  });

  useEffect(() => {
    async function loadStats() {
      const [u, c, e, f] = await Promise.all([
        dbService.getAllUsers(),
        dbService.getComplaints(),
        dbService.getEvents(),
        dbService.getFees(),
      ]);
      setStats(prev => ({
        ...prev,
        users: u.length,
        complaints: c.filter(item => item.status === 'pending').length,
        events: e.length,
        pendingFees: f.filter(fee => fee.status === 'pending').length,
      }));
    }
    loadStats();
  }, []);

  const systemStats = [
    { label: 'Enrolled Students', value: stats.users, icon: Users, color: 'text-brand-primary', bg: 'bg-blue-50', border: 'border-blue-100', route: '/admin/attendance' },
    { label: 'Open Complaints', value: stats.complaints, icon: AlertCircle, color: 'text-brand-emergency', bg: 'bg-red-50', border: 'border-red-100', route: '/admin/complaints' },
    { label: 'Campus Events', value: stats.events, icon: Calendar, color: 'text-accent-purple', bg: 'bg-purple-50', border: 'border-purple-100', route: '/admin/events' },
    { label: 'Avg. Attendance', value: `${stats.attendance}%`, icon: Activity, color: 'text-accent-green', bg: 'bg-green-50', border: 'border-green-100', route: '/admin/attendance' },
    { label: 'Pending Fees', value: stats.pendingFees, icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', route: '/admin/fees' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-text-main uppercase flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-brand-primary" />
            Admin Command Center
          </h2>
          <p className="text-brand-text-muted mt-2 max-w-xl text-sm font-medium">
            Global overview of campus operations. Audit student performance, manage institutional grievances, and coordinate multi-departmental events.
          </p>
        </div>
        <div className="px-5 py-3 bg-white border border-brand-border rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">Database Engine: Online</span>
        </div>
      </header>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {systemStats.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
            onClick={() => navigate(stat.route)}
            className="bg-white p-7 rounded-3xl border border-brand-border hover:shadow-xl transition-all group cursor-pointer"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-200 group-hover:text-brand-primary transition-colors" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest leading-none">{stat.label}</p>
              <h4 className="text-4xl font-black text-brand-text-main tabular-nums leading-none pt-1">{stat.value}</h4>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-8">
        <div className="space-y-6">
          <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-brand-border flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-black text-brand-text-muted uppercase tracking-widest">Administrative Quick Links</h3>
              <TrendingUp className="w-4 h-4 text-brand-primary" />
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: 'Student Roster', desc: 'Audit student academic records', route: '/admin/attendance', icon: Users },
                { title: 'Event Planner', desc: 'Schedule new campus activity', route: '/admin/events', icon: Calendar },
                { title: 'Support Inbox', desc: 'Respond to student grievances', route: '/admin/complaints', icon: MessageSquare },
                { title: 'Job Board', desc: 'Post new career opportunities', route: '/admin/career', icon: Activity },
                { title: 'Fee Manager', desc: 'Create and track student fees', route: '/admin/fees', icon: CreditCard },
              ].map(link => (
                <button
                  key={link.title}
                  onClick={() => navigate(link.route)}
                  className="p-6 bg-white border border-brand-border rounded-2xl text-left hover:border-brand-primary hover:shadow-md transition-all flex items-center gap-5 group"
                >
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-brand-text-muted group-hover:bg-blue-50 group-hover:text-brand-primary transition-colors">
                    <link.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-[14px] font-black text-brand-text-main leading-tight">{link.title}</h5>
                    <p className="text-[11px] text-brand-text-muted font-medium mt-0.5">{link.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 ml-auto text-slate-200 group-hover:text-brand-primary transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
