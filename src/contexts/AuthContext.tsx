import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

// ─── Admin email — hardcoded ──────────────────────────────────────────────────
export const ADMIN_EMAIL = 'pratikgorai20006@gmail.com';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppRole = 'student' | 'admin';

interface AuthContextValue {
  user: User | null;
  role: AppRole;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  authError: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: 'student',
  isLoading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  authError: '',
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]         = useState<User | null>(null);
  const [role, setRole]         = useState<AppRole>('student');
  const [isLoading, setLoading] = useState(true);
  const [authError, setError]   = useState('');

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
    } else if (snap.data().role !== resolvedRole) {
      // Ensure role stays in sync with the hardcoded admin email
      await setDoc(ref, { role: resolvedRole }, { merge: true });
    }
  };

  // Listen to Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const resolvedRole: AppRole =
          firebaseUser.email === ADMIN_EMAIL ? 'admin' : 'student';
        setUser(firebaseUser);
        setRole(resolvedRole);
        try {
          await upsertUserProfile(firebaseUser, resolvedRole);
        } catch (e) {
          console.error('[Auth] Profile upsert failed:', e);
        }
      } else {
        setUser(null);
        setRole('student');
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
    <AuthContext.Provider value={{ user, role, isLoading, signInWithGoogle, signOut, authError }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
