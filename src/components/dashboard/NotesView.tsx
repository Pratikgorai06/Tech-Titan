import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  BookOpen, Search, Download, Plus, Loader2, FileText,
  FileSpreadsheet, Presentation, X, CheckCircle2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';

interface Note {
  id: string;
  subject: string;
  topic: string;
  semester: number;
  fileType: 'PDF' | 'PPT' | 'DOC' | 'XLSX';
  uploadedBy: string;
  uploadedAt: Timestamp;
  url: string;
  description: string;
}

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const FILE_TYPE_CONFIG = {
  PDF:  { icon: FileText,        color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200' },
  PPT:  { icon: Presentation,    color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
  DOC:  { icon: FileText,        color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  XLSX: { icon: FileSpreadsheet, color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-200' },
};

const MOCK_NOTES: Omit<Note, 'id' | 'uploadedAt'>[] = [
  { subject: 'Data Structures', topic: 'Binary Trees & Heaps', semester: 3, fileType: 'PDF', uploadedBy: 'Prof. Sharma', url: '#', description: 'Complete notes on binary search trees, AVL trees, and heap operations.' },
  { subject: 'Operating Systems', topic: 'Process Scheduling Algorithms', semester: 5, fileType: 'PPT', uploadedBy: 'Prof. Mehta', url: '#', description: 'FCFS, SJF, Round Robin with worked examples.' },
  { subject: 'Computer Networks', topic: 'TCP/IP Protocol Suite', semester: 4, fileType: 'PDF', uploadedBy: 'Prof. Roy', url: '#', description: 'Layers, addressing, subnetting, and routing protocols.' },
  { subject: 'DBMS', topic: 'SQL Joins & Normalization', semester: 4, fileType: 'DOC', uploadedBy: 'Prof. Das', url: '#', description: 'Inner, outer, cross joins with normalization up to 3NF/BCNF.' },
  { subject: 'Software Engineering', topic: 'SDLC & Agile Methodology', semester: 5, fileType: 'PPT', uploadedBy: 'Prof. Kumar', url: '#', description: 'Waterfall vs Agile, Scrum framework, sprint planning.' },
  { subject: 'Machine Learning', topic: 'Supervised Learning Models', semester: 6, fileType: 'PDF', uploadedBy: 'Prof. Ghosh', url: '#', description: 'Linear regression, SVM, decision trees with Python examples.' },
  { subject: 'Web Technologies', topic: 'React & REST APIs', semester: 6, fileType: 'PPT', uploadedBy: 'Prof. Bose', url: '#', description: 'JSX, hooks, state management and consuming APIs.' },
  { subject: 'Cloud Computing', topic: 'AWS & GCP Essentials', semester: 7, fileType: 'PDF', uploadedBy: 'Prof. Sen', url: '#', description: 'IaaS, PaaS, SaaS; EC2, S3, Lambda functions.' },
  { subject: 'Digital Electronics', topic: 'Flip-Flops & Counters', semester: 2, fileType: 'PDF', uploadedBy: 'Prof. Bandyopadhyay', url: '#', description: 'SR, JK, D, T flip-flops, synchronous/asynchronous counters.' },
  { subject: 'Engineering Mathematics', topic: 'Differential Equations', semester: 1, fileType: 'DOC', uploadedBy: 'Prof. Chatterjee', url: '#', description: 'First and second order ODEs with applications.' },
];

export default function NotesView() {
  const { role } = useAuth();
  const [notes, setNotes]           = useState<Note[]>([]);
  const [loading, setLoading]       = useState(true);
  const [semester, setSemester]     = useState<number>(5);
  const [search, setSearch]         = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData]     = useState({
    subject: '', topic: '', semester: 5, fileType: 'PDF' as Note['fileType'],
    url: '', description: '', uploadedBy: '',
  });

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    try {
      const snap = await getDocs(collection(db, 'notes'));
      if (snap.empty) {
        await seedNotes();
        fetchNotes();
        return;
      }
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Note));
      setNotes(data);
    } catch {
      // fallback to mock
      setNotes(MOCK_NOTES.map((n, i) => ({
        ...n, id: String(i), uploadedAt: Timestamp.now()
      })));
    } finally {
      setLoading(false);
    }
  };

  const seedNotes = async () => {
    for (const note of MOCK_NOTES) {
      await addDoc(collection(db, 'notes'), { ...note, uploadedAt: Timestamp.now() });
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'notes'), { ...formData, uploadedAt: Timestamp.now() });
      setShowForm(false);
      setFormData({ subject: '', topic: '', semester: 5, fileType: 'PDF', url: '', description: '', uploadedBy: '' });
      await fetchNotes();
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = notes.filter(n => {
    const matchSem = n.semester === semester;
    const matchSearch = !search ||
      n.subject.toLowerCase().includes(search.toLowerCase()) ||
      n.topic.toLowerCase().includes(search.toLowerCase());
    return matchSem && matchSearch;
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Loading Study Hub...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-brand-text-main flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-brand-primary" />
            Notes Repository
          </h2>
          <p className="text-brand-text-muted mt-2 max-w-xl">
            Access curated study materials organised by semester. Download PDFs, PPTs, and more.
          </p>
        </div>
        {role === 'admin' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-7 py-4 bg-brand-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200/50 flex items-center gap-3 transition-all"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Add Note'}
          </button>
        )}
      </header>

      {/* Admin add form */}
      <AnimatePresence>
        {showForm && role === 'admin' && (
          <motion.form
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleAddNote}
            className="bg-white border border-brand-border rounded-3xl p-7 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            <div className="md:col-span-3 pb-3 border-b border-brand-border">
              <h3 className="text-xs font-black text-brand-text-muted uppercase tracking-widest">Add Study Material</h3>
            </div>
            {[
              ['Subject', 'subject', 'e.g. Data Structures'],
              ['Topic', 'topic', 'e.g. Binary Trees'],
              ['Uploaded By', 'uploadedBy', 'e.g. Prof. Sharma'],
            ].map(([label, key, placeholder]) => (
              <div key={key} className="space-y-2">
                <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">{label}</label>
                <input
                  required
                  value={(formData as any)[key]}
                  onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-slate-50 border border-brand-border rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none"
                />
              </div>
            ))}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Semester</label>
              <select
                value={formData.semester}
                onChange={e => setFormData(p => ({ ...p, semester: +e.target.value }))}
                className="w-full bg-slate-50 border border-brand-border rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none appearance-none"
              >
                {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">File Type</label>
              <select
                value={formData.fileType}
                onChange={e => setFormData(p => ({ ...p, fileType: e.target.value as any }))}
                className="w-full bg-slate-50 border border-brand-border rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none appearance-none"
              >
                {['PDF', 'PPT', 'DOC', 'XLSX'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">File / Resource URL</label>
              <input
                required
                value={formData.url}
                onChange={e => setFormData(p => ({ ...p, url: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className="w-full bg-slate-50 border border-brand-border rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none"
              />
            </div>
            <div className="md:col-span-3 space-y-2">
              <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Short Description</label>
              <input
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of what the material covers"
                className="w-full bg-slate-50 border border-brand-border rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none"
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-7 py-3 bg-slate-50 border border-brand-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors">Cancel</button>
              <button type="submit" disabled={submitting} className="px-10 py-3 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Publish Note
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Semester tabs */}
      <div className="flex gap-2 flex-wrap">
        {SEMESTERS.map(s => (
          <button
            key={s}
            onClick={() => setSemester(s)}
            className={cn(
              'px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
              semester === s
                ? 'bg-brand-primary text-white shadow-md shadow-blue-200'
                : 'bg-white text-brand-text-muted border border-brand-border hover:border-brand-primary hover:text-brand-primary'
            )}
          >
            Sem {s}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by subject or topic…"
          className="w-full bg-white border border-brand-border rounded-2xl pl-12 pr-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none shadow-sm"
        />
      </div>

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <div className="p-20 text-center bg-white border border-dashed border-brand-border rounded-3xl">
          <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm text-brand-text-muted font-medium">No study materials found for Semester {semester}.</p>
          {role === 'admin' && (
            <button onClick={() => setShowForm(true)} className="mt-4 text-xs font-black text-brand-primary uppercase tracking-widest hover:underline">
              + Add the first note
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((note, i) => {
            const cfg = FILE_TYPE_CONFIG[note.fileType] || FILE_TYPE_CONFIG.PDF;
            const FileIcon = cfg.icon;
            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white border border-brand-border rounded-3xl p-6 flex flex-col gap-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="flex items-start justify-between">
                  <div className={cn('p-3 rounded-2xl border', cfg.bg, cfg.border)}>
                    <FileIcon className={cn('w-6 h-6', cfg.color)} />
                  </div>
                  <span className={cn(
                    'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border',
                    cfg.bg, cfg.color, cfg.border
                  )}>
                    {note.fileType}
                  </span>
                </div>

                <div className="flex-1 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary">{note.subject}</p>
                  <h3 className="text-[15px] font-black text-brand-text-main group-hover:text-brand-primary transition-colors leading-tight">
                    {note.topic}
                  </h3>
                  {note.description && (
                    <p className="text-xs text-brand-text-muted font-medium leading-relaxed line-clamp-2">{note.description}</p>
                  )}
                </div>

                <div className="pt-4 border-t border-brand-border flex items-center justify-between">
                  <p className="text-[10px] font-bold text-brand-text-muted">{note.uploadedBy}</p>
                  <a
                    href={note.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-md shadow-blue-200/50"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
