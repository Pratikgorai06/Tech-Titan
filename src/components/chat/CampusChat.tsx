import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Hash, Bell, BellOff, Search, Users, Plus, AtSign, Smile,
  Send, Reply, X, Loader2, Crown, ChevronDown, ChevronRight,
  WifiOff, Menu as MenuIcon, MessageCircle, MessageSquare, Trash2, Edit2, Check,
  Image as ImageIcon, SmilePlus
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  chatDb,
  ChatChannel,
  ChatMessage,
  SpaceId,
  getUserColor,
  getInitials,
  ReplyRef,
  DirectChannel,
  TypingStatus
} from '../../lib/chatDb';
import { useAuth } from '../../contexts/AuthContext';
import { dbService, UserProfile } from '../../lib/db';

import { MemberList } from './MemberList';

type ViewMode = 'campus' | 'dms';

// ─── Constants ────────────────────────────────────────────────────────────────

const SPACE_ORDER: SpaceId[] = ['technical', 'cultural', 'council', 'discussions'];

const SPACE_META: Record<SpaceId, { icon: string; label: string; color: string; bg: string }> = {
  technical: { icon: '🚀', label: 'Technical Societies',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  cultural:  { icon: '🎭', label: 'Cultural Societies',   color: '#ec4899', bg: 'rgba(236,72,153,0.1)'  },
  council:   { icon: '🏛️', label: 'Councils',             color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)'  },
  discussions:{icon: '💬', label: 'Discussions',          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
};

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '👏', '💯', '🙏'];

// ─── LocalStorage Helpers ──────────────────────────────────────────────────────

type NotifPref = 'all' | 'mentions' | 'muted';

function getNotifPref(channelId: string): NotifPref {
  try { return (localStorage.getItem(`notif_${channelId}`) as NotifPref) || 'all'; }
  catch { return 'all'; }
}

function saveNotifPref(channelId: string, p: NotifPref): void {
  try { localStorage.setItem(`notif_${channelId}`, p); } catch { /* noop */ }
}

function loadJoinedChannels(): string[] {
  try { return JSON.parse(localStorage.getItem('joinedChannels') || '[]'); }
  catch { return []; }
}

function saveJoinedChannels(ids: string[]): void {
  try { localStorage.setItem('joinedChannels', JSON.stringify(ids)); } catch { /* noop */ }
}

// ─── Time Helpers ──────────────────────────────────────────────────────────────

function formatTime(ts: any): string {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─── Rich Text Formatting ──────────────────────────────────────────────────────

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const isImageLink = (url: string) => /\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(url);

function parseContent(text: string, highlight?: string) {
  const parts = text.split(URL_REGEX);
  const images: string[] = [];
  const elements = parts.map((part, i) => {
    if (part.match(URL_REGEX)) {
      if (isImageLink(part)) images.push(part);
      return <a key={i} href={part} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all">{part}</a>;
    }
    
    // Highlight matching search query
    if (highlight && part.toLowerCase().includes(highlight.toLowerCase())) {
      const hParts = part.split(new RegExp(`(${highlight})`, 'gi'));
      return <span key={i}>{hParts.map((hp, j) => hp.toLowerCase() === highlight.toLowerCase() ? <mark key={j} className="bg-yellow-200 text-brand-text-main rounded-sm px-0.5">{hp}</mark> : hp)}</span>;
    }

    return <span key={i}>{part}</span>;
  });
  return { elements, images };
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface MsgBubbleProps {
  key?: React.Key | null;
  msg: ChatMessage;
  prevMsg?: ChatMessage;
  onReply: (msg: ChatMessage) => void;
  onReact: (msgId: string, emoji: string) => void;
  onEdit: (msgId: string, newContent: string) => void;
  onDelete: (msgId: string) => void;
  onPin: (msg: ChatMessage) => void;
  currentUserId: string;
  isAdmin: boolean;
  searchQuery?: string;
  onJump?: (msgId: string) => void;
}

function MessageBubble({ msg, prevMsg, onReply, onReact, onEdit, onDelete, onPin, currentUserId, isAdmin, searchQuery, onJump }: MsgBubbleProps) {
  const [hovering, setHovering] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content);

  // Group consecutive messages from same sender within 5 minutes
  const isContinuation =
    prevMsg?.senderId === msg.senderId &&
    !!msg.createdAt?.toMillis &&
    !!prevMsg?.createdAt?.toMillis &&
    msg.createdAt.toMillis() - prevMsg.createdAt.toMillis() < 5 * 60 * 1000;

  const hasReactions = Object.values(msg.reactions || {}).some(u => u.length > 0);
  
  // Mention logic: assuming currentName is provided or we fetch from context
  const { user } = useAuth();
  const currentName = user?.displayName || '';
  const isMentioned = currentName && (msg.content.includes(`@${currentName}`) || msg.content.includes(currentName)) && msg.senderId !== currentUserId;

  const isMine = msg.senderId === currentUserId;

  return (
    <div
      id={`msg-${msg.id}`}
      className={cn(
        'group/msg relative flex gap-3 px-6 transition-all duration-100',
        isContinuation ? 'py-0.5' : 'pt-3 pb-0.5 mt-2',
        isMine ? 'flex-row-reverse' : 'flex-row',
        msg.isPinned && "bg-yellow-50/30"
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setShowEmojiPicker(false); }}
    >
      {/* Avatar */}
      <div className="w-8 flex-shrink-0 flex justify-center items-end pb-1">
        {!isContinuation && !isMine && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
            style={{ backgroundColor: msg.senderColor }}
          >
            {msg.senderInitials}
          </div>
        )}
      </div>

      {/* Content wrapper */}
      <div className={cn('flex flex-col min-w-0 max-w-[80%]', isMine ? 'items-end' : 'items-start')}>
        {/* Name and time (only show for others if not continuation) */}
        {!isContinuation && !isMine && (
          <div className="flex items-baseline gap-2 mb-1 px-1">
            <span className="text-xs font-semibold text-brand-text-main">
              {msg.senderName}
            </span>
            {isAdmin && (
               <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold bg-blue-50 text-blue-600 uppercase tracking-wider">
                 <Crown className="w-2 h-2" /> Admin
               </span>
            )}
            <span className="text-[10px] text-brand-text-muted">{formatTime(msg.createdAt)}</span>
          </div>
        )}

        {/* Time for mine (only if not continuation) */}
        {!isContinuation && isMine && (
          <div className="flex items-baseline gap-2 mb-1 px-1">
            <span className="text-[10px] text-brand-text-muted">{formatTime(msg.createdAt)}</span>
          </div>
        )}

        {/* Reply reference */}
        {msg.replyTo && (
          <button 
            onClick={() => onJump && onJump(msg.replyTo!.messageId)}
            className={cn("flex items-center gap-1.5 mb-1 text-[11px] opacity-70 line-clamp-1 max-w-full px-2 hover:opacity-100 transition-opacity", isMine ? "justify-end text-brand-text-muted" : "justify-start text-brand-text-muted")}
          >
            <Reply className="w-3 h-3 flex-shrink-0" />
            <span className="font-semibold">{msg.replyTo.senderName}:</span>
            <span className="truncate">{msg.replyTo.preview}</span>
          </button>
        )}

        {isEditing ? (
           <div className="mt-1 flex items-center gap-2 bg-white rounded-2xl shadow-sm border border-brand-border p-1 w-full relative z-10">
             <input
               autoFocus
               value={editValue}
               onChange={e => setEditValue(e.target.value)}
               onKeyDown={e => {
                 if (e.key === 'Escape') setIsEditing(false);
                 if (e.key === 'Enter' && editValue.trim() !== msg.content) {
                   onEdit(msg.id, editValue.trim());
                   setIsEditing(false);
                 }
               }}
               className="flex-1 bg-transparent px-2 py-1 text-sm text-brand-text-main focus:outline-none min-w-[200px]"
             />
             <button onClick={() => setIsEditing(false)} className="p-1.5 text-brand-text-muted hover:bg-slate-100 rounded-full"><X className="w-3.5 h-3.5"/></button>
             <button onClick={() => { if(editValue.trim() !== msg.content) { onEdit(msg.id, editValue.trim()); setIsEditing(false); } }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-full"><Check className="w-3.5 h-3.5"/></button>
           </div>
        ) : (
          <div className={cn(
            "relative px-4 py-2.5 text-[14.5px] leading-[1.4] break-words whitespace-pre-wrap shadow-sm",
            isMine 
              ? "bg-brand-primary text-white" 
              : "bg-white border border-brand-border text-brand-text-main",
            // Bubble tail logic
            isMine
              ? isContinuation ? "rounded-2xl" : "rounded-2xl rounded-tr-sm"
              : isContinuation ? "rounded-2xl" : "rounded-2xl rounded-tl-sm",
            isMentioned && !isMine && "bg-yellow-50 border-yellow-200"
          )}>
            {parseContent(msg.content, searchQuery).elements}
            {msg.isEdited && <span className="text-[10px] opacity-60 ml-2 inline-block">(edited)</span>}
            
            {parseContent(msg.content).images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {parseContent(msg.content, searchQuery).images.map((img, i) => (
                  <img key={i} src={img} alt="Attachment" className="max-w-[240px] max-h-48 rounded-xl object-cover border border-black/10" loading="lazy" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reactions */}
        {hasReactions && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isMine ? "justify-end" : "justify-start")}>
            {Object.entries(msg.reactions).map(([emoji, users]) => {
              if (!users.length) return null;
              const reacted = users.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(msg.id, emoji)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all duration-200 font-semibold',
                    reacted
                      ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm z-10'
                      : 'bg-white border-brand-border text-brand-text-muted hover:bg-slate-50 hover:text-brand-text-main'
                  )}
                >
                  {emoji} <span className="text-[9px] opacity-80">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover action bar */}
      <AnimatePresence>
        {hovering && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 2 }}
            transition={{ duration: 0.1 }}
            className={cn("absolute -top-6 flex items-center bg-white border border-brand-border rounded-full shadow-lg z-20 overflow-hidden", isMine ? "left-4" : "right-4")}
          >
            {/* Emoji quick-pick */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(v => !v)}
                className="p-2 text-brand-text-muted hover:text-brand-text-main hover:bg-slate-50 transition-colors"
                title="React"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute bottom-full right-0 mb-1 flex gap-1 bg-white border border-brand-border rounded-xl p-2 shadow-2xl"
                  >
                    {QUICK_EMOJIS.map(e => (
                      <button
                        key={e}
                        onClick={() => { onReact(msg.id, e); setShowEmojiPicker(false); }}
                        className="text-lg hover:scale-125 transition-transform leading-none"
                        title={e}
                      >
                        {e}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={() => onPin(msg)}
              className={cn("p-2 transition-colors border-l border-brand-border", msg.isPinned ? "text-yellow-500 bg-yellow-50 hover:bg-yellow-100" : "text-brand-text-muted hover:text-brand-text-main hover:bg-slate-50")}
              title={msg.isPinned ? "Unpin" : "Pin"}
            >
              <Crown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onReply(msg)}
              className="p-2 text-brand-text-muted hover:text-brand-text-main hover:bg-slate-50 transition-colors border-l border-brand-border"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
            {(isAdmin || msg.senderId === currentUserId) && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-brand-text-muted hover:text-brand-text-main hover:bg-slate-50 transition-colors border-l border-brand-border"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(msg.id)}
                  className="p-2 text-brand-text-muted hover:text-red-500 hover:bg-red-50 transition-colors border-l border-brand-border"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Channel Sidebar ───────────────────────────────────────────────────────────

interface ChannelSidebarProps {
  channels: ChatChannel[];
  activeChannelId: string;
  joinedIds: string[];
  notifPrefs: Record<string, NotifPref>;
  unreadIds?: string[];
  onSelect: (ch: ChatChannel) => void;
  onToggleJoin: (ch: ChatChannel) => void;
  onAddChannel: (spaceId: SpaceId) => void;
  isAdmin: boolean;
}

function ChannelSidebar({
  channels, activeChannelId, joinedIds, notifPrefs, unreadIds = [],
  onSelect, onToggleJoin, onAddChannel, isAdmin
}: ChannelSidebarProps) {
  const [collapsed, setCollapsed] = useState<Partial<Record<SpaceId, boolean>>>({});
  const { user } = useAuth();

  const grouped = SPACE_ORDER.reduce<Record<SpaceId, ChatChannel[]>>((acc, sid) => {
    acc[sid] = channels.filter(c => c.spaceId === sid);
    return acc;
  }, { technical: [], cultural: [], council: [], discussions: [] });

  const currentUserId = user?.uid ?? 'anonymous';
  const currentName   = user?.displayName ?? 'Campus User';

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full flex-shrink-0">
      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin">
        {SPACE_ORDER.map(spaceId => {
          const meta = SPACE_META[spaceId];
          const spaceChannels = grouped[spaceId];
          if (!spaceChannels.length) return null;
          const isCollapsed = !!collapsed[spaceId];

          return (
            <div key={spaceId}>
              {/* Space header */}
              <button
                onClick={() => setCollapsed(c => ({ ...c, [spaceId]: !c[spaceId] }))}
                className="w-full flex items-center gap-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-text-muted hover:text-brand-text-main transition-colors"
              >
                {isCollapsed
                  ? <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  : <ChevronDown className="w-3 h-3 flex-shrink-0" />}
                <span>{meta.icon} {meta.label}</span>
                {isAdmin && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onAddChannel(spaceId); }}
                    className="ml-auto p-1 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <Plus className="w-3 h-3 text-brand-text-main" />
                  </button>
                )}
              </button>

              {/* Channels */}
              {!isCollapsed && spaceChannels.map(ch => {
                const isActive  = ch.id === activeChannelId;
                const isMuted   = notifPrefs[ch.id] === 'muted';
                const isJoined  = !ch.isJoinable || joinedIds.includes(ch.id);

                return (
                  <button
                    key={ch.id}
                    onClick={() => isJoined ? onSelect(ch) : onToggleJoin(ch)}
                    title={ch.description}
                    className={cn(
                      'w-full flex items-center gap-2 pl-5 pr-3 py-1.5 mx-1 rounded-md transition-all text-left relative',
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-bold shadow-sm'
                        : isMuted
                          ? 'text-brand-text-muted/50 hover:text-brand-text-muted hover:bg-slate-100'
                          : unreadIds.includes(ch.id)
                            ? 'text-brand-text-main hover:bg-slate-100 font-bold'
                            : 'text-brand-text-muted hover:text-brand-text-main hover:bg-slate-100',
                    )}
                    style={{ width: 'calc(100% - 8px)' }}
                  >
                    {/* Unread indicator */}
                    {!isActive && unreadIds.includes(ch.id) && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    )}
                    <Hash
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{ color: isActive ? meta.color : undefined }}
                    />
                    <span className={cn(
                      'flex-1 text-[12px] truncate',
                      isMuted && 'line-through opacity-40',
                    )}>
                      {ch.name}
                    </span>
                    {ch.isOfficial && (
                      <span className="text-[10px] opacity-50" title="Admin-only">🔒</span>
                    )}
                    {ch.isJoinable && !isJoined && (
                      <Plus className="w-3 h-3 opacity-40" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* User footer */}
      <div className="px-4 py-3 border-t border-brand-border flex items-center gap-3 bg-white">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0 shadow-md ring-2 ring-slate-100"
          style={{ backgroundColor: getUserColor(currentUserId) }}
        >
          {getInitials(currentName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-brand-text-main truncate">{currentName}</p>
          <p className="text-[10px] text-brand-text-muted truncate">{currentUserId}</p>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
      </div>
    </div>
  );
}

// ─── Message Input ─────────────────────────────────────────────────────────────

interface MessageInputProps {
  channelName: string;
  isOfficial: boolean;
  isAdmin: boolean;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  onSend: (content: string) => Promise<void>;
  onTyping?: () => void;
}

function MessageInput({
  channelName, isOfficial, isAdmin, replyTo, onClearReply, onSend, onTyping
}: MessageInputProps) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canPost = !isOfficial || isAdmin;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [value]);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending || !canPost) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setValue('');
      onClearReply();
    } finally {
      setSending(false);
    }
  };

  if (!canPost) {
    return (
      <div className="px-4 pb-6 pt-2 flex-shrink-0 bg-transparent">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3 bg-slate-50/80 backdrop-blur-md rounded-2xl border border-brand-border shadow-sm">
          <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-brand-text-muted">Only administrators can post in this channel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-2 flex-shrink-0 relative z-20">
      {/* Background gradient fade to ensure text behind input doesn't clash */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none -z-10" />

      <div className="max-w-4xl mx-auto w-full relative">
        {/* Reply preview */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full left-0 right-0 mb-3 mx-4 flex items-center gap-2 px-4 py-3 bg-white/90 backdrop-blur-md border border-brand-border rounded-xl shadow-lg shadow-black/5"
            >
              <Reply className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-brand-text-main">Replying to {replyTo.senderName}</p>
                <p className="text-xs text-brand-text-muted truncate mt-0.5">{replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? '…' : ''}</p>
              </div>
              <button
                onClick={onClearReply}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-brand-text-muted hover:text-brand-text-main transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 bg-white/80 backdrop-blur-lg border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-[28px] p-1.5 transition-all duration-300 focus-within:shadow-[0_8px_40px_rgb(0,0,0,0.12)] focus-within:border-brand-primary/30 focus-within:bg-white">
          <button 
            onClick={() => {
              const url = prompt("Enter image URL:");
              if (url) onSend(url);
            }}
            className="flex-shrink-0 flex items-center justify-center w-[36px] h-[36px] mt-1 ml-1 text-brand-text-muted hover:text-brand-primary transition-all bg-slate-50 hover:bg-blue-50 rounded-full" 
            title="Add image by URL"
          >
            <Plus className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => {
              setValue(e.target.value);
              if (onTyping) onTyping();
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${channelName ? (isOfficial ? channelName : '#' + channelName) : '...'}`}
            rows={1}
            className="flex-1 bg-transparent py-3 px-2 text-[15px] text-brand-text-main placeholder:text-brand-text-muted/70 outline-none resize-none leading-[20px] max-h-[120px]"
          />

          <div className="flex items-center gap-1 flex-shrink-0 pb-1 pr-2">
            <button onClick={() => alert("GIF picker coming soon!")} className="w-[32px] h-[32px] flex items-center justify-center rounded-full text-brand-text-muted hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors hidden sm:flex" title="Send a GIF">
              <ImageIcon className="w-4 h-4" />
            </button>
            <button onClick={() => alert("Stickers coming soon!")} className="w-[32px] h-[32px] flex items-center justify-center rounded-full text-brand-text-muted hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors hidden sm:flex" title="Stickers">
              <SmilePlus className="w-4 h-4" />
            </button>
            <button onClick={() => {
              setValue(v => v + '😊');
              textareaRef.current?.focus();
            }} className="w-[32px] h-[32px] flex items-center justify-center rounded-full text-brand-text-muted hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors" title="Emoji">
              <Smile className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={!value.trim() || sending}
            className={cn(
              'flex-shrink-0 w-[40px] h-[40px] mb-[2px] mr-[2px] flex items-center justify-center rounded-[20px] transition-all duration-300',
              value.trim() && !sending
                ? 'bg-brand-primary text-white shadow-md hover:bg-brand-primary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            {sending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4 ml-0.5" />}
          </button>
        </div>
        
        <p className="text-[10px] font-medium text-brand-text-muted/60 mt-2 text-center absolute -bottom-5 w-full">
          <span className="font-bold">Enter</span> to send · <span className="font-bold">Shift+Enter</span> for new line
        </p>
      </div>
    </div>
  );
}

// ─── Create Channel Modal ──────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreate: (ch: Omit<ChatChannel, 'id' | 'createdAt' | 'memberCount'>) => Promise<void>;
}

function CreateChannelModal({ onClose, onCreate }: CreateModalProps) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [space, setSpace] = useState<SpaceId>('discussions');
  const [isOfficial, setIsOfficial] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await onCreate({
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      description: desc.trim(),
      spaceId: space,
      spaceName: SPACE_META[space].label,
      spaceColor: SPACE_META[space].color,
      isOfficial,
      isJoinable: space !== 'discussions',
      order: 99
    });
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-brand-border overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between bg-slate-50">
          <h3 className="text-lg font-bold text-brand-text-main">Create New Channel</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5"/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-brand-text-muted mb-1.5 tracking-wider">Channel Name</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
              <input 
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. hackathon-prep"
                className="w-full bg-slate-50 border border-brand-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-brand-text-muted mb-1.5 tracking-wider">Description</label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What is this channel about?"
              rows={3}
              className="w-full bg-slate-50 border border-brand-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-brand-text-muted mb-1.5 tracking-wider">Category</label>
              <select 
                value={space}
                onChange={e => setSpace(e.target.value as SpaceId)}
                className="w-full bg-slate-50 border border-brand-border rounded-xl px-3 py-2.5 text-sm outline-none"
              >
                {SPACE_ORDER.map(sid => <option key={sid} value={sid}>{SPACE_META[sid].label}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
               <label className="block text-[10px] font-black uppercase text-brand-text-muted mb-1.5 tracking-wider">Privacy</label>
               <label className="flex items-center gap-2 py-2.5 cursor-pointer">
                 <input type="checkbox" checked={isOfficial} onChange={e => setIsOfficial(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                 <span className="text-sm text-brand-text-main">Admin-only posting</span>
               </label>
            </div>
          </div>
          <div className="pt-2 flex gap-3">
             <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-brand-border text-sm font-semibold text-brand-text-main hover:bg-slate-50 transition-colors">Cancel</button>
             <button type="submit" disabled={submitting || !name.trim()} className="flex-1 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50">
               {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Channel'}
             </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Notification Popover ──────────────────────────────────────────────────────

interface NotifPopoverProps {
  channelId: string;
  current: NotifPref;
  onChange: (p: NotifPref) => void;
  onClose: () => void;
}

function NotifPopover({ channelId, current, onChange, onClose }: NotifPopoverProps) {
  const opts: { value: NotifPref; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'all',      label: 'All Messages',   icon: <Bell className="w-4 h-4"    />, desc: 'Notify for every new message'      },
    { value: 'mentions', label: 'Mentions Only',  icon: <AtSign className="w-4 h-4"  />, desc: 'Only when you are @mentioned'      },
    { value: 'muted',    label: 'Muted',          icon: <BellOff className="w-4 h-4" />, desc: 'No notifications, channel dimmed'  },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -6 }}
      transition={{ duration: 0.12 }}
      className="absolute top-full right-0 mt-2 w-60 bg-white border border-brand-border rounded-xl shadow-lg z-50"
    >
      <div className="px-4 py-2.5 border-b border-brand-border flex items-center justify-between">
        <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest">Notifications</p>
        <button onClick={onClose} className="text-brand-text-muted/50 hover:text-brand-text-main"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="p-1.5">
        {opts.map(opt => (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); saveNotifPref(channelId, opt.value); onClose(); }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
              current === opt.value
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-brand-text-muted hover:bg-slate-50 hover:text-brand-text-main'
            )}
          >
            <span className={cn('flex-shrink-0', current === opt.value ? 'text-blue-500' : 'text-brand-text-muted/50')}>
              {opt.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-none">{opt.label}</p>
              <p className="text-[10px] opacity-55 mt-0.5">{opt.desc}</p>
            </div>
            {current === opt.value && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main CampusChat ──────────────────────────────────────────────────────────

interface CampusChatProps {
  role: 'student' | 'admin';
}

export default function CampusChat({ role }: CampusChatProps) {
  const { user } = useAuth();
  const currentUserId   = user?.uid ?? 'anonymous';
  const currentUserName = user?.displayName ?? 'Campus User';

  const [channels, setChannels]           = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [replyTo, setReplyTo]             = useState<ChatMessage | null>(null);
  const [joinedIds, setJoinedIds]         = useState<string[]>(loadJoinedChannels);
  const [notifPrefs, setNotifPrefs]       = useState<Record<string, NotifPref>>({});
  const [loading, setLoading]             = useState(true);
  const [sendError, setSendError]         = useState('');
  const [showSearch, setShowSearch]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const [view, setView]                   = useState<ViewMode>('campus');
  const [activeDm, setActiveDm]           = useState<{ id: string; user: UserProfile } | null>(null);
  const [typists, setTypists]             = useState<TypingStatus[]>([]);
  const [showMembers, setShowMembers]     = useState(true);
  const [unreadIds, setUnreadIds]         = useState<string[]>([]);

  const [lastSeen, setLastSeen]           = useState<Record<string, any>>({});
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const [showPinned, setShowPinned]       = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unsubsRef      = useRef<Array<() => void>>([]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!showPinned) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showPinned]);

  // Track last seen when selection changes
  useEffect(() => {
    const cid = view === 'campus' ? activeChannel?.id : activeDm?.id;
    if (cid && currentUserId !== 'anonymous') {
      chatDb.updateLastSeen(currentUserId, cid);
    }
  }, [activeChannel?.id, activeDm?.id, view, currentUserId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await chatDb.seedChannelsIfEmpty();
        const chs = await chatDb.getChannels();
        setChannels(chs);
        
        const first = chs.find(c => !c.isJoinable || loadJoinedChannels().includes(c.id)) ?? chs[0];
        if (first) setActiveChannel(first);

        if (currentUserId !== 'anonymous') {
          unsubsRef.current.push(chatDb.onLastSeen(currentUserId, setLastSeen));
        }
      } catch (err) {
        console.error('[CampusChat] Initial load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
    return () => unsubsRef.current.forEach(u => u());
  }, [currentUserId]);

  // ── Real-time listener ─────────────────────────────────────────────────────
  useEffect(() => {
    unsubsRef.current.forEach(u => u());
    unsubsRef.current = [];
    setMessages([]);
    setTypists([]);

    if (view === 'campus' && activeChannel) {
      unsubsRef.current.push(chatDb.onMessages(activeChannel.id, setMessages));
      unsubsRef.current.push(chatDb.onTyping(activeChannel.id, setTypists));
    } else if (view === 'dms' && activeDm) {
      unsubsRef.current.push(chatDb.onMessages(activeDm.id, setMessages));
      unsubsRef.current.push(chatDb.onTyping(activeDm.id, setTypists));
    }

    if (view === 'campus' && activeChannel) {
      setUnreadIds(prev => prev.filter(id => id !== activeChannel.id));
    } else if (view === 'dms' && activeDm) {
      setUnreadIds(prev => prev.filter(id => id !== activeDm.id));
    }
  }, [view, activeChannel?.id, activeDm?.id]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => { unsubsRef.current.forEach(u => u()); };
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectChannel = useCallback((ch: ChatChannel) => {
    setActiveChannel(ch);
    setShowMobileSidebar(false);
    setSearchQuery('');
    setShowSearch(false);
  }, []);

  const handleToggleJoin = useCallback((ch: ChatChannel) => {
    setJoinedIds(prev => {
      const isJoined = prev.includes(ch.id);
      const next = isJoined ? prev.filter(id => id !== ch.id) : [...prev, ch.id];
      saveJoinedChannels(next);
      if (!isJoined) setActiveChannel(ch);
      return next;
    });
  }, []);

  const handleSend = async (content: string) => {
    const targetId = view === 'campus' ? activeChannel?.id : activeDm?.id;
    if (!targetId) return;
    setSendError('');
    try {
      await chatDb.sendMessage(
        targetId,
        content,
        { id: currentUserId, name: currentUserName },
        replyTo
          ? { messageId: replyTo.id, senderName: replyTo.senderName, preview: replyTo.content.slice(0, 80) }
          : undefined
      );
      setReplyTo(null);
    } catch (e) {
      setSendError('Failed to send. Check your connection and try again.');
      console.error('[CampusChat] Send error:', e);
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    try { await chatDb.toggleReaction(msgId, emoji, currentUserId); }
    catch (e) { console.error('[CampusChat] Reaction error:', e); }
  };

  const handleNotifChange = (pref: NotifPref) => {
    if (!activeChannel) return;
    setNotifPrefs(prev => ({ ...prev, [activeChannel.id]: pref }));
  };

  const handleCreateChannel = async (chData: any) => {
    try {
      const id = await chatDb.createChannel(chData);
      const newCh = { id, ...chData, createdAt: new Date(), memberCount: 0 } as any;
      setChannels(prev => [...prev, newCh].sort((a,b) => (SPACE_ORDER.indexOf(a.spaceId) - SPACE_ORDER.indexOf(b.spaceId))));
      setActiveChannel(newCh);
      setShowCreateModal(false);
    } catch (e) {
      console.error('Failed to create channel:', e);
    }
  };

  // Real unread IDs calculation
  const realUnreadIds = channels
    .filter(ch => !lastSeen[ch.id])
    .map(ch => ch.id);

  const filteredMessages = searchQuery
    ? messages.filter(m =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.senderName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const spaceMeta = activeChannel ? SPACE_META[activeChannel.spaceId] : null;
  const currentNotif = activeChannel ? (notifPrefs[activeChannel.id] ?? 'all') : 'all';

  const typingText = typists.length > 0 
    ? typists.length === 1 
      ? `${typists[0].name} is typing...`
      : `${typists.map(t => t.name).join(', ')} are typing...`
    : null;

  const handleEdit = async (msgId: string, newContent: string) => { await chatDb.editMessage(msgId, newContent); };
  const handleDelete = async (msgId: string) => { await chatDb.deleteMessage(msgId); };
  const handleTogglePin = async (msg: ChatMessage) => { await chatDb.togglePin(msg.id, !msg.isPinned); };

  const handleJumpToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      el.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');
      setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2'), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center rounded-2xl bg-slate-50 border border-brand-border">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          <p className="text-sm text-brand-text-muted">Loading Campus Chat…</p>
        </div>
      </div>
    );
  }

  return (
    // flex-1 + min-h-0 makes it fill the parent flex container without overflowing
    <div className="flex flex-1 min-h-0 rounded-3xl overflow-hidden border border-brand-border shadow-sm bg-white relative">

      {/* ── Mobile sidebar backdrop ── */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* ── Combined Sidebar (Channels & DMs) ── */}
      <div className={cn(
        'fixed lg:relative inset-y-0 left-0 z-40 lg:z-auto w-[280px] h-full flex-shrink-0 transition-transform duration-300 bg-slate-50 border-r border-brand-border flex flex-col',
        showMobileSidebar ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex-1 min-h-0 overflow-hidden pt-4">
          <ChannelSidebar
            channels={channels}
            activeChannelId={activeChannel?.id ?? ''}
            joinedIds={joinedIds}
            notifPrefs={notifPrefs}
            unreadIds={realUnreadIds}
            onSelect={handleSelectChannel}
            onToggleJoin={handleToggleJoin}
            onAddChannel={(sid) => setShowCreateModal(true)}
            isAdmin={role === 'admin'}
          />
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative z-10 bg-transparent">

        {/* Top bar */}
        {(activeChannel || activeDm) && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-brand-border bg-white backdrop-blur-md flex-shrink-0 z-20">
            {/* Mobile hamburger */}
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="lg:hidden p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text-main hover:bg-slate-50 transition-colors"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

            {/* Channel identity */}
            {view === 'campus' ? (
              activeChannel ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="font-bold text-slate-800 text-[15px] truncate tracking-wide">#{activeChannel.name}</span>
                    <span className="text-[10px] text-brand-text-muted truncate max-w-[200px] sm:max-w-md">{activeChannel.description}</span>
                  </div>
                  {activeChannel.isOfficial && <span className="text-blue-500 text-xs flex-shrink-0" title="Official Channel">⭐</span>}
                </div>
              ) : null
            ) : (
              activeDm ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm" style={{ backgroundColor: getUserColor(activeDm.user.uid) }}>{getInitials(activeDm.user.name)}</div>
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="font-bold text-slate-800 text-[15px] truncate tracking-wide">@{activeDm.user.name}</span>
                    <span className="text-[10px] text-emerald-500">Active now</span>
                  </div>
                </div>
              ) : null
            )}

            {/* Actions */}
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="relative group/search flex items-center">
                 <Search className="absolute left-3 w-4 h-4 text-brand-text-muted group-focus-within/search:text-blue-500 transition-colors" />
                 <input 
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   placeholder="Search..."
                   className="w-[140px] lg:w-[180px] focus:w-[240px] bg-slate-100/50 hover:bg-slate-100 border border-transparent focus:border-blue-200 focus:bg-white rounded-full pl-9 pr-4 py-1.5 text-xs text-brand-text-main outline-none transition-all duration-300 placeholder:text-brand-text-muted/60"
                 />
              </div>

              <button 
                onClick={() => setShowPinned(!showPinned)}
                className={cn('p-2 rounded-lg transition-colors relative', showPinned ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-text-muted hover:text-brand-text-main hover:bg-slate-50')}
                title="Pinned Messages"
              >
                <Crown className="w-4 h-4" />
                {messages.filter(m => m.isPinned).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full border border-white" />
                )}
              </button>

              {view === 'campus' && activeChannel && (
                <>
                  <div className="relative">
                    <button
                      onClick={() => setShowNotifMenu(v => !v)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        currentNotif === 'muted' ? 'text-brand-text-muted/50' : 'text-brand-text-muted hover:text-brand-text-main hover:bg-slate-50'
                      )}
                      title="Notification settings"
                    >
                      {currentNotif === 'muted'
                        ? <BellOff className="w-4 h-4" />
                        : <Bell className="w-4 h-4" />}
                    </button>
                    <AnimatePresence>
                      {showNotifMenu && (
                        <NotifPopover
                          channelId={activeChannel.id}
                          current={currentNotif}
                          onChange={handleNotifChange}
                          onClose={() => setShowNotifMenu(false)}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <button 
                    onClick={() => setShowMembers(v => !v)}
                    className={cn('p-2 rounded-lg transition-colors', showMembers ? 'bg-slate-100 text-brand-text-main' : 'text-brand-text-muted hover:text-brand-text-main hover:bg-slate-50')}
                    title="Toggle Member List"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Messages area — flex-1 + min-h-0 + overflow-y-auto handles scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto py-2" id="chat-messages">
          {showPinned ? (
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-brand-text-main flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" /> Pinned Messages
                </h3>
                <button onClick={() => setShowPinned(false)} className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors">Back to Chat</button>
              </div>
              {messages.filter(m => m.isPinned).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-brand-text-muted">
                  <Crown className="w-12 h-12 opacity-10 mb-2" />
                  <p className="text-sm">No pinned messages in this channel.</p>
                </div>
              ) : (
                messages.filter(m => m.isPinned).map((msg, i, arr) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    prevMsg={arr[i-1]}
                    onReply={setReplyTo}
                    onReact={handleReact}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onPin={handleTogglePin}
                    currentUserId={currentUserId}
                    isAdmin={role === 'admin'}
                    searchQuery={searchQuery}
                    onJump={handleJumpToMessage}
                  />
                ))
              )}
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center py-12">
              {view === 'campus' && activeChannel ? (
                <>
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-sm"
                    style={{ background: spaceMeta?.bg, border: `1px solid ${spaceMeta?.color}30` }}
                  >
                    {spaceMeta?.icon}
                  </div>
                  <div>
                    <p className="text-base font-bold text-brand-text-main">
                      Welcome to #{activeChannel.name}!
                    </p>
                    <p className="text-sm text-brand-text-muted mt-1 max-w-xs">{activeChannel.description}</p>
                    {!activeChannel.isOfficial && (
                      <p className="text-xs text-brand-text-muted/60 mt-3">
                        Be the first to send a message 👋
                      </p>
                    )}
                  </div>
                </>
              ) : view === 'dms' && activeDm ? (
                <>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-sm bg-indigo-50/50 border border-indigo-200 text-indigo-500">
                    {getInitials(activeDm.user.name)}
                  </div>
                  <div>
                    <p className="text-base font-bold text-brand-text-main">
                      Welcome to your Direct Message with {activeDm.user.name}
                    </p>
                    <p className="text-xs text-brand-text-muted/60 mt-3">
                      Be the first to say hello 👋
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-brand-text-muted text-sm">Select a channel or conversation to start chatting</p>
              )}
            </div>
          ) : (
                filteredMessages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    prevMsg={filteredMessages[i - 1]}
                    onReply={setReplyTo}
                    onReact={handleReact}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onPin={handleTogglePin}
                    currentUserId={currentUserId}
                    isAdmin={role === 'admin'}
                    searchQuery={searchQuery}
                    onJump={handleJumpToMessage}
                  />
                ))
          )}

          {/* No search results */}
          {searchQuery && filteredMessages.length === 0 && messages.length > 0 && (
            <div className="flex flex-col items-center py-12 text-brand-text-muted">
              <Search className="w-7 h-7 mb-2 opacity-50" />
              <p className="text-sm">No messages match "{searchQuery}"</p>
            </div>
          )}

          {typingText && (
            <div className="px-5 py-2 mt-2 text-xs font-medium text-brand-text-muted animate-pulse flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-brand-text-muted/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-brand-text-muted/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-brand-text-muted/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              {typingText}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {sendError && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="mx-4 mb-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center gap-2 flex-shrink-0"
            >
              <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
              {sendError}
              <button
                onClick={() => setSendError('')}
                className="ml-auto text-red-300/50 hover:text-red-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message input */}
        {(activeChannel || activeDm) && (
          <MessageInput
            channelName={view === 'campus' ? activeChannel?.name || '' : activeDm?.user.name || ''}
            isOfficial={view === 'campus' ? !!activeChannel?.isOfficial : false}
            isAdmin={role === 'admin'}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            onSend={handleSend}
            onTyping={() => {
              const targetId = view === 'campus' ? activeChannel?.id : activeDm?.id;
              if (targetId) chatDb.setTyping(targetId, currentUserId, currentUserName);
            }}
          />
        )}
      </div>

      <AnimatePresence>
        {view === 'campus' && showMembers && activeChannel && (
           <MemberList channelId={activeChannel.id} />
        )}
      </AnimatePresence>
    </div>
  );
}
