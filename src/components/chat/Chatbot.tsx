import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Send, X, Bot, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { dbService, MOCK_STUDENT_ID, UserProfile, CampusEvent, FeeRecord, Complaint, CampusNotice } from '../../lib/db';
import { useAuth } from '../../contexts/AuthContext';

interface StudentContext {
  profile: UserProfile | null;
  events: CampusEvent[];
  fees: FeeRecord[];
  complaints: Complaint[];
  notices: CampusNotice[];
}

function buildSystemPrompt(ctx: StudentContext): string {
  const { profile, events, fees, complaints, notices } = ctx;

  const feesPending = fees.filter(f => f.status === 'pending');
  const feesTotalDue = feesPending.reduce((s, f) => s + f.amount, 0);
  const upcomingEvents = events.slice(0, 5);
  const openComplaints = complaints.filter(c => c.status !== 'resolved');
  const latestNotices = notices.slice(0, 3);

  return `
You are the Campus Mate AI Assistant — a smart, personalised academic companion for this student.

=== STUDENT PROFILE ===
Name: ${profile?.name || 'Student'}
Email: ${profile?.email || 'N/A'}
Department: ${profile?.department || 'Not set'}
Academic Year: ${profile?.academicYear || 'Not set'}
Batch: ${profile?.batch || 'Not set'}
GPA: ${profile?.gpa ?? 'N/A'}
Total Attendance Sessions: ${profile?.totalAttendance ?? 0}

=== FEES ===
${feesPending.length === 0
  ? 'No pending fees. All dues are clear!'
  : `Pending dues: ₹${feesTotalDue.toLocaleString('en-IN')} across ${feesPending.length} item(s).\n` +
    feesPending.map(f => `  - ${f.description}: ₹${f.amount} (due ${f.dueDate})`).join('\n')
}

=== UPCOMING EVENTS ===
${upcomingEvents.length === 0
  ? 'No upcoming events on record.'
  : upcomingEvents.map(e => `  - ${e.title} on ${e.date} at ${e.location}`).join('\n')
}

=== COMPLAINTS ===
${openComplaints.length === 0
  ? 'No open complaints.'
  : openComplaints.map(c => `  - [${c.status.toUpperCase()}] ${c.subject}`).join('\n')
}

=== LATEST NOTICES ===
${latestNotices.length === 0
  ? 'No recent notices.'
  : latestNotices.map(n => `  - ${n.title}: ${n.content?.slice(0, 120)}…`).join('\n')
}

=== AVAILABLE MODULES ===
1. Dashboard – GPA & Attendance overview
2. Attendance – Geofenced check-in
3. Events – Campus calendar & RSVP
4. Notice Board – Official announcements
5. Notes – Personal study notes
6. Complaints – Raise & track grievances
7. Career Hub – Jobs & internships
8. Fees – View dues and payments
9. Campus Chat – Talk with peers

=== BEHAVIOUR RULES ===
- Address the student by their name (${profile?.name || 'Student'}).
- Use the real data above when answering questions about fees, events, complaints, or attendance.
- Be concise, warm, and encouraging.
- If asked about something outside your data, advise visiting the relevant module or raising a complaint.
- Respond in markdown when helpful (bullet points, bold).
`.trim();
}

export default function Chatbot() {
  const { user: authUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ctx, setCtx] = useState<StudentContext>({ profile: null, events: [], fees: [], complaints: [], notices: [] });
  const [ctxLoading, setCtxLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load personalised context from Firebase once
  useEffect(() => {
    async function load() {
      try {
        const [profile, events, fees, complaints, notices] = await Promise.all([
          dbService.getUser(MOCK_STUDENT_ID),
          dbService.getEvents(),
          dbService.getFees(MOCK_STUDENT_ID),
          dbService.getComplaints(MOCK_STUDENT_ID),
          dbService.getNotices(),
        ]);
        setCtx({ profile, events, fees, complaints, notices });
      } catch (e) {
        console.warn('[Chatbot] Could not load context:', e);
      } finally {
        setCtxLoading(false);
      }
    }
    load();
  }, [authUser]);

  // Set greeting using real name once context loads
  useEffect(() => {
    if (!ctxLoading && messages.length === 0) {
      const name = ctx.profile?.name || authUser?.displayName || 'there';
      setMessages([{
        role: 'ai',
        content: `Hi **${name}**! 👋 I'm your Campus Mate AI. I can see your profile, fees, events, and more. What can I help you with today?`
      }]);
    }
  }, [ctxLoading]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const historyForApi = messages
        .slice(1)
        .filter((_, i, arr) => i === 0 || arr[i - 1].role !== messages[i]?.role) // prevent consecutive same-role
        .map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.content }] }));

      // Ensure history always starts with user turn
      const trimmedHistory = historyForApi[0]?.role === 'user' ? historyForApi : historyForApi.slice(1);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...trimmedHistory, { role: 'user', parts: [{ text: userMessage }] }],
        config: {
          systemInstruction: buildSystemPrompt(ctx),
        },
      });

      setMessages(prev => [...prev, { role: 'ai', content: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'ai', content: 'There was an error connecting to my AI core. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="mb-4 w-[360px] h-[520px] bg-white rounded-2xl shadow-2xl border border-brand-border overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-brand-primary to-blue-600 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">AI Assistant</p>
                  <p className="text-[10px] text-white/70 mt-0.5">
                    {ctxLoading ? 'Loading your profile…' : `Hi, ${ctx.profile?.name || 'Student'}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {ctxLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-brand-text-muted">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                  <p className="text-xs font-medium">Loading your data…</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {msg.role === 'ai' && (
                      <div className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      'max-w-[80%] px-3 py-2.5 rounded-2xl text-[12px] leading-relaxed shadow-sm',
                      msg.role === 'user'
                        ? 'bg-brand-primary text-white rounded-tr-sm'
                        : 'bg-white border border-brand-border text-brand-text-main rounded-tl-sm'
                    )}>
                      {/* Simple markdown-like renderer */}
                      {msg.content.split('\n').map((line, i) => {
                        const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                        return <p key={i} className={line.startsWith('- ') ? 'ml-2' : ''} dangerouslySetInnerHTML={{ __html: bold }} />;
                      })}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-white border border-brand-border rounded-2xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-brand-border flex gap-2 flex-shrink-0">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder={ctxLoading ? 'Loading…' : 'Ask me anything…'}
                disabled={ctxLoading}
                className="flex-1 bg-slate-50 border border-brand-border rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-brand-primary/20 transition-all outline-none disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || ctxLoading}
                className="p-2 bg-brand-primary text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB trigger */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gradient-to-br from-brand-primary to-blue-600 text-white rounded-full shadow-lg flex items-center justify-center relative"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div key="sparkle" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <Sparkles className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
        {!ctxLoading && !isOpen && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
        )}
      </motion.button>
    </div>
  );
}
