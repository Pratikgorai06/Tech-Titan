import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { dbService, CampusEvent, MOCK_STUDENT_ID } from '../../lib/db';
import {
  Calendar, MapPin, Loader2, Clock, X, CheckCircle2,
  ExternalLink, ChevronRight, ArrowLeft, AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';

type Step = 'list' | 'detail' | 'terms';

export default function EventsView() {
  const [events, setEvents]         = useState<CampusEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<'All' | 'My RSVPs'>('All');
  const [selectedEvent, setSelectedEvent] = useState<CampusEvent | null>(null);
  const [step, setStep]             = useState<Step>('list');
  const [termsChecked, setTermsChecked] = useState(false);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    const data = await dbService.getEvents();
    if (data.length === 0) {
      setEvents([
        {
          id: '1',
          title: 'Tech Symposium 2026',
          description: 'Workshop by industry leaders | Hackathon with ₹50,000 prize | Guest lecture by Google engineers | Networking with 50+ companies',
          date: '2026-10-12',
          location: 'Main Auditorium',
          type: 'Technical',
          rsvps: [],
          posterUrl: undefined,
          googleFormLink: 'https://forms.gle/example1',
        },
        {
          id: '2',
          title: 'Google Placement Talk',
          description: 'SDE interview strategies | Resume screening tips | Career in cloud computing | How to crack FAANG',
          date: '2026-10-15',
          location: 'Seminar Hall B',
          type: 'Career',
          rsvps: [],
          posterUrl: undefined,
          googleFormLink: 'https://forms.gle/example2',
        },
        {
          id: '3',
          title: 'Campus Marathon',
          description: 'Morning 5K run for charity | T-shirt for all finishers | Medals for top 10 | Breakfast included',
          date: '2026-10-20',
          location: 'Circular Road',
          type: 'Sports',
          rsvps: [],
          posterUrl: undefined,
          googleFormLink: '',
        },
      ] as any[]);
    } else {
      setEvents(data);
    }
    setLoading(false);
  };

  const openDetail = (event: CampusEvent) => {
    setSelectedEvent(event);
    setStep('detail');
    setTermsChecked(false);
  };

  const closeDetail = () => {
    setSelectedEvent(null);
    setStep('list');
    setTermsChecked(false);
  };

  const handleParticipate = () => {
    setStep('terms');
  };

  const handleConfirmWithTerms = () => {
    if (!termsChecked || !selectedEvent) return;
    const formLink = (selectedEvent as any).googleFormLink;
    if (formLink) {
      window.open(formLink, '_blank', 'noopener,noreferrer');
    }
    closeDetail();
  };

  const getBullets = (event: CampusEvent): string[] => {
    const bp = (event as any).bulletPoints;
    if (Array.isArray(bp) && bp.length > 0) return bp;
    if (event.description) return event.description.split(' | ').filter(Boolean);
    return [];
  };

  const filteredEvents = events.filter(e =>
    filter === 'All' || e.rsvps.includes(MOCK_STUDENT_ID)
  );

  if (loading) return (
    <div className="flex justify-center p-20">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-brand-text-main">Campus Events</h2>
          <p className="text-brand-text-muted mt-2 max-w-xl">
            Never miss an update. Stay connected with seminars, fests, and placement drives.
          </p>
        </div>
        <div className="flex bg-white border border-brand-border rounded-xl p-1 gap-1 shadow-sm">
          {(['All', 'My RSVPs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-tight',
                filter === t ? 'bg-brand-primary text-white shadow-md shadow-blue-200' : 'text-brand-text-muted hover:bg-slate-50'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* Event Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredEvents.map(event => {
          const bullets = getBullets(event);
          const hasForm = !!(event as any).googleFormLink;
          return (
            <motion.div
              layout
              key={event.id}
              onClick={() => openDetail(event)}
              className="bg-white border border-brand-border rounded-3xl overflow-hidden flex flex-col group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              {/* Poster or placeholder */}
              {(event as any).posterUrl ? (
                <img
                  src={(event as any).posterUrl}
                  alt={event.title}
                  className="w-full h-44 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="h-44 bg-slate-50 relative overflow-hidden flex items-center justify-center border-b border-brand-border">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Calendar className="w-16 h-16 text-slate-200 group-hover:scale-110 transition-all duration-500" />
                  <div className="absolute top-4 left-4">
                    <div className="px-3 py-1 bg-white border border-brand-border rounded-full text-[9px] font-black uppercase tracking-widest text-brand-primary shadow-sm">
                      {event.type}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col space-y-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary">{event.type}</span>
                  <h3 className="text-lg font-bold text-brand-text-main group-hover:text-brand-primary transition-colors leading-tight">
                    {event.title}
                  </h3>
                  {bullets.length > 0 && (
                    <p className="text-xs text-brand-text-muted line-clamp-2 leading-relaxed font-medium">
                      {bullets[0]}
                    </p>
                  )}
                </div>

                <div className="space-y-2 text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-brand-primary" />
                    <span>{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-brand-primary" />
                    <span>{event.location}</span>
                  </div>
                </div>

                <div className="mt-auto pt-2 flex items-center justify-between border-t border-brand-border">
                  <span className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">
                    {hasForm ? '📋 Registration open' : 'No registration needed'}
                  </span>
                  <div className="flex items-center gap-1 text-brand-primary text-[11px] font-black">
                    View Details <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredEvents.length === 0 && (
        <div className="p-20 text-center bg-white border border-brand-border rounded-3xl">
          <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm text-brand-text-muted italic">No events found matching your filter.</p>
        </div>
      )}

      {/* Detail / Terms Overlay */}
      <AnimatePresence>
        {selectedEvent && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={closeDetail}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto"
            >
              {/* Step: event detail */}
              <AnimatePresence mode="wait">
                {step === 'detail' && (
                  <motion.div
                    key="detail"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col h-full"
                  >
                    {/* Poster */}
                    {(selectedEvent as any).posterUrl ? (
                      <div className="relative">
                        <img
                          src={(selectedEvent as any).posterUrl}
                          alt={selectedEvent.title}
                          className="w-full h-52 object-cover"
                        />
                        <button
                          onClick={closeDetail}
                          className="absolute top-4 right-4 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-32 bg-gradient-to-br from-brand-primary to-blue-700 flex items-center justify-center relative">
                        <Calendar className="w-12 h-12 text-white/30" />
                        <button
                          onClick={closeDetail}
                          className="absolute top-4 right-4 w-9 h-9 bg-white/20 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}

                    <div className="p-8 flex-1 space-y-6">
                      {/* "Yes, I am participating" — TOP of detail */}
                      {(selectedEvent as any).googleFormLink ? (
                        <button
                          onClick={handleParticipate}
                          className="w-full py-4 bg-gradient-to-r from-brand-primary to-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-blue-200/50 flex items-center justify-center gap-3 hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          Yes, I am Participating
                        </button>
                      ) : (
                        <div className="w-full py-4 bg-slate-50 border border-brand-border text-brand-text-muted rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3">
                          <AlertTriangle className="w-4 h-4" />
                          No Registration Required
                        </div>
                      )}

                      {/* Event meta */}
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">{selectedEvent.type}</span>
                        <h2 className="text-2xl font-black text-brand-text-main mt-1 leading-tight">{selectedEvent.title}</h2>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-slate-50 border border-brand-border rounded-2xl space-y-1">
                          <p className="text-[9px] font-black uppercase tracking-widest text-brand-text-muted flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> Date
                          </p>
                          <p className="text-sm font-black text-brand-text-main">{selectedEvent.date}</p>
                        </div>
                        <div className="p-4 bg-slate-50 border border-brand-border rounded-2xl space-y-1">
                          <p className="text-[9px] font-black uppercase tracking-widest text-brand-text-muted flex items-center gap-1.5">
                            <MapPin className="w-3 h-3" /> Venue
                          </p>
                          <p className="text-sm font-black text-brand-text-main">{selectedEvent.location}</p>
                        </div>
                      </div>

                      {/* Bullet points */}
                      {getBullets(selectedEvent).length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-text-muted">Event Highlights</h4>
                          <ul className="space-y-2.5">
                            {getBullets(selectedEvent).map((b, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                                </div>
                                <span className="text-sm text-brand-text-main font-medium leading-relaxed">{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {step === 'terms' && (
                  <motion.div
                    key="terms"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-8 space-y-8"
                  >
                    <button
                      onClick={() => setStep('detail')}
                      className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-brand-text-muted hover:text-brand-primary transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Event
                    </button>

                    <div className="space-y-2">
                      <div className="w-14 h-14 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center">
                        <ExternalLink className="w-6 h-6 text-brand-primary" />
                      </div>
                      <h3 className="text-2xl font-black text-brand-text-main">Terms & Conditions</h3>
                      <p className="text-sm text-brand-text-muted font-medium">
                        Please read and accept the following before registering for <strong>{selectedEvent?.title}</strong>.
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-brand-border rounded-2xl p-6 space-y-3 text-sm text-brand-text-main font-medium leading-relaxed max-h-60 overflow-y-auto">
                      <p className="font-black text-[10px] uppercase tracking-widest text-brand-text-muted">Participation Agreement</p>
                      <ul className="space-y-2.5">
                        {[
                          'I confirm my participation in this campus event and understand that my seat will be reserved.',
                          'I agree to follow all campus rules and code of conduct during the event.',
                          'I acknowledge that my registration data (name, roll number, email) will be shared with event organisers via the linked Google Form.',
                          'I understand that cancellations may not be possible once registered through the Google Form.',
                          'I agree that photos or videos from this event may be used in campus communications.',
                          'I accept that the institution is not liable for any personal loss or injury during the event.',
                        ].map((term, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className="text-brand-primary font-black mt-0.5 flex-shrink-0">{i + 1}.</span>
                            <span>{term}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div
                        onClick={() => setTermsChecked(!termsChecked)}
                        className={cn(
                          'w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer mt-0.5',
                          termsChecked ? 'bg-brand-primary border-brand-primary' : 'border-brand-border group-hover:border-brand-primary'
                        )}
                      >
                        {termsChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                      <span className="text-sm font-bold text-brand-text-main leading-snug">
                        I have read and I agree with the terms and conditions of participation.
                      </span>
                    </label>

                    <button
                      onClick={handleConfirmWithTerms}
                      disabled={!termsChecked}
                      className={cn(
                        'w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all',
                        termsChecked
                          ? 'bg-gradient-to-r from-brand-primary to-blue-600 text-white shadow-lg shadow-blue-200/50 hover:scale-[1.01] active:scale-[0.99]'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      )}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Proceed to Registration Form
                    </button>

                    <p className="text-[10px] text-center text-brand-text-muted">
                      You'll be redirected to a Google Form to complete your registration.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
