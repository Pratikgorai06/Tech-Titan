import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { dbService, CampusNotice } from '../../lib/db';
import { FileText, Image as ImageIcon, Loader2, X, Download, Clock } from 'lucide-react';

export default function NoticeView() {
  const [notices, setNotices] = useState<CampusNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<CampusNotice | null>(null);

  useEffect(() => {
    dbService.getNotices().then(data => {
      setNotices(data);
      setLoading(false);
    });
  }, []);

  const formatDate = (ts: any) => {
    if (!ts?.toDate) return 'Just now';
    return ts.toDate().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
    <div className="flex justify-center p-20">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col justify-between gap-2 border-b border-brand-border pb-6">
        <h2 className="text-3xl font-bold tracking-tight text-brand-text-main">Notice Board</h2>
        <p className="text-brand-text-muted max-w-xl">
          Official announcements, circulars, and updates from the administration.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notices.map(notice => (
          <motion.div 
            key={notice.id}
            layoutId={`notice-${notice.id}`}
            onClick={() => setSelectedNotice(notice)}
            className="bg-white border border-brand-border rounded-3xl p-6 flex flex-col gap-4 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-brand-border flex items-center justify-center shrink-0">
                {notice.fileType === 'pdf' ? <FileText className="w-6 h-6 text-red-500" /> : notice.fileType === 'img' ? <ImageIcon className="w-6 h-6 text-blue-500" /> : <FileText className="w-6 h-6 text-slate-400" />}
              </div>
              <div className="bg-slate-50 border border-brand-border px-2 py-1 flex items-center gap-1.5 rounded-lg text-[9px] font-bold text-brand-text-muted uppercase tracking-wider">
                <Clock className="w-3 h-3" />
                {formatDate(notice.createdAt)}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-bold text-lg text-brand-text-main leading-tight group-hover:text-brand-primary transition-colors line-clamp-2">{notice.title}</h3>
              <p className="text-sm text-brand-text-muted line-clamp-3 leading-relaxed">{notice.content}</p>
            </div>
          </motion.div>
        ))}
        {notices.length === 0 && (
          <div className="col-span-full p-20 text-center bg-white border border-brand-border rounded-3xl">
             <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
             <p className="text-sm text-brand-text-muted italic">There are no notices at this moment.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedNotice && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setSelectedNotice(null)}
            />
            <motion.div
              layoutId={`notice-${selectedNotice.id}`}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-2xl bg-white shadow-2xl z-50 rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-brand-border flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-brand-border flex items-center justify-center shrink-0">
                    {selectedNotice.fileType === 'pdf' ? <FileText className="w-5 h-5 text-red-500" /> : selectedNotice.fileType === 'img' ? <ImageIcon className="w-5 h-5 text-blue-500" /> : <FileText className="w-5 h-5 text-slate-400" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight text-brand-text-main line-clamp-1 pr-4">{selectedNotice.title}</h3>
                    <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest">{formatDate(selectedNotice.createdAt)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNotice(null)}
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8 flex-1">
                <div className="prose prose-sm max-w-none text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                  {selectedNotice.content}
                </div>

                {selectedNotice.fileUrl && (
                  <div className="pt-6 border-t border-brand-border">
                    {selectedNotice.fileType === 'img' ? (
                      <div className="rounded-2xl border border-brand-border overflow-hidden">
                        <img src={selectedNotice.fileUrl} alt="Notice Attachment" className="w-full object-contain" />
                      </div>
                    ) : (
                       <a href={selectedNotice.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-50 border border-brand-border rounded-xl group hover:border-blue-300 transition-colors">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
                             <FileText className="w-5 h-5" />
                           </div>
                           <div>
                             <p className="text-sm font-bold text-brand-text-main group-hover:text-blue-600">Attached Document.pdf</p>
                             <p className="text-[10px] uppercase font-bold text-brand-text-muted mt-0.5">Click to view/download</p>
                           </div>
                         </div>
                         <Download className="w-5 h-5 text-brand-text-muted group-hover:text-blue-600 transition-colors" />
                       </a>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
