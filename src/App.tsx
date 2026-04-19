import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader2, Menu } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import EmergencyBanner from './components/layout/EmergencyBanner';
import DashboardView from './components/dashboard/DashboardView';
import AttendanceView from './components/dashboard/AttendanceView';
import EventsView from './components/dashboard/EventsView';
import ComplaintsView from './components/dashboard/ComplaintsView';
import FeesView from './components/dashboard/FeesView';
import CareerHubView from './components/dashboard/CareerHubView';
import AdminDashboard from './components/dashboard/AdminDashboard';
import AdminAttendance from './components/dashboard/AdminAttendance';
import AdminComplaints from './components/dashboard/AdminComplaints';
import AdminEvents from './components/dashboard/AdminEvents';
import AdminCareer from './components/dashboard/AdminCareer';
import AdminSettings from './components/dashboard/AdminSettings';
import AdminNotice from './components/dashboard/AdminNotice';
import NotesView from './components/dashboard/NotesView';
import NoticeView from './components/dashboard/NoticeView';
import Chatbot from './components/chat/Chatbot';
import CampusChat from './components/chat/CampusChat';
import LoginPage from './components/auth/LoginPage';
import StudentSettings from './components/dashboard/StudentSettings';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const { user, role, isLoading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Close sidebar on route change automatically
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0f1a]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm text-white/30">Checking session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  const isChat = location.pathname.includes('/chat');

  // Helper to format header text
  const getHeaderText = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return 'Dashboard';
    return parts[1].replace(/-/g, ' ');
  };

  return (
    <div className="flex min-h-screen bg-brand-bg font-sans text-brand-text-main">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        role={role}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Priority Alert Banner */}
        <EmergencyBanner
          message="URGENT: Campus main library will be closed for maintenance until tomorrow morning."
        />

        {/* Mobile top header */}
        <header className="lg:hidden h-16 flex items-center px-4 bg-white border-b border-slate-100 sticky top-0 z-30">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="ml-2 font-bold text-lg text-slate-900 capitalize">
            {getHeaderText()}
          </h1>
        </header>

        {isChat ? (
          <div className="flex-1 min-h-0 flex flex-col p-3 lg:p-4">
            <Routes>
               {role === 'admin' ? (
                 <Route path="/admin/chat" element={<CampusChat role={role} />} />
               ) : (
                 <Route path="/student/chat" element={<CampusChat role={role} />} />
               )}
            </Routes>
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
            <Routes>
              {role === 'admin' ? (
                <>
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/attendance" element={<AdminAttendance />} />
                  <Route path="/admin/complaints" element={<AdminComplaints />} />
                  <Route path="/admin/events" element={<AdminEvents />} />
                  <Route path="/admin/career" element={<AdminCareer />} />
                  <Route path="/admin/notice" element={<AdminNotice />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                  {/* Default redirect for Admin */}
                  <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                </>
              ) : (
                <>
                  <Route path="/student/dashboard" element={<DashboardView />} />
                  <Route path="/student/attendance" element={<AttendanceView />} />
                  <Route path="/student/events" element={<EventsView />} />
                  <Route path="/student/complaints" element={<ComplaintsView />} />
                  <Route path="/student/fees" element={<FeesView />} />
                  <Route path="/student/career" element={<CareerHubView />} />
                  <Route path="/student/notes" element={<NotesView />} />
                  <Route path="/student/notices" element={<NoticeView />} />
                  <Route path="/student/settings" element={<StudentSettings />} />
                  {/* Default redirect for Student */}
                  <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
                </>
              )}
            </Routes>
          </main>
        )}
      </div>

      {/* Floating AI chatbot widget */}
      <Chatbot />
    </div>
  );
}
