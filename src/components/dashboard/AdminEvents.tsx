import React, { useState, useEffect } from 'react';
import { dbService, CampusEvent } from '../../lib/db';
import {
  Plus, Calendar, MapPin, Trash2, Loader2, Clock,
  CheckCircle2, Image, Link2, List, ExternalLink
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminEvents() {
  const [events, setEvents]   = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',   // kept for compatibility; derived from bulletPoints
    bulletPoints: '',  // newline-separated bullets
    date: '',
    location: '',
    type: 'Technical',
    posterUrl: '',
    googleFormLink: '',
  });

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const data = await dbService.getEvents();
    setEvents(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.location) return;

    setIsAdding(true);
    const bullets = formData.bulletPoints
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    await dbService.addEvent({
      ...formData,
      description: bullets.join(' | '),
      bulletPoints: bullets,
      rsvps: [],
    } as any);

    setFormData({ title: '', description: '', bulletPoints: '', date: '', location: '', type: 'Technical', posterUrl: '', googleFormLink: '' });
    setShowForm(false);
    await fetchEvents();
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await dbService.deleteEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    setDeletingId(null);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Loading Event Manager...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-text-main uppercase">Upcoming Events</h2>
          <p className="text-brand-text-muted mt-2 max-w-xl text-sm font-medium">
            Schedule seminars, workshops, and sports meets. Managed events are instantly visible to all students.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-8 py-4 bg-brand-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200/50 flex items-center gap-3 transition-all"
        >
          {showForm ? <Clock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel Creation' : 'Create New Event'}
        </button>
      </header>

      {/* Event Creation Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <form onSubmit={handleSubmit} className="bg-white border border-brand-border rounded-3xl p-8 shadow-sm">
              <h3 className="text-xs font-black text-brand-text-muted uppercase tracking-widest border-b border-brand-border pb-4 mb-6">
                New Event Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Title */}
                <div className="lg:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Event Title *</label>
                  <input
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Google I/O Extended"
                    className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                  />
                </div>

                {/* Type */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Type / Category</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all appearance-none"
                  >
                    {['Technical', 'Sports', 'Career', 'Cultural', 'Social'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                  />
                </div>

                {/* Venue */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Venue *</label>
                  <input
                    required
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Hall A / Lab 302"
                    className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                  />
                </div>

                {/* Poster URL */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1 flex items-center gap-2">
                    <Image className="w-3 h-3" /> Poster Image URL
                  </label>
                  <input
                    value={formData.posterUrl}
                    onChange={e => setFormData({ ...formData, posterUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                  />
                </div>

                {/* Google Form Link */}
                <div className="lg:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1 flex items-center gap-2">
                    <Link2 className="w-3 h-3" /> Google Form Registration Link
                  </label>
                  <input
                    value={formData.googleFormLink}
                    onChange={e => setFormData({ ...formData, googleFormLink: e.target.value })}
                    placeholder="https://forms.gle/..."
                    className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                  />
                </div>

                {/* Bullet-point description */}
                <div className="lg:col-span-3 space-y-2">
                  <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1 flex items-center gap-2">
                    <List className="w-3 h-3" /> Event Highlights (one point per line — each line becomes a bullet)
                  </label>
                  <textarea
                    value={formData.bulletPoints}
                    onChange={e => setFormData({ ...formData, bulletPoints: e.target.value })}
                    placeholder={"Workshop by Google engineers\nHackathon with ₹50,000 prize\nNetworking session with alumni"}
                    rows={4}
                    className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all resize-none"
                  />
                  <p className="text-[10px] text-brand-text-muted px-1">Each line = one bullet point shown to students.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-8 py-3 bg-slate-50 border border-brand-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-12 py-3 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Publish Live
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events Grid */}
      {events.length === 0 ? (
        <div className="p-20 text-center bg-white border border-dashed border-brand-border rounded-3xl">
          <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm text-brand-text-muted font-medium">No campus events have been scheduled yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {events.map(event => {
            const bullets: string[] = (event as any).bulletPoints
              ? (event as any).bulletPoints
              : event.description
                ? event.description.split(' | ').filter(Boolean)
                : [];

            return (
              <motion.div
                layout
                key={event.id}
                className="bg-white border border-brand-border rounded-3xl overflow-hidden group hover:shadow-xl transition-all"
              >
                {/* Poster */}
                {(event as any).posterUrl ? (
                  <img
                    src={(event as any).posterUrl}
                    alt={event.title}
                    className="w-full h-40 object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="h-40 bg-slate-50 flex items-center justify-center border-b border-brand-border">
                    <Calendar className="w-14 h-14 text-slate-200 group-hover:scale-110 transition-all duration-300" />
                  </div>
                )}

                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary">{event.type}</span>
                      <h4 className="text-[15px] font-black text-brand-text-main group-hover:text-brand-primary transition-colors">{event.title}</h4>
                    </div>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="p-2 text-slate-300 hover:text-brand-emergency hover:bg-red-50 rounded-xl transition-all flex-shrink-0"
                    >
                      {deletingId === event.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Bullet points */}
                  {bullets.length > 0 && (
                    <ul className="space-y-1">
                      {bullets.slice(0, 3).map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-brand-text-muted font-medium">
                          <span className="text-brand-primary mt-0.5 flex-shrink-0">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                      {bullets.length > 3 && (
                        <li className="text-[10px] text-brand-text-muted font-bold pl-4">+{bullets.length - 3} more highlights</li>
                      )}
                    </ul>
                  )}

                  <div className="pt-3 border-t border-brand-border space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-brand-text-muted">
                        <MapPin className="w-3.5 h-3.5" />
                        {event.location}
                      </div>
                      <div className="text-[10px] font-bold text-brand-primary bg-blue-50 px-2 py-1 rounded uppercase tracking-tighter">
                        {event.date}
                      </div>
                    </div>
                    {(event as any).googleFormLink && (
                      <a
                        href={(event as any).googleFormLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[10px] font-bold text-accent-green hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Registration Form Linked
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
