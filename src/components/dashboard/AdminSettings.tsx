import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  Settings, MapPin, Building2, Phone, Save, Loader2,
  CheckCircle2, Navigation, Globe, AlertCircle, BookOpen,
  UserCog, Search, ShieldCheck, GraduationCap, Landmark, Users2, ArrowRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { CLUBS_LIST, assignClubPresident } from '../../lib/clubsDb';
import { dbService, UserProfile } from '../../lib/db';
import type { AppRole } from '../../contexts/AuthContext';

interface InstituteSettings {
  name: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  website: string;
  latitude: string;
  longitude: string;
  branches?: string;
  years?: string;
  batches?: string;
}

const DEFAULT: InstituteSettings = {
  name: 'Campus Mate Institute of Technology',
  address: '',
  city: '',
  pincode: '',
  phone: '',
  website: '',
  latitude: '',
  longitude: '',
  branches: 'CSE, ECE, ME, CE',
  years: '1st Year, 2nd Year, 3rd Year, 4th Year',
  batches: 'A, B, C',
};

export default function AdminSettings() {
  // ── Institute settings state ──
  const [settings, setSettings]   = useState<InstituteSettings>(DEFAULT);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError]   = useState('');

  // ── Role management state ──
  const [roleSearch, setRoleSearch] = useState('');
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [roleSearching, setRoleSearching] = useState(false);
  const [roleSearchErr, setRoleSearchErr] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('student');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleSaved, setRoleSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'institute'));
        if (snap.exists()) setSettings({ ...DEFAULT, ...snap.data() } as InstituteSettings);
      } catch (e) {
        console.warn('Settings load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      await setDoc(doc(db, 'settings', 'institute'), settings, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error('Save error:', e); }
    finally { setSaving(false); }
  };

  // Role management handlers
  const handleRoleSearch = async () => {
    if (!roleSearch.trim()) return;
    setRoleSearching(true); setRoleSearchErr(''); setFoundUser(null);
    const allUsers = await dbService.getAllUsers();
    const match = allUsers.find(u => u.email.toLowerCase() === roleSearch.trim().toLowerCase());
    if (match) {
      setFoundUser(match);
      setSelectedRole(match.role);
      setSelectedClubId('');
    } else {
      setRoleSearchErr('No user found with that email. They must have signed in at least once.');
    }
    setRoleSearching(false);
  };

  const handleRoleAssign = async () => {
    if (!foundUser) return;
    setRoleSaving(true); setRoleSaved(false);
    if (selectedRole === 'club_president' && selectedClubId) {
      await assignClubPresident(selectedClubId, foundUser.uid, foundUser.email, foundUser.name);
    } else {
      await updateDoc(doc(db, 'users', foundUser.uid), { role: selectedRole });
    }
    setFoundUser(prev => prev ? { ...prev, role: selectedRole } : null);
    setRoleSaved(true);
    setTimeout(() => setRoleSaved(false), 3000);
    setRoleSaving(false);
  };

  const handleUseMyLocation = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSettings(prev => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(`Location access denied: ${err.message}`);
        setGeoLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const mapSrc = settings.latitude && settings.longitude
    ? `https://maps.google.com/maps?q=${settings.latitude},${settings.longitude}&z=16&output=embed`
    : null;

  const field = (
    label: string,
    key: keyof InstituteSettings,
    placeholder: string,
    icon?: React.ElementType,
    span?: string
  ) => (
    <div className={cn('space-y-2', span)}>
      <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1 flex items-center gap-1.5">
        {icon && React.createElement(icon as any, { className: 'w-3 h-3' })}
        {label}
      </label>
      <input
        value={settings[key]}
        onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
      />
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Loading System Configuration...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-text-main uppercase flex items-center gap-3">
            <Settings className="w-8 h-8 text-brand-primary" />
            System Configuration
          </h2>
          <p className="text-brand-text-muted mt-2 max-w-xl text-sm font-medium">
            Manage institute identity and geographical location settings.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-lg',
            saved
              ? 'bg-accent-green text-white shadow-green-200/50'
              : 'bg-brand-primary text-white hover:bg-blue-700 shadow-blue-200/50'
          )}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </motion.button>
      </header>

      {/* Institute Info */}
      <div className="bg-white border border-brand-border rounded-3xl p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-brand-border pb-5">
          <div className="w-10 h-10 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black text-brand-text-main">Institute Information</h3>
            <p className="text-[11px] text-brand-text-muted font-medium">Basic identity details shown across the platform.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {field('Institute Name', 'name', 'e.g. ABC Institute of Technology', Building2, 'md:col-span-2')}
          {field('Street Address', 'address', '123 College Road, Area', MapPin, 'md:col-span-2')}
          {field('City / District', 'city', 'e.g. Kolkata')}
          {field('PIN Code', 'pincode', '700001')}
          {field('Phone Number', 'phone', '+91 98765 43210', Phone)}
          {field('Website', 'website', 'https://institute.edu.in', Globe)}
        </div>
      </div>

      {/* Academic Structure */}
      <div className="bg-white border border-brand-border rounded-3xl p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-brand-border pb-5">
          <div className="w-10 h-10 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-brand-text-main">Academic Options</h3>
            <p className="text-[11px] text-brand-text-muted font-medium">Manage default choices for student branch, year, and batch. (Comma-separated)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {field('Available Branches', 'branches', 'e.g. CSE, IT, ECE', BookOpen, 'md:col-span-2')}
          {field('Available Years', 'years', 'e.g. 1st Year, 2nd Year', undefined, 'md:col-span-1')}
          {field('Available Batches', 'batches', 'e.g. A1, A2, B1', undefined, 'md:col-span-1')}
        </div>
      </div>

      {/* Geo-Location */}
      <div className="bg-white border border-brand-border rounded-3xl p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-brand-border pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-accent-green" />
            </div>
            <div>
              <h3 className="text-sm font-black text-brand-text-main">Geographical Location</h3>
              <p className="text-[11px] text-brand-text-muted font-medium">Used for geofenced attendance and the campus map.</p>
            </div>
          </div>
          <button
            onClick={handleUseMyLocation}
            disabled={geoLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-green/10 border border-green-200 text-accent-green rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-50 transition-colors disabled:opacity-60"
          >
            {geoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            Use My Location
          </button>
        </div>

        {geoError && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {geoError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Latitude</label>
            <input
              value={settings.latitude}
              onChange={e => setSettings(prev => ({ ...prev, latitude: e.target.value }))}
              placeholder="e.g. 22.572646"
              className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest px-1">Longitude</label>
            <input
              value={settings.longitude}
              onChange={e => setSettings(prev => ({ ...prev, longitude: e.target.value }))}
              placeholder="e.g. 88.363895"
              className="w-full bg-slate-50 border border-brand-border rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all font-mono"
            />
          </div>
        </div>

        {/* Map preview */}
        {mapSrc ? (
          <div className="rounded-2xl overflow-hidden border border-brand-border h-64 shadow-sm">
            <iframe
              title="Campus Location Preview"
              src={mapSrc}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : (
          <div className="h-48 bg-slate-50 border-2 border-dashed border-brand-border rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400">
            <MapPin className="w-8 h-8" />
            <p className="text-xs font-bold uppercase tracking-widest">Map preview will appear here</p>
            <p className="text-[11px]">Enter coordinates or click "Use My Location"</p>
          </div>
        )}
      </div>
      {/* Role Management */}
      <div className="bg-white border border-brand-border rounded-3xl p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-brand-border pb-5">
          <div className="w-10 h-10 bg-violet-50 border border-violet-200 rounded-2xl flex items-center justify-center">
            <UserCog className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-brand-text-main">Role Management</h3>
            <p className="text-[11px] text-brand-text-muted font-medium">Assign roles to users by their email address. Roles: Student, Teacher, Club President, Admin.</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
            <input
              type="email"
              placeholder="Enter user's email address..."
              value={roleSearch}
              onChange={e => setRoleSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRoleSearch()}
              className="w-full bg-slate-50 border border-brand-border rounded-2xl pl-12 pr-5 py-3 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none"
            />
          </div>
          <button onClick={handleRoleSearch} disabled={roleSearching}
            className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            {roleSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {roleSearchErr && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {roleSearchErr}
          </div>
        )}

        {foundUser && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-5 p-6 bg-slate-50 border border-brand-border rounded-2xl">
            {/* User info */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-black">
                {foundUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-black text-brand-text-main">{foundUser.name}</p>
                <p className="text-sm text-brand-text-muted">{foundUser.email}</p>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">Current: {foundUser.role}</span>
              </div>
            </div>

            {/* Role selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-brand-text-muted uppercase tracking-widest">Assign Role</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  { role: 'student', label: 'Student', icon: Users2, color: 'from-blue-400 to-blue-600' },
                  { role: 'teacher', label: 'Teacher', icon: GraduationCap, color: 'from-amber-400 to-orange-500' },
                  { role: 'club_president', label: 'Club President', icon: Landmark, color: 'from-violet-400 to-purple-600' },
                  { role: 'admin', label: 'Admin', icon: ShieldCheck, color: 'from-red-400 to-red-600' },
                ] as const).map(r => (
                  <button key={r.role} onClick={() => setSelectedRole(r.role)}
                    className={cn('flex flex-col items-center gap-2 p-4 rounded-2xl border font-bold text-[12px] transition-all',
                      selectedRole === r.role
                        ? 'bg-brand-primary border-brand-primary text-white shadow-lg'
                        : 'bg-white border-brand-border text-brand-text-muted hover:border-brand-primary/40'
                    )}>
                    <r.icon className="w-5 h-5" />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Club selector (only for club_president) */}
            {selectedRole === 'club_president' && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-brand-text-muted uppercase tracking-widest">Assign to Club</label>
                <select value={selectedClubId} onChange={e => setSelectedClubId(e.target.value)}
                  className="w-full bg-white border border-brand-border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none">
                  <option value="">Select a Club / Society</option>
                  {CLUBS_LIST.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name} ({c.category})</option>)}
                </select>
              </div>
            )}

            <button onClick={handleRoleAssign} disabled={roleSaving || (selectedRole === 'club_president' && !selectedClubId)}
              className={cn('w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all',
                roleSaved
                  ? 'bg-green-500 text-white'
                  : 'bg-brand-primary text-white hover:bg-blue-700 shadow-lg disabled:opacity-50'
              )}>
              {roleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> :
               roleSaved ? <CheckCircle2 className="w-4 h-4" /> :
               <ArrowRight className="w-4 h-4" />}
              {roleSaved ? 'Role Assigned!' : `Assign ${selectedRole} Role`}
            </button>
          </motion.div>
        )}
      </div>

    </div>
  );
}
