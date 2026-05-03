import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

// ─── Hardcoded role overrides ────────────────────────────────────────────────
export const ADMIN_EMAIL = 'pratikgorai20006@gmail.com';
export const HARDCODED_TEACHERS: string[] = ['pratikgorai06@gmail.com'];

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppRole = 'student' | 'admin' | 'teacher' | 'club_president';

interface AuthContextValue {
  user: User | null;
  role: AppRole;
  isLoading: boolean;
  profileComplete: boolean;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  authError: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: 'student',
  isLoading: true,
  profileComplete: false,
  refreshProfile: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  authError: '',
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                     = useState<User | null>(null);
  const [role, setRole]                     = useState<AppRole>('student');
  const [isLoading, setLoading]             = useState(true);
  const [authError, setError]               = useState('');
  const [profileComplete, setProfileComplete] = useState(false);

  // Resolve role: admin email wins; hardcoded teachers next; otherwise read from Firestore
  const resolveRole = async (firebaseUser: User): Promise<AppRole> => {
    if (firebaseUser.email === ADMIN_EMAIL) return 'admin';
    if (firebaseUser.email && HARDCODED_TEACHERS.includes(firebaseUser.email)) return 'teacher';
    try {
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (snap.exists()) {
        const stored = snap.data().role as AppRole | undefined;
        if (stored === 'teacher' || stored === 'admin' || stored === 'club_president') return stored;
      }
    } catch (e) {
      console.error('[Auth] Role fetch failed:', e);
    }
    return 'student';
  };

  // Persist user profile to Firestore on first sign-in
  const upsertUserProfile = async (firebaseUser: User, resolvedRole: AppRole) => {
    const ref = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || 'Campus User',
        email: firebaseUser.email || '',
        role: resolvedRole,
        department: resolvedRole === 'admin' ? 'Administration' : 'Computer Science',
        academicYear: resolvedRole === 'admin' ? 0 : 2,
        totalAttendance: 0,
        gpa: 0,
        createdAt: Timestamp.now(),
      });
    } else {
      // Keep admin email always synced; preserve teacher role if already set
      const current = snap.data().role as AppRole;
      if (resolvedRole === 'admin' && current !== 'admin') {
        await setDoc(ref, { role: 'admin' }, { merge: true });
      }
    }
  };

  // Check if profile is complete (has required academic fields filled)
  const checkProfileComplete = async (uid: string, resolvedRole: AppRole): Promise<boolean> => {
    // Admins and teachers skip the profile gate
    if (resolvedRole === 'admin' || resolvedRole === 'teacher') return true;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) return false;
      const data = snap.data();
      // Profile is complete if all required fields are filled
      return !!(data.profileComplete || (data.collegeId && data.department && data.academicYear && data.batch && data.section));
    } catch {
      return false;
    }
  };

  // Called after ProfileCompletion form saves — re-check without full auth reload
  const refreshProfile = async () => {
    if (user) {
      const complete = await checkProfileComplete(user.uid, role);
      setProfileComplete(complete);
    }
  };

  // Listen to Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const resolvedRole = await resolveRole(firebaseUser);
        setUser(firebaseUser);
        setRole(resolvedRole);
        try {
          await upsertUserProfile(firebaseUser, resolvedRole);
        } catch (e) {
          console.error('[Auth] Profile upsert failed:', e);
        }
        const complete = await checkProfileComplete(firebaseUser.uid, resolvedRole);
        setProfileComplete(complete);
      } else {
        setUser(null);
        setRole('student');
        setProfileComplete(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        return; // user cancelled — no error to show
      }
      if (e.code === 'auth/unauthorized-domain') {
        setError('UNAUTHORIZED_DOMAIN');
      } else if (e.code === 'auth/popup-blocked') {
        setError('Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.');
      } else {
        setError(`Sign-in failed: ${e.message || 'Unknown error. Please try again.'}`);
      }
      console.error('[Auth] Google sign-in error:', e);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, role, isLoading, profileComplete, refreshProfile, signInWithGoogle, signOut, authError }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
