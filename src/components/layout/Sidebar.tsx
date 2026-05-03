import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Calendar, UserCheck, MessageSquare,
  Briefcase, CreditCard, Settings, X, UserCircle,
  ShieldCheck, LogOut, MessageCircle, BookOpen,
  ClipboardList, QrCode, GraduationCap, Landmark, Users2,
  ScanFace, FileText
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserColor, getInitials } from '../../lib/chatDb';
import { Link, useLocation } from 'react-router-dom';
import { dbService, UserProfile } from '../../lib/db';
import type { AppRole } from '../../contexts/AuthContext';

const studentNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance', icon: UserCheck },
  { id: 'face-registration', label: 'Face ID', icon: ScanFace, badge: 'NEW' },
  { id: 'clubs', label: 'Clubs & Societies', icon: Users2, badge: 'NEW' },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'notices', label: 'Notice Board', icon: ClipboardList, badge: 'NEW' },
  { id: 'notes', label: 'Notes', icon: BookOpen, badge: 'NEW' },
  { id: 'chat', label: 'Campus Chat', icon: MessageCircle, badge: 'NEW' },
  { id: 'complaints', label: 'Complaints', icon: MessageSquare },
  { id: 'career', label: 'Career Hub', icon: Briefcase },
  { id: 'fees', label: 'Fees', icon: CreditCard },
];

const clubPresidentNav = [
  { id: 'dashboard', label: 'Club Dashboard', icon: Landmark },
  { id: 'events', label: 'Manage Events', icon: Calendar },
  { id: 'notice', label: 'Notice Board', icon: ClipboardList, badge: 'NEW' },
  { id: 'chat', label: 'Campus Chat', icon: MessageCircle, badge: 'NEW' },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const teacherNav = [
  { id: 'dashboard', label: 'Teacher Panel', icon: GraduationCap },
  { id: 'attendance', label: 'QR Attendance', icon: QrCode, badge: 'NEW' },
  { id: 'report', label: 'Daily Report', icon: FileText, badge: 'NEW' },
  { id: 'chat', label: 'Campus Chat', icon: MessageCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const adminNav = [
  { id: 'dashboard', label: 'Admin Panel', icon: ShieldCheck },
  { id: 'attendance', label: 'Users & Attendance', icon: UserCircle },
  { id: 'events', label: 'Manage Events', icon: Calendar },
  { id: 'complaints', label: 'Complaints Inbox', icon: MessageSquare },
  { id: 'career', label: 'Career Management', icon: Briefcase },
  { id: 'fees', label: 'Fee Management', icon: CreditCard },
  { id: 'notice', label: 'Notice Board', icon: ClipboardList, badge: 'NEW' },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'chat', label: 'Campus Chat', icon: MessageCircle, badge: 'NEW' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  role: AppRole;
}

export default function Sidebar({ isOpen, onClose, role }: SidebarProps) {
  const { user: authUser, signOut } = useAuth();
  const location = useLocation();
  const currentNav = role === 'admin' ? adminNav : role === 'teacher' ? teacherNav : role === 'club_president' ? clubPresidentNav : studentNav;

  const [dbUser, setDbUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!authUser) return;
    const unsubscribe = dbService.subscribeUser(authUser.uid, (u) => setDbUser(u));
    return () => unsubscribe();
  }, [authUser]);

  const displayName = dbUser?.name || authUser?.displayName || 'Campus User';
  const displayEmail = authUser?.email || '';
  const photoURL = authUser?.photoURL;
  const avatarColor = getUserColor(authUser?.uid || displayEmail);
  const initials = getInitials(displayName);

  const roleBadgeStyle =
    role === 'admin'
      ? 'bg-red-50 text-brand-emergency border border-red-100'
      : role === 'teacher'
      ? 'bg-amber-50 text-amber-700 border border-amber-200'
      : role === 'club_president'
      ? 'bg-violet-50 text-violet-700 border border-violet-200'
      : 'bg-blue-50 text-brand-primary border border-blue-100';

  const roleBadgeIcon =
    role === 'admin' ? <ShieldCheck className="w-3.5 h-3.5" /> :
    role === 'teacher' ? <GraduationCap className="w-3.5 h-3.5" /> :
    role === 'club_president' ? <Landmark className="w-3.5 h-3.5" /> :
    <UserCheck className="w-3.5 h-3.5" />;

  const roleBadgeLabel =
    role === 'admin' ? 'Admin Mode' :
    role === 'teacher' ? 'Teacher Mode' :
    role === 'club_president' ? 'Club President' :
    'Student Mode';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 w-[260px] bg-brand-sidebar border-r border-brand-border transform transition-transform duration-300 ease-in-out z-50 lg:translate-x-0 lg:static lg:block flex-shrink-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full py-6 px-4">
          <div className="px-3 mb-8 flex items-center justify-between">
            <div className="text-xl font-black tracking-tighter text-brand-primary flex items-center gap-2">
              CAMPUS MATE
            </div>
            <button className="lg:hidden" onClick={onClose}>
              <X className="w-5 h-5 text-brand-text-muted" />
            </button>
          </div>

          {/* Role badge */}
          <div className="px-3 mb-5">
            <div className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest',
              roleBadgeStyle
            )}>
              {roleBadgeIcon}
              {roleBadgeLabel}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-2 pb-4">
            <p className="px-3 text-[10px] font-bold text-brand-text-muted uppercase tracking-widest mb-2 opacity-50">
              Main Menu
            </p>
            {currentNav.map((item) => {
              const Icon = item.icon;
              const path = `/${role}/${item.id}`;
              const isActive = location.pathname.startsWith(path);

              return (
                <Link
                  key={item.id}
                  to={path}
                  onClick={onClose}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-bold text-[13px] relative group',
                    isActive
                      ? 'bg-brand-primary/5 text-brand-primary'
                      : 'text-brand-text-muted hover:bg-slate-50 hover:text-brand-text-main'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 w-1 h-6 bg-brand-primary rounded-r-full"
                    />
                  )}
                  <Icon className={cn(
                    'w-4 h-4',
                    isActive ? 'text-brand-primary' : 'text-brand-text-muted group-hover:scale-110 transition-transform'
                  )} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {'badge' in item && item.badge && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white tracking-wider">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="pt-4 border-t border-brand-border flex-shrink-0 mt-auto">
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl mb-1">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-brand-border" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: avatarColor }}>
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-brand-text-main truncate">{displayName}</p>
                <p className="text-[10px] text-brand-text-muted truncate">{displayEmail}</p>
              </div>
            </div>

            <Link
                to={`/${role}/settings`}
                onClick={onClose}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-brand-text-muted hover:bg-slate-50 transition-all font-bold text-[13px]"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>

            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-brand-emergency/70 hover:bg-red-50 hover:text-brand-emergency transition-all font-bold text-[13px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
