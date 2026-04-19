import React, { useState, useEffect } from 'react';
import { dbService, CareerPosting } from '../../lib/db';
import { Briefcase, Plus, Search, DollarSign, MapPin, Calendar, ExternalLink, Loader2, CheckCircle2, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminCareer() {
  const [postings, setPostings] = useState<CareerPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    salary: '',
    deadline: '',
    type: 'Full-time',
    status: 'Open'
  });

  useEffect(() => {
    fetchPostings();
  }, []);

  const fetchPostings = async () => {
    setLoading(true);
    const data = await dbService.getCareers();
    setPostings(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.company) return;
    
    setIsAdding(true);
    await dbService.addCareer(formData as any);
    setFormData({ title: '', company: '', location: '', salary: '', deadline: '', type: 'Full-time', status: 'Open' });
    setShowForm(false);
    await fetchPostings();
    setIsAdding(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Loading Career Manager...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-text-main uppercase">Placement Hub Admin</h2>
          <p className="text-brand-text-muted mt-2 max-w-xl text-sm font-medium">
            Manage corporate partnerships, internships, and full-time placement opportunities for the student body.
          </p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="px-8 py-4 bg-brand-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200/50 flex items-center gap-3 transition-all"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel Posting" : "Add Opportunity"}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <AnimatePresence>
          {showForm && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="lg:col-span-12"
            >
              <form onSubmit={handleSubmit} className="bg-white border border-brand-border rounded-3xl p-8 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-3 pb-2 border-b border-brand-border">
                   <h3 className="text-xs font-black text-brand-text-muted uppercase tracking-widest">New Job Posting</h3>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Job Title</label>
                  <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Software Engineer" className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Company</label>
                  <input required value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} placeholder="Meta" className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Location</label>
                  <input required value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Remote / City" className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Salary Package</label>
                  <input value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} placeholder="₹12-15 LPA" className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Deadline Date</label>
                  <input type="date" required value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Engagement Type</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all appearance-none">
                    {['Full-time', 'Internship', 'Contract'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="md:col-span-3 flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowForm(false)} className="px-8 py-3 bg-slate-50 border border-brand-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">Discard</button>
                  <button 
                    type="submit" 
                    disabled={isAdding}
                    className="px-12 py-3 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Publish Posting
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="lg:col-span-12">
          <div className="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-brand-border flex items-center justify-between">
               <h3 className="text-xs font-black text-brand-text-muted uppercase tracking-widest">Active Listings</h3>
               <Search className="w-4 h-4 text-brand-text-muted" />
            </div>
            <div className="divide-y divide-brand-border">
              {postings.length === 0 ? (
                <div className="p-20 text-center">
                   <Briefcase className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                   <p className="text-sm text-brand-text-muted font-medium">No active job postings have been created.</p>
                </div>
              ) : (
                postings.map((posting) => (
                  <div key={posting.id} className="p-8 hover:bg-slate-50/50 transition-all flex flex-col md:flex-row items-center gap-8 group">
                    <div className="w-16 h-16 bg-white border border-brand-border rounded-2xl flex items-center justify-center text-brand-primary shadow-sm group-hover:scale-110 transition-transform">
                      <Briefcase className="w-8 h-8" />
                    </div>
                    <div className="flex-1 space-y-2 text-center md:text-left">
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                         <h4 className="text-[17px] font-black text-brand-text-main">{posting.title}</h4>
                         <span className="px-2 py-0.5 bg-blue-50 text-brand-primary text-[9px] font-black rounded-full border border-blue-100 uppercase tracking-tighter">
                            {posting.type}
                         </span>
                      </div>
                      <p className="text-[13px] font-medium text-brand-text-muted">{posting.company} • {posting.location}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-4 text-center">
                       <div className="px-4 py-2 bg-slate-50 border border-brand-border rounded-xl">
                          <p className="text-[9px] font-black text-brand-text-muted uppercase tracking-widest mb-0.5">Package</p>
                          <p className="text-xs font-black text-brand-text-main">{posting.salary || '—'}</p>
                       </div>
                       <div className="px-4 py-2 bg-slate-50 border border-brand-border rounded-xl">
                          <p className="text-[9px] font-black text-brand-text-muted uppercase tracking-widest mb-0.5">Deadline</p>
                          <p className="text-xs font-black text-brand-text-main">{posting.deadline}</p>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <button className="p-3 border border-brand-border rounded-2xl hover:bg-white hover:text-brand-emergency transition-all">
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
