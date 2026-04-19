import { useState, useEffect } from 'react';
import { Users, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { dbService, UserProfile } from '../../lib/db';
import { getUserColor, getInitials } from '../../lib/chatDb';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface MemberListProps {
  channelId: string;
}

export function MemberList({ channelId }: MemberListProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // To keep it simple, we group by Role
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const allUsers = await dbService.getAllUsers();
        setUsers(allUsers);
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [channelId]);

  const filteredUsers = search 
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase()))
    : users;

  const admins = filteredUsers.filter(u => u.role === 'admin');
  const students = filteredUsers.filter(u => u.role === 'student');

  const groups = [
    { id: 'admins', label: 'Admins', users: admins },
    { id: 'students', label: 'Students', users: students },
  ];

  // Mock deterministic online status
  const isOnline = (uid: string) => {
    const hash = uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % 3 !== 0; // ~66% online
  };

  if (loading) return (
    <div className="w-60 bg-slate-50 border-l border-brand-border flex-shrink-0 flex items-center justify-center">
      <p className="text-brand-text-muted text-sm">Loading members...</p>
    </div>
  );

  return (
    // Use framer-motion to slide in from the right
    <motion.div 
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute right-0 top-[56px] bottom-0 z-30 w-[280px] bg-white border-l border-brand-border shadow-2xl flex flex-col flex-shrink-0"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-brand-border bg-slate-50 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-brand-text-main">
            <Users className="w-4 h-4" />
            <span className="font-bold text-sm">Members</span>
          </div>
          <span className="text-[10px] text-brand-text-muted mt-0.5">#{channelId}</span>
        </div>
      </div>
      <div className="px-4 py-3 border-b border-brand-border bg-white">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted" />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members"
            className="w-full bg-white border border-brand-border rounded-md pl-8 pr-3 py-1.5 text-xs text-brand-text-main placeholder:text-brand-text-muted focus:outline-none focus:border-brand-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-4 scrollbar-thin">
        {groups.map(g => {
          if (!g.users.length) return null;
          const isCollapsed = !!collapsed[g.id];
          return (
            <div key={g.id}>
              <button 
                onClick={() => setCollapsed(p => ({ ...p, [g.id]: !p[g.id] }))}
                className="w-full flex items-center gap-1 px-4 mb-2 text-[10px] font-black uppercase tracking-widest text-brand-text-muted hover:text-brand-text-main"
              >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {g.label} — {g.users.length}
              </button>
              
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden space-y-0.5">
                    {g.users.map(u => (
                      <div key={u.uid} className="flex items-center gap-3 px-4 py-1.5 hover:bg-slate-100 cursor-pointer group transition-colors">
                        <div className="relative">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
                            style={{ backgroundColor: getUserColor(u.uid) }}
                          >
                            {getInitials(u.name)}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-slate-50 rounded-full flex items-center justify-center">
                            <div className={cn("w-2 h-2 rounded-full", isOnline(u.uid) ? "bg-emerald-500" : "bg-slate-300")} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 opacity-90">
                          <p className={cn("text-sm font-medium truncate transition-colors", isOnline(u.uid) ? "text-brand-text-main" : "text-brand-text-muted group-hover:text-brand-text-main")}>{u.name}</p>
                          <p className="text-[10px] text-brand-text-muted truncate">{u.department || 'Campus Member'}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
