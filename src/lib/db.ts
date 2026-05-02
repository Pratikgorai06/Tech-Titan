import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  addDoc, 
  orderBy,
  Timestamp,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'student' | 'admin' | 'teacher' | 'club_president';
  department: string;
  academicYear: number | string;
  totalAttendance: number;
  gpa: number;
  batch?: string;
  collegeId?: string; // roll number / enrollment number
}

export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  type: string;
  rsvps: string[]; // array of user uids
}

export interface Complaint {
  id: string;
  studentId: string;
  subject: string;
  description: string;
  status: 'pending' | 'in-progress' | 'resolved';
  createdAt: any;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  amount: number;
  description: string;
  dueDate: string;
  status: 'pending' | 'paid';
}

export interface CareerPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  deadline: string;
  type: 'Full-time' | 'Internship' | 'Contract';
  status: 'Open' | 'Closed' | 'Applied';
  description?: string;
  requirements?: string[];
}

export interface CampusNotice {
  id: string;
  title: string;
  content: string;
  fileUrl?: string; // URL for pdf or img
  fileType?: 'pdf' | 'img';
  createdAt: any;
  createdBy: string;
}

// ─── QR Attendance Interfaces ─────────────────────────────────────────────────

export interface QrSession {
  id: string;
  teacherUid: string;
  teacherName: string;
  subject: string;
  branch: string;
  year: number;
  campusLat: number;
  campusLng: number;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  active: boolean;
  expiryMinutes: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentUid: string;
  studentName: string;
  collegeId: string;
  selfieUrl: string;
  locationLat: number;
  locationLng: number;
  markedAt: Timestamp;
  verified: boolean; // location inside campus radius
}

// Mock Current User IDs for demo purposes
export const MOCK_STUDENT_ID = "alex_2026";
export const MOCK_ADMIN_ID = "admin_user";

export const dbService = {
  // User Management
  async getUser(uid: string) {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() as UserProfile : null;
  },

  subscribeUser(uid: string, callback: (user: UserProfile | null) => void) {
    const docRef = doc(db, 'users', uid);
    return onSnapshot(docRef, (snap) => {
      callback(snap.exists() ? snap.data() as UserProfile : null);
    });
  },

  async getAllUsers() {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
  },

  async getUsersByRole(role: 'student' | 'teacher' | 'admin' | 'club_president') {
    const q = query(collection(db, 'users'), where('role', '==', role));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
  },

  async promoteToTeacher(uid: string) {
    await updateDoc(doc(db, 'users', uid), { role: 'teacher' });
  },

  async demoteToStudent(uid: string) {
    await updateDoc(doc(db, 'users', uid), { role: 'student' });
  },

  // Events
  async getEvents() {
    const querySnapshot = await getDocs(collection(db, 'events'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampusEvent));
  },

  async addEvent(event: Omit<CampusEvent, 'id' | 'rsvps'>) {
    await addDoc(collection(db, 'events'), {
      ...event,
      rsvps: []
    });
  },

  async deleteEvent(eventId: string) {
    await deleteDoc(doc(db, 'events', eventId));
  },

  async toggleRSVP(event: CampusEvent, userId: string, isRSVPed: boolean) {
    const eventRef = doc(db, 'events', event.id);
    const snap = await getDoc(eventRef);
    
    if (!snap.exists()) {
      await setDoc(eventRef, {
        ...event,
        rsvps: isRSVPed ? arrayRemove(userId) : arrayUnion(userId)
      }, { merge: true });
    } else {
      await updateDoc(eventRef, {
        rsvps: isRSVPed ? arrayRemove(userId) : arrayUnion(userId)
      });
    }
  },

  // Attendance
  async markAttendance(userId: string) {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: userId,
        name: userId === MOCK_ADMIN_ID ? 'Campus Admin' : 'Alex Johnson',
        email: userId === MOCK_ADMIN_ID ? 'admin@campusmate.edu' : 'alex.j@university.edu',
        role: userId === MOCK_ADMIN_ID ? 'admin' : 'student',
        department: 'Administration',
        academicYear: 0,
        totalAttendance: 1,
        gpa: 4.0
      });
      return true;
    }

    const user = userSnap.data() as UserProfile;
    await updateDoc(userRef, {
      totalAttendance: (user.totalAttendance || 0) + 1
    });
    return true;
  },

  // Complaints
  async getComplaints(userId?: string) {
    let q;
    if (userId) {
      q = query(collection(db, 'complaints'), where('studentId', '==', userId), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as Complaint));
  },

  async raiseComplaint(studentId: string, subject: string, description: string) {
    await addDoc(collection(db, 'complaints'), {
      studentId,
      subject,
      description,
      status: 'pending',
      createdAt: Timestamp.now()
    });
  },

  async updateComplaintStatus(complaintId: string, status: Complaint['status']) {
    const docRef = doc(db, 'complaints', complaintId);
    await updateDoc(docRef, { status });
  },

  // Career Hub
  async getCareers() {
    const snap = await getDocs(collection(db, 'careers'));
    return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as CareerPosting));
  },

  async addCareer(posting: Omit<CareerPosting, 'id'>) {
    await addDoc(collection(db, 'careers'), posting);
  },

  // Fees
  async getFees(userId?: string) {
    let q;
    if (userId) {
      q = query(collection(db, 'fees'), where('studentId', '==', userId));
    } else {
      q = collection(db, 'fees');
    }
    const snap = await getDocs(q as any);
    return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as FeeRecord));
  },

  async payFee(fee: FeeRecord) {
    const feeRef = doc(db, 'fees', fee.id);
    const snap = await getDoc(feeRef);
    
    if (!snap.exists()) {
      await setDoc(feeRef, {
        ...fee,
        status: 'paid'
      });
    } else {
      await updateDoc(feeRef, {
        status: 'paid'
      });
    }
  },

  // Notices
  async getNotices() {
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as CampusNotice));
  },

  async addNotice(notice: Omit<CampusNotice, 'id'>) {
    await addDoc(collection(db, 'notices'), notice);
  }
};
