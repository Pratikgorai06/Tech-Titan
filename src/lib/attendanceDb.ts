/**
 * attendanceDb.ts — Firestore helpers specifically for the QR-based attendance system.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { QrSession, AttendanceRecord } from './db';

const CAMPUS_RADIUS_KM = 0.5;

// ─── Haversine distance ───────────────────────────────────────────────────────

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── QR Sessions ─────────────────────────────────────────────────────────────

export async function createQrSession(
  data: Omit<QrSession, 'id' | 'createdAt' | 'expiresAt' | 'active'> & { expiryMinutes: number }
): Promise<string> {
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(Date.now() + data.expiryMinutes * 60 * 1000);
  const ref = await addDoc(collection(db, 'qrSessions'), {
    ...data,
    createdAt: now,
    expiresAt,
    active: true,
  });
  return ref.id;
}

export async function getQrSession(sessionId: string): Promise<QrSession | null> {
  const snap = await getDoc(doc(db, 'qrSessions', sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as QrSession;
}

export async function endQrSession(sessionId: string) {
  await updateDoc(doc(db, 'qrSessions', sessionId), { active: false });
}

export function listenToSession(
  sessionId: string,
  onChange: (session: QrSession | null) => void
) {
  return onSnapshot(doc(db, 'qrSessions', sessionId), (snap) => {
    onChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as QrSession) : null);
  });
}

export async function getTeacherSessions(teacherUid: string): Promise<QrSession[]> {
  const q = query(
    collection(db, 'qrSessions'),
    where('teacherUid', '==', teacherUid),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as QrSession));
}

export async function getAllSessions(): Promise<QrSession[]> {
  const q = query(collection(db, 'qrSessions'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as QrSession));
}

// ─── Attendance Records ───────────────────────────────────────────────────────

export async function markQrAttendance(
  record: Omit<AttendanceRecord, 'id' | 'markedAt' | 'verified'> & {
    campusLat: number;
    campusLng: number;
    faceVerified?: boolean;
    livenessVerified?: boolean;
    deviceId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  // 1. Validate session is still active
  const session = await getQrSession(record.sessionId);
  if (!session) return { success: false, error: 'Session not found.' };
  if (!session.active) return { success: false, error: 'This session has already ended.' };
  if (session.expiresAt.toMillis() < Date.now())
    return { success: false, error: 'QR code has expired. Ask your teacher to generate a new one.' };

  // 2. Check duplicate
  const dupQ = query(
    collection(db, 'attendanceRecords'),
    where('sessionId', '==', record.sessionId),
    where('studentUid', '==', record.studentUid)
  );
  const dupSnap = await getDocs(dupQ);
  if (!dupSnap.empty) return { success: false, error: 'Attendance already marked for this session.' };

  // 3. Verify location — treat (0,0) as no-GPS (denied/unavailable) → always flagged
  const noGps = record.locationLat === 0 && record.locationLng === 0;
  const dist = noGps ? 99999 : haversineKm(record.locationLat, record.locationLng, session.campusLat, session.campusLng);
  const verified = !noGps && dist <= CAMPUS_RADIUS_KM;

  // 4. Write record
  await addDoc(collection(db, 'attendanceRecords'), {
    sessionId: record.sessionId,
    studentUid: record.studentUid,
    studentName: record.studentName,
    collegeId: record.collegeId,
    selfieUrl: record.selfieUrl,
    locationLat: record.locationLat,
    locationLng: record.locationLng,
    markedAt: Timestamp.now(),
    verified,
    faceVerified: record.faceVerified ?? false,
    livenessVerified: record.livenessVerified ?? false,
    deviceId: record.deviceId ?? '',
    regNo: record.regNo || '',
    department: record.department || '',
    academicYear: record.academicYear || '',
    section: record.section || '',
    batch: record.batch || '',
  });

  // 5. Increment student totalAttendance
  const userRef = doc(db, 'users', record.studentUid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const total = (userSnap.data().totalAttendance || 0) + 1;
    await updateDoc(userRef, { totalAttendance: total });
  }

  if (!verified) {
    const msg = noGps
      ? '⚠️ Location access was denied. Attendance saved but flagged — contact your teacher.'
      : `⚠️ Location check failed (${dist.toFixed(2)} km from campus). Record saved but flagged.`;
    return { success: true, error: msg };
  }
  return { success: true };
}

export function listenToSessionAttendance(
  sessionId: string,
  onChange: (records: AttendanceRecord[]) => void
) {
  const q = query(
    collection(db, 'attendanceRecords'),
    where('sessionId', '==', sessionId)
  );
  return onSnapshot(q, (snap) => {
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
    records.sort((a, b) => a.markedAt.toMillis() - b.markedAt.toMillis());
    onChange(records);
  });
}

export async function getSessionAttendance(sessionId: string): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, 'attendanceRecords'),
    where('sessionId', '==', sessionId)
  );
  const snap = await getDocs(q);
  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
  return records.sort((a, b) => a.markedAt.toMillis() - b.markedAt.toMillis());
}

export async function getStudentAttendanceHistory(studentUid: string): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, 'attendanceRecords'),
    where('studentUid', '==', studentUid)
  );
  const snap = await getDocs(q);
  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
  return records.sort((a, b) => b.markedAt.toMillis() - a.markedAt.toMillis());
}

export async function getAttendanceByDateRange(start: Date, end: Date): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, 'attendanceRecords'),
    where('markedAt', '>=', Timestamp.fromDate(start)),
    where('markedAt', '<=', Timestamp.fromDate(end)),
    orderBy('markedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
}
