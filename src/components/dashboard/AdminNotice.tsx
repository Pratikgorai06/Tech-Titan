import React, { useState, useEffect } from 'react';
import { dbService, CampusNotice } from '../../lib/db';
import { Loader2, FileText, Image as ImageIcon, Send } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminNotice() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<CampusNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState<'pdf' | 'img' | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    const data = await dbService.getNotices();
    setNotices(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    setIsSubmitting(true);
    const newNotice: Omit<CampusNotice, 'id'> = {
      title,
      content,
      fileUrl: fileUrl || undefined,
      fileType: fileType || undefined,
      createdAt: Timestamp.now(),
      createdBy: user?.uid || 'admin'
    };

    await dbService.addNotice(newNotice);
    await fetchNotices();
    setTitle('');
    setContent('');
    setFileUrl('');
    setFileType('');
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-brand-border pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-brand-text-main">Notice Board Admin</h2>
          <p className="text-brand-text-muted mt-2 max-w-xl">
            Publish circulars and official announcements to all students.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-1 border border-brand-border rounded-3xl p-6 bg-white space-y-5 h-fit">
          <h3 className="font-black uppercase tracking-widest text-xs text-brand-text-main border-b border-brand-border pb-3">New Notice</h3>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">Notice Title</label>
            <input 
              required
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full p-3 bg-slate-50 rounded-xl border border-brand-border text-sm outline-none focus:border-brand-primary"
              placeholder="e.g. End Semester Exam Guidelines"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">Content Details</label>
            <textarea 
              required
              rows={4}
              value={content} onChange={e => setContent(e.target.value)}
              className="w-full p-3 bg-slate-50 rounded-xl border border-brand-border text-sm outline-none focus:border-brand-primary resize-none"
              placeholder="Description..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">Attachment URL (Optional)</label>
            <input 
              value={fileUrl} onChange={e => setFileUrl(e.target.value)}
              className="w-full p-3 bg-slate-50 rounded-xl border border-brand-border text-sm outline-none focus:border-brand-primary font-mono"
              placeholder="https://..."
            />
          </div>

          {fileUrl && (
             <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">File Type</label>
               <div className="flex gap-2">
                 <button type="button" onClick={() => setFileType('pdf')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${fileType === 'pdf' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 border-brand-border text-slate-400'}`}><FileText className="w-4 h-4 mx-auto mb-1" /> PDF Doc</button>
                 <button type="button" onClick={() => setFileType('img')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${fileType === 'img' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 border-brand-border text-slate-400'}`}><ImageIcon className="w-4 h-4 mx-auto mb-1" /> Image</button>
               </div>
             </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-4 bg-brand-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publish Notice
          </button>
        </form>

        <div className="lg:col-span-2 space-y-4">
           {loading ? (
             <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-primary" /></div>
           ) : notices.length === 0 ? (
             <div className="p-10 border border-brand-border border-dashed rounded-3xl text-center flex flex-col items-center text-slate-400">
                <FileText className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm font-bold">No published notices</p>
             </div>
           ) : notices.map(notice => (
             <div key={notice.id} className="p-5 bg-white border border-brand-border rounded-2xl flex gap-4">
                 <div className="w-10 h-10 rounded-xl bg-slate-50 border border-brand-border flex items-center justify-center shrink-0">
                   {notice.fileType === 'pdf' ? <FileText className="w-5 h-5 text-red-500" /> : notice.fileType === 'img' ? <ImageIcon className="w-5 h-5 text-blue-500" /> : <FileText className="w-5 h-5 text-slate-400" />}
                 </div>
                 <div className="flex-1">
                   <h4 className="font-bold text-sm text-brand-text-main pr-10">{notice.title}</h4>
                   <p className="text-xs text-brand-text-muted mt-1 line-clamp-2 leading-relaxed">{notice.content}</p>
                   {notice.fileUrl && <div className="mt-2 text-[10px] font-mono text-blue-500 truncate max-w-sm">{notice.fileUrl}</div>}
                 </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
