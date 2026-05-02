import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Calendar, 
  ExternalLink, 
  FileText, 
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  X,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { dbService, CareerPosting } from '../../lib/db';

export default function CareerHubView() {
  const [jobs, setJobs] = useState<CareerPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All'|'Internship'|'Full-time'>('All');
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState<CareerPosting | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    const data = await dbService.getCareers();
    if (data.length === 0) {
      // Temporary mock data for seeding if empty
      setJobs([
        { id: '1', title: 'Software Engineer Intern', company: 'Google', location: 'Bangalore, India', salary: '₹80k/mo', deadline: '2026-05-15', type: 'Internship', status: 'Open' },
        { id: '2', title: 'Product Management Fellow', company: 'Microsoft', location: 'Hyderabad, India', salary: '₹75k/mo', deadline: '2026-05-20', type: 'Internship', status: 'Applied' },
      ]);
    } else {
      setJobs(data);
    }
    setLoading(false);
  };

  const filteredJobs = jobs.filter(job => {
    const matchesFilter = filter === 'All' || job.type === filter;
    const matchesSearch = job.title.toLowerCase().includes(search.toLowerCase()) || 
                          job.company.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleApply = (id: string) => {
    // For demo purposes, we update the local state to show 'Applied'
    setJobs(prev => prev.map(job => job.id === id ? { ...job, status: 'Applied' } : job));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Opening Opportunity Vault...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-brand-text-main">Career Assistant</h2>
          <p className="text-brand-text-muted mt-2 max-w-xl">
            Access curated job postings, track your applications, and prepare for placements with our AI-powered career resources.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white border border-brand-border rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-accent-green" />
            <div className="text-left">
              <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">Placement Status</p>
              <p className="text-sm font-bold text-brand-text-main">Eligible</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <aside className="lg:col-span-1 space-y-8">
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-brand-text-muted uppercase tracking-widest px-2">Job Search</h4>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company..."
                className="w-full bg-white border border-brand-border rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-brand-text-muted uppercase tracking-widest px-2">Job Type</h4>
            <div className="space-y-2">
              {['All', 'Internship', 'Full-time'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t as any)}
                  className={cn(
                    "w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    filter === t ? "bg-brand-primary text-white" : "bg-white text-brand-text-muted hover:bg-slate-50 border border-brand-border"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Job Listings */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Showing {filteredJobs.length} listings</span>
            <div className="flex items-center gap-2 text-xs font-medium text-brand-primary cursor-pointer hover:underline">
              Sort by Recent <Clock className="w-3 h-3" />
            </div>
          </div>
          
          {filteredJobs.length === 0 ? (
            <div className="p-20 text-center bg-white border border-brand-border rounded-2xl">
              <p className="text-sm text-brand-text-muted italic">No jobs match your current search.</p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <motion.div 
                layout
                key={job.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "p-6 bg-white border rounded-2xl flex flex-col sm:flex-row gap-6 hover:shadow-lg transition-all",
                  job.status === 'Applied' ? "border-green-100 bg-green-50/20" : "border-brand-border"
                )}
              >
                <div className="w-14 h-14 bg-slate-50 border border-brand-border rounded-xl flex items-center justify-center text-brand-primary shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                
                <div className="flex-1 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-brand-text-main leading-tight">{job.title}</h3>
                      <p className="text-sm text-brand-text-muted font-medium mt-0.5">{job.company}</p>
                    </div>
                    {job.status === 'Applied' ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-full border border-green-200 self-start">
                        Application Sent
                      </span>
                    ) : (
                      <button 
                        onClick={() => setSelectedJob(job)}
                        className="px-6 py-2 bg-brand-primary text-white text-[11px] uppercase tracking-widest font-black rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all"
                      >
                        View Info
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 opacity-60" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 opacity-60" />
                      <span>{job.salary}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 opacity-60" />
                      <span>Due: {job.deadline}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                      <span>{job.type}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Slide-in Detail Modal */}
      <AnimatePresence>
        {selectedJob && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setSelectedJob(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto flex flex-col"
            >
              <div className="h-32 bg-slate-900 border-b border-brand-border flex items-center justify-center relative shrink-0">
                <Briefcase className="w-12 h-12 text-white/10 absolute right-8 top-8" />
                <div className="absolute top-6 left-6 text-white font-black text-xs uppercase tracking-widest px-3 py-1 bg-white/10 rounded-full border border-white/10">
                  {selectedJob.type} Opening
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="absolute top-4 right-4 w-9 h-9 bg-white/10 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              <div className="p-8 flex-1 space-y-6">
                 <div>
                   <h2 className="text-2xl font-black text-brand-text-main mt-1 leading-tight">{selectedJob.title}</h2>
                   <p className="font-bold text-brand-primary mt-1">{selectedJob.company}</p>
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 border border-brand-border rounded-2xl space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-brand-text-muted flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> Location
                      </p>
                      <p className="text-sm font-black text-brand-text-main">{selectedJob.location}</p>
                    </div>
                    <div className="p-4 bg-slate-50 border border-brand-border rounded-2xl space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-brand-text-muted flex items-center gap-1.5">
                        <DollarSign className="w-3 h-3" /> Salary
                      </p>
                      <p className="text-sm font-black text-brand-text-main">{selectedJob.salary}</p>
                    </div>
                 </div>

                 <div className="space-y-3">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">Job Overview</h4>
                   <p className="text-sm text-brand-text-main font-medium leading-relaxed">
                     {selectedJob.description || `We are looking for a highly motivated ${selectedJob.title} to join our team at ${selectedJob.company}. You will be responsible for helping drive impact across multiple sectors in our engineering stack.`}
                   </p>
                 </div>

                 <div className="space-y-3">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">Key Requirements</h4>
                   <ul className="space-y-2.5">
                     {(selectedJob.requirements || ['B.Tech / MCA in Computer Science or related degree', 'Strong foundation in Data Structures and Algorithms', 'Excellent communication and teamwork skills', 'Familiarity with Modern web frameworks is a plus']).map((req, i) => (
                       <li key={i} className="flex items-start gap-3">
                         <div className="w-5 h-5 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                           <TrendingUp className="w-2.5 h-2.5 text-brand-primary" />
                         </div>
                         <span className="text-sm text-brand-text-main font-medium leading-relaxed">{req}</span>
                       </li>
                     ))}
                   </ul>
                 </div>

                 {selectedJob.status !== 'Applied' && (
                    <button 
                      onClick={() => { handleApply(selectedJob.id); setSelectedJob(null); }}
                      className="w-full py-4 mt-4 bg-gradient-to-r from-brand-primary to-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-blue-200/50 flex items-center justify-center gap-3 hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Apply for this Position
                    </button>
                 )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
