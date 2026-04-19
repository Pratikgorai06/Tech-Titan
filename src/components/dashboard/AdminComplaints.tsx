import React, { useState, useEffect } from 'react';
import { dbService, Complaint } from '../../lib/db';
import { MessageSquare, Clock, AlertCircle, CheckCircle2, ChevronRight, Loader2, Filter, Reply, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Complaint['status'] | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    setLoading(true);
    const data = await dbService.getComplaints();
    setComplaints(data);
    setLoading(false);
  };

  const handleUpdateStatus = async (id: string, status: Complaint['status']) => {
    setUpdatingId(id);
    await dbService.updateComplaintStatus(id, status);
    await fetchComplaints();
    setUpdatingId(null);
  };

  const filteredComplaints = complaints.filter(c => filter === 'all' || c.status === filter);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Loading Complaints Inbox...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-text-main uppercase">Grievance Portal</h2>
          <p className="text-brand-text-muted mt-2 max-w-xl text-sm font-medium">
            Manage student feedback, technical issues, and administrative complaints. Ensure timely resolutions to maintain campus satisfaction.
          </p>
        </div>
        <div className="flex bg-white border border-brand-border rounded-2xl p-1 shadow-sm">
          {['all', 'pending', 'in-progress', 'resolved'].map(t => (
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
      </header>

      <div className="grid grid-cols-1 gap-6">
        {filteredComplaints.length === 0 ? (
          <div className="p-20 text-center bg-white border border-dashed border-brand-border rounded-3xl">
            <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm text-brand-text-muted font-medium">No complaints found under this category.</p>
          </div>
        ) : (
          filteredComplaints.map((complaint) => (
            <motion.div 
              layout
              key={complaint.id} 
              className="bg-white border border-brand-border rounded-3xl p-8 flex flex-col md:flex-row gap-8 group hover:shadow-xl transition-all"
            >
              {/* Status Column */}
              <div className="flex flex-col items-center justify-center space-y-3 min-w-[120px] border-r border-brand-border pr-8">
                <div className={cn(
                  "p-4 rounded-2xl border",
                  complaint.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-200" :
                  complaint.status === 'in-progress' ? "bg-blue-50 text-brand-primary border-blue-200" :
                  "bg-green-50 text-accent-green border-green-200"
                )}>
                  {complaint.status === 'pending' ? <AlertCircle className="w-6 h-6" /> :
                   complaint.status === 'in-progress' ? <Clock className="w-6 h-6" /> :
                   <CheckCircle2 className="w-6 h-6" />}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-center">{complaint.status}</span>
              </div>

              {/* Content Column */}
              <div className="flex-1 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-brand-text-main group-hover:text-brand-primary transition-colors">{complaint.subject}</h3>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">REF: #{complaint.id.slice(-6).toUpperCase()}</span>
                  </div>
                  <p className="text-xs font-bold text-brand-text-muted uppercase tracking-wider flex items-center gap-2">
                    <Reply className="w-3 h-3 rotate-180" />
                    Student ID: {complaint.studentId} • Received: {complaint.createdAt?.toDate().toLocaleDateString() || 'Today'}
                  </p>
                </div>
                <p className="text-sm text-brand-text-main leading-relaxed bg-slate-50 p-4 rounded-2xl border border-brand-border">
                  {complaint.description}
                </p>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest mr-2">Action Required:</p>
                  
                  {complaint.status !== 'in-progress' && complaint.status !== 'resolved' && (
                    <button 
                      onClick={() => handleUpdateStatus(complaint.id, 'in-progress')}
                      disabled={!!updatingId}
                      className="px-4 py-2 bg-blue-50 text-brand-primary border border-blue-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all disabled:opacity-50"
                    >
                      Process Ticket
                    </button>
                  )}
                  
                  {complaint.status !== 'resolved' && (
                    <button 
                      onClick={() => handleUpdateStatus(complaint.id, 'resolved')}
                      disabled={!!updatingId}
                      className="px-4 py-2 bg-green-50 text-accent-green border border-green-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent-green hover:text-white transition-all disabled:opacity-50"
                    >
                      Resolve Issue
                    </button>
                  )}

                  <button className="p-2 ml-auto text-slate-300 hover:text-brand-emergency hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
