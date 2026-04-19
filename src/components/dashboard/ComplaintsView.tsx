import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { dbService, Complaint, MOCK_STUDENT_ID } from '../../lib/db';
import { Send, Clock, MessageSquare, AlertCircle, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ComplaintsView() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    const data = await dbService.getComplaints(MOCK_STUDENT_ID);
    setComplaints(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) return;
    setIsSubmitting(true);
    await dbService.raiseComplaint(MOCK_STUDENT_ID, subject, description);
    setSubject('');
    setDescription('');
    await fetchComplaints();
    setIsSubmitting(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 5000);
  };

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-10 animate-in fade-in duration-500">
      <div className="xl:col-span-4 space-y-8">
        <header>
          <h2 className="text-3xl font-bold tracking-tight text-brand-text-main">Complaints</h2>
          <p className="text-brand-text-muted mt-2 text-sm leading-relaxed">
            Report maintenance issues, academic grievances, or campus facility problems. Our team typically responds within 24 hours.
          </p>
        </header>

        <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-6 py-4 border-b border-brand-border">
            <h3 className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">New Ticket</h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest px-1">Subject</label>
              <input 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue"
                className="w-full bg-slate-50 border border-brand-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-brand-primary focus:bg-white outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest px-1">Detailed Description</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide as much detail as possible..."
                rows={5}
                className="w-full bg-slate-50 border border-brand-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-brand-primary focus:bg-white outline-none transition-all resize-none font-sans"
              />
            </div>

            <AnimatePresence mode="wait">
              {showSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 text-accent-green text-xs font-bold"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Successfully Submitted!
                </motion.div>
              ) : (
                <button 
                  disabled={isSubmitting || !subject || !description}
                  type="submit"
                  className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200/20 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Register Complaint
                </button>
              )}
            </AnimatePresence>
            
            <p className="text-[10px] text-brand-text-muted text-center pt-2 italic">
              Ticket ID will be generated upon submission.
            </p>
          </form>
        </div>
      </div>

      <div className="xl:col-span-8 flex flex-col space-y-6">
        <div className="flex items-center justify-between border-b border-brand-border pb-4">
          <h3 className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Active & Historical Tickets</h3>
          <div className="flex items-center gap-4 text-xs font-bold text-brand-primary">
            <span className="cursor-pointer hover:underline">Download Report</span>
          </div>
        </div>

        {complaints.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 border border-dashed border-brand-border rounded-3xl text-slate-300 space-y-4">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p className="italic text-sm">No complaints found. Your record is clean.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {complaints.map((complaint) => (
              <motion.div 
                layout
                key={complaint.id} 
                className="bg-white border border-brand-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6 group hover:border-slate-300 transition-all cursor-pointer shadow-sm"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-brand-text-main text-base group-hover:text-brand-primary transition-colors">{complaint.subject}</h4>
                    <span className={cn(
                      "px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-tighter border",
                      complaint.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-200" :
                      complaint.status === 'in-progress' ? "bg-blue-50 text-brand-primary border-blue-200" :
                      "bg-green-50 text-accent-green border-green-200"
                    )}>
                      {complaint.status}
                    </span>
                  </div>
                  <p className="text-xs text-brand-text-muted leading-relaxed font-medium">{complaint.description}</p>
                  
                  <div className="flex items-center gap-5 pt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{complaint.createdAt?.toDate().toLocaleDateString() || 'Today'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>REF: #{complaint.id.slice(-6).toUpperCase()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-brand-text-muted group-hover:text-brand-primary transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
