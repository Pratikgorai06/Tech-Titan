import { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../../lib/db';
import { chatDb, DirectChannel, getUserColor, getInitials } from '../../lib/chatDb';
import { cn } from '../../lib/utils';
import { User } from 'lucide-react';

interface DMSidebarProps {
  currentUserId: string;
  activeDmId: string;
  onSelectDm: (dmId: string, otherUser: UserProfile) => void;
  unreadIds?: string[];
}

export function DMSidebar({ currentUserId, activeDmId, onSelectDm, unreadIds = [] }: DMSidebarProps) {
  const [dms, setDms] = useState<{ channel: DirectChannel; otherUser: UserProfile | null }[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const users = await dbService.getAllUsers();
      setAllUsers(users.filter(u => u.uid !== currentUserId));
      const myDms = await chatDb.getDirectChannels(currentUserId);
      
      const mapped = myDms.map(ch => {
        const otherId = ch.participants.find(p => p !== currentUserId);
        const otherUser = users.find(u => u.uid === otherId) || null;
        return { channel: ch, otherUser };
      });
      setDms(mapped);
    })();
  }, [currentUserId]);

  const handleStartDm = async (user: UserProfile) => {
    const channel = await chatDb.createOrGetDirectChannel(currentUserId, user.uid);
    onSelectDm(channel.id, user);
    
    // Check if we need to add to local dms state
    if (!dms.find(d => d.channel.id === channel.id)) {
      setDms(prev => [{ channel, otherUser: user }, ...prev]);
    }
  };

  // Mock deterministic online status
  const isOnline = (uid: string) => {
    const hash = uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % 3 !== 0; // ~66% online
  };

  const filteredUsers = search 
    ? allUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-brand-border w-full flex-shrink-0">
      <div className="px-5 py-5 border-b border-brand-border">
        <div className="relative">
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Find or start a conversation"
            className="w-full bg-white border border-brand-border rounded-md px-3 py-1.5 text-xs text-brand-text-main placeholder:text-brand-text-muted focus:outline-none focus:border-brand-primary/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin">
        {search ? (
          <div className="px-2">
            <p className="px-3 mb-2 text-[10px] font-black uppercase text-brand-text-muted">Users</p>
            {filteredUsers.map(u => (
              <button 
                key={u.uid}
                onClick={() => { handleStartDm(u); setSearch(''); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: getUserColor(u.uid) }}>{getInitials(u.name)}</div>
                <span className="text-sm font-medium text-brand-text-main">{u.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-2">
             <p className="px-3 py-2 mb-1 flex items-center gap-2 text-sm font-medium text-brand-text-main hover:bg-slate-100 rounded-md cursor-pointer"><User className="w-4 h-4"/> Friends</p>
             <p className="px-3 mt-4 mb-2 text-[10px] font-black uppercase tracking-widest text-brand-text-muted hover:text-brand-text-main">Direct Messages</p>
             {dms.map(dm => {
               if (!dm.otherUser) return null;
               const isActive = dm.channel.id === activeDmId;
               return (
                 <button 
                   key={dm.channel.id}
                   onClick={() => onSelectDm(dm.channel.id, dm.otherUser!)}
                   className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors relative", isActive ? "bg-blue-50" : "hover:bg-slate-100")}
                 >
                    {/* Unread indicator */}
                    {!isActive && unreadIds.includes(dm.channel.id) && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    )}
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: getUserColor(dm.otherUser.uid) }}>
                        {getInitials(dm.otherUser.name)}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-slate-50 rounded-full flex items-center justify-center">
                        <div className={cn("w-2 h-2 rounded-full", isOnline(dm.otherUser.uid) ? "bg-emerald-500" : "bg-slate-300")} />
                      </div>
                    </div>
                    <span className={cn("text-sm truncate", isActive ? "text-blue-700 font-semibold" : isOnline(dm.otherUser.uid) ? "text-brand-text-main font-medium" : "text-brand-text-muted font-medium")}>{dm.otherUser.name}</span>
                 </button>
               )
             })}
          </div>
        )}
      </div>
    </div>
  );
}
