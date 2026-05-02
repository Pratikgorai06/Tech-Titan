import React, { useState, useEffect } from 'react';
import { dbService, FeeRecord, UserProfile } from '../../lib/db';
import {
  CreditCard, Plus, Loader2, CheckCircle2, Trash2, X,
  Search, DollarSign, Users, AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminFees() {
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<UserProfile[]>([]);

  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    description: '',
    dueDate: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [allFees, allUsers] = await Promise.all([
      dbService.getFees(),
      dbService.getUsersByRole('student'),
    ]);
    setFees(allFees);
    setStudents(allUsers);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.amount || !formData.description || !formData.dueDate) return;

    setIsAdding(true);
    await dbService.addFee({
      studentId: formData.studentId,
      amount: Number(formData.amount),
      description: formData.description,
      dueDate: formData.dueDate,
      status: 'pending',
    });
    setFormData({ studentId: '', amount: '', description: '', dueDate: '' });
    setShowForm(false);
    await fetchData();
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await dbService.deleteFee(id);
    setFees(prev => prev.filter(f => f.id !== id));
    setDeletingId(null);
  };

  const filtered = fees
    .filter(f => filter === 'all' || f.status === filter)
    .filter(f =>
      !searchQuery ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.studentId.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const totalPending = fees.filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0);
  const totalCollected = fees.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Loading Fee Records...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-text-main uppercase">Fee Management</h2>
          <p className="text-brand-text-muted mt-2 max-w-xl text-sm font-medium">
            Create, track, and manage student fee records. Monitor pending dues and collection status.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-8 py-4 bg-brand-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200/50 flex items-center gap-3 transition-all"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Fee Entry'}
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Records', value: fees.length, icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Pending Dues', value: `₹${totalPending.toLocaleString('en-IN')}`, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Total Collected', value: `₹${totalCollected.toLocaleString('en-IN')}`, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
        ].map(s => (
          <div key={s.label} className={cn('p-5 rounded-2xl border flex items-center gap-4', s.bg)}>
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

      {/* Add Fee Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <form onSubmit={handleSubmit} className="bg-white border border-brand-border rounded-3xl p-8 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 pb-2 border-b border-brand-border">
                <h3 className="text-xs font-black text-brand-text-muted uppercase tracking-widest">New Fee Entry</h3>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Student</label>
                <select
                  required
                  value={formData.studentId}
                  onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all appearance-none"
                >
                  <option value="">Select Student</option>
                  {students.map(s => (
                    <option key={s.uid} value={s.uid}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="e.g. 85000"
                  className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Description</label>
                <input
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Semester Tuition / Library Fine / Hostel"
                  className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={formData.dueDate}
                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-brand-border">
                <button type="button" onClick={() => setShowForm(false)} className="px-8 py-3 bg-slate-50 border border-brand-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">Discard</button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-12 py-3 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Create Fee
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
          <input
            type="text"
            placeholder="Search by description or student ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-brand-border rounded-2xl pl-12 pr-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none shadow-sm"
          />
        </div>
        <div className="flex bg-white border border-brand-border rounded-2xl p-1 shadow-sm">
          {['all', 'pending', 'paid'].map(t => (
            <button
              key={t}
              onClick={() => setFilter(t as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                filter === t ? "bg-brand-primary text-white shadow-md shadow-blue-200" : "text-brand-text-muted hover:bg-slate-50"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Fee Records Table */}
      <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-20 text-center">
            <CreditCard className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm text-brand-text-muted font-medium">No fee records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-brand-border text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                  <th className="px-6 py-5">Description</th>
                  <th className="px-6 py-5">Student ID</th>
                  <th className="px-6 py-5">Amount</th>
                  <th className="px-6 py-5">Due Date</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {filtered.map(fee => (
                  <tr key={fee.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <p className="font-black text-[13px] text-brand-text-main">{fee.description}</p>
                      <p className="text-[10px] text-brand-text-muted font-mono">#{fee.id.slice(-8)}</p>
                    </td>
                    <td className="px-6 py-5 text-[12px] font-bold text-brand-text-muted font-mono">{fee.studentId.slice(0, 14)}</td>
                    <td className="px-6 py-5">
                      <p className="text-[15px] font-black text-brand-text-main tabular-nums">₹{fee.amount.toLocaleString('en-IN')}</p>
                    </td>
                    <td className="px-6 py-5 text-[12px] font-bold text-brand-text-muted">{fee.dueDate}</td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                        fee.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {fee.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => handleDelete(fee.id)}
                        disabled={deletingId === fee.id}
                        className="p-2 text-slate-300 hover:text-brand-emergency hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                      >
                        {deletingId === fee.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
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
