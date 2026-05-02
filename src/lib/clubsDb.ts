/**
 * clubsDb.ts — Firestore helpers for Clubs, Societies & Council system.
 */
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, Timestamp, setDoc
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Static Club Definitions ──────────────────────────────────────────────────

export type ClubCategory = 'Technical Society' | 'Cultural Society' | 'Council';

export interface ClubDef {
  id: string;
  name: string;
  category: ClubCategory;
  description: string;
  emoji: string;
  color: string; // tailwind gradient
}

export const CLUBS_LIST: ClubDef[] = [
  // ── Technical Society ──
  { id: 'startup-cell', name: 'Start-Up Cell', category: 'Technical Society', emoji: '🚀', color: 'from-orange-500 to-amber-500', description: 'Fostering entrepreneurship and innovation among students by connecting them with mentors, funding, and resources to build scalable startups.' },
  { id: 'hackathon-coding', name: 'Hackathon and Coding Club', category: 'Technical Society', emoji: '💻', color: 'from-blue-500 to-cyan-500', description: 'Organizing hackathons, coding contests, and workshops to sharpen programming skills and build problem-solving mindsets.' },
  { id: 'mech-society', name: 'Mechanical Engineering Society', category: 'Technical Society', emoji: '⚙️', color: 'from-gray-600 to-slate-500', description: 'Promoting mechanical engineering knowledge through seminars, industrial visits, and hands-on project competitions.' },
  { id: 'ace', name: 'Association Of Civil Engineers', category: 'Technical Society', emoji: '🏗️', color: 'from-yellow-600 to-amber-600', description: 'Building the next generation of civil engineers through technical talks, site visits, and national-level competitions.' },
  { id: 'sme-bit', name: 'SME BIT Sindri Students\' Chapter', category: 'Technical Society', emoji: '🔩', color: 'from-teal-500 to-green-500', description: 'Student chapter of the Society of Manufacturing Engineers, focusing on manufacturing processes and industrial innovation.' },
  { id: 'sarjana', name: 'Sarjana', category: 'Technical Society', emoji: '🛠️', color: 'from-indigo-500 to-blue-600', description: 'A creative technical club that works on innovative design projects, model building, and engineering solutions to real-world problems.' },
  { id: 'sae-india', name: 'SAE India', category: 'Technical Society', emoji: '🏎️', color: 'from-red-500 to-rose-600', description: 'Students chapter of SAE International focused on automotive engineering, participating in Baja SAE and Formula Student competitions.' },
  { id: 'quimica', name: 'Quimica', category: 'Technical Society', emoji: '🧪', color: 'from-purple-500 to-violet-600', description: 'Exploring the wonders of chemistry through experiments, research projects, and connections with the chemical industry.' },
  { id: 'pies', name: 'Production And Industrial Engineering Society', category: 'Technical Society', emoji: '🏭', color: 'from-slate-500 to-zinc-600', description: 'Dedicated to advancing production and industrial engineering through technical events, workshops, and industry interface programs.' },
  { id: 'model-club', name: 'Model Club', category: 'Technical Society', emoji: '✈️', color: 'from-sky-500 to-blue-500', description: 'Designing and building working scale models — from aircraft to ships — developing hands-on engineering and design skills.' },
  { id: 'iste', name: 'ISTE Students\' Chapter', category: 'Technical Society', emoji: '📐', color: 'from-emerald-500 to-teal-600', description: 'Indian Society for Technical Education student chapter promoting technical education through seminars, short-term courses, and workshops.' },
  { id: 'iete', name: 'IETE Students\' Forum', category: 'Technical Society', emoji: '📡', color: 'from-blue-600 to-indigo-600', description: 'Forum of the Institution of Electronics and Telecommunication Engineers nurturing future electronics and communications professionals.' },
  { id: 'gdsc', name: 'Google Developers Student Club', category: 'Technical Society', emoji: '🔍', color: 'from-green-500 to-emerald-600', description: 'Google-supported club helping students bridge the gap between theory and practice through workshops, solution challenges, and projects.' },
  { id: 'eee-society', name: 'Electrical Engg. Society', category: 'Technical Society', emoji: '⚡', color: 'from-yellow-500 to-orange-500', description: 'Advancing electrical engineering knowledge and applications, from power systems to smart grids and renewable energy technologies.' },
  { id: 'ece-society', name: 'The ECE Society', category: 'Technical Society', emoji: '📻', color: 'from-pink-500 to-rose-500', description: 'Electronics and Communication Engineering society organizing technical fests, project exhibitions, and industry interface programs.' },
  { id: 'dhatvika', name: 'Dhatvika', category: 'Technical Society', emoji: '🔬', color: 'from-cyan-500 to-teal-500', description: 'Metallurgical and materials engineering club focused on exploring advanced materials, corrosion science, and metallurgical applications.' },
  { id: 'ieee', name: 'IEEE BIT-Sindri Student Branch', category: 'Technical Society', emoji: '🌐', color: 'from-blue-700 to-blue-500', description: 'Student branch of IEEE, the world\'s largest technical professional organization, connecting students with global engineering networks.' },
  // ── Cultural Society ──
  { id: 'arts-club', name: 'The Arts Club', category: 'Cultural Society', emoji: '🎨', color: 'from-pink-400 to-rose-500', description: 'A creative space for artists to paint, sketch, sculpt, and express themselves through various art forms and college exhibitions.' },
  { id: 'eco-club', name: 'Eco Club', category: 'Cultural Society', emoji: '🌿', color: 'from-green-500 to-lime-500', description: 'Promoting environmental awareness through tree planting drives, clean campus campaigns, and sustainability workshops.' },
  { id: 'gandhi-rachnatmak', name: 'Gandhi Rachnatmak Samiti', category: 'Cultural Society', emoji: '🕊️', color: 'from-amber-500 to-yellow-500', description: 'Inspired by Gandhian values of truth and non-violence, this society works on rural upliftment and social service programs.' },
  { id: 'leos', name: 'LEOs Society', category: 'Cultural Society', emoji: '🦁', color: 'from-yellow-600 to-orange-500', description: 'Leadership, Experience, Opportunity — LEO club of Lions International developing young leaders through community service projects.' },
  { id: 'literary-society', name: 'Literary Society', category: 'Cultural Society', emoji: '📚', color: 'from-purple-500 to-indigo-500', description: 'Celebrating the written and spoken word through debates, poetry slams, essay competitions, and book discussions.' },
  { id: 'photo-club', name: 'The Photographic Club', category: 'Cultural Society', emoji: '📷', color: 'from-slate-600 to-gray-500', description: 'Capturing campus life and beyond — teaching photography, organizing photo walks, exhibitions, and photography contests.' },
  { id: 'painting-wing', name: 'Painting Wing', category: 'Cultural Society', emoji: '🖌️', color: 'from-red-400 to-pink-500', description: 'Dedicated to fine arts and painting, conducting workshops, mural projects, and participating in inter-college art competitions.' },
  { id: 'prayaas', name: 'Prayaas India', category: 'Cultural Society', emoji: '🤝', color: 'from-orange-500 to-red-500', description: 'A social initiative bridging the gap between college students and underprivileged communities through education and outreach.' },
  { id: 'rotaract', name: 'Rotaract Club', category: 'Cultural Society', emoji: '🌍', color: 'from-sky-500 to-blue-600', description: 'Rotary International\'s youth wing organizing community service projects, professional development events, and international fellowships.' },
  // ── Council ──
  { id: 'iic', name: 'Institution\'s Innovation Council (IIC)', category: 'Council', emoji: '💡', color: 'from-violet-500 to-purple-600', description: 'Established by the Ministry of Education, IIC fosters a culture of innovation and entrepreneurship, supporting student startups and research initiatives across campus.' },
];

// ─── Firestore Interfaces ─────────────────────────────────────────────────────

export interface ClubRecord {
  id: string;          // same as ClubDef.id
  presidentUid?: string;
  presidentEmail?: string;
  presidentName?: string;
}

export interface ClubApplicationFormData {
  email: string;
  fullName: string;
  rollNumber: string;
  contactNumber: string;
  department: string;
  technicalSkills: string;
  additionalSkills: string;
  leadershipExp: string;
  communicationSkills: string; // "1"–"10"
  writingSkills: string;       // "1"–"10"
  startupIdea: string;
  motivation: string;
  queries: string;
}

export interface ClubApplication {
  id: string;
  clubId: string;
  clubName: string;
  studentUid: string;
  studentEmail: string;
  studentName: string;
  formData: ClubApplicationFormData;
  submittedAt: Timestamp;
  status: 'pending' | 'accepted' | 'rejected';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Assign / update club president */
export async function assignClubPresident(
  clubId: string,
  presidentUid: string,
  presidentEmail: string,
  presidentName: string
) {
  await setDoc(doc(db, 'clubs', clubId), { presidentUid, presidentEmail, presidentName }, { merge: true });
  // Also update user's role
  await updateDoc(doc(db, 'users', presidentUid), { role: 'club_president', presidingClubId: clubId });
}

/** Get all club records (president assignments) from Firestore */
export async function getClubRecords(): Promise<ClubRecord[]> {
  const snap = await getDocs(collection(db, 'clubs'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ClubRecord));
}

/** Get president record for a specific club */
export async function getClubRecord(clubId: string): Promise<ClubRecord | null> {
  const snap = await getDoc(doc(db, 'clubs', clubId));
  return snap.exists() ? { id: snap.id, ...snap.data() } as ClubRecord : null;
}

/** Submit student induction application */
export async function submitClubApplication(
  app: Omit<ClubApplication, 'id' | 'submittedAt' | 'status'>
): Promise<void> {
  await addDoc(collection(db, 'clubApplications'), {
    ...app,
    submittedAt: Timestamp.now(),
    status: 'pending',
  });
}

/** Check if a student already applied to a specific club */
export async function hasApplied(studentUid: string, clubId: string): Promise<boolean> {
  const q = query(
    collection(db, 'clubApplications'),
    where('studentUid', '==', studentUid),
    where('clubId', '==', clubId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/** Get all applications a student submitted */
export async function getStudentApplications(studentUid: string): Promise<ClubApplication[]> {
  const q = query(
    collection(db, 'clubApplications'),
    where('studentUid', '==', studentUid),
    orderBy('submittedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ClubApplication));
}

/** Get all applications for a specific club (for club president) */
export async function getClubApplications(clubId: string): Promise<ClubApplication[]> {
  const q = query(
    collection(db, 'clubApplications'),
    where('clubId', '==', clubId),
    orderBy('submittedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ClubApplication));
}

/** Update application status */
export async function updateApplicationStatus(
  appId: string,
  status: 'accepted' | 'rejected'
) {
  await updateDoc(doc(db, 'clubApplications', appId), { status });
}

/** Get all applications (admin view) */
export async function getAllApplications(): Promise<ClubApplication[]> {
  const q = query(collection(db, 'clubApplications'), orderBy('submittedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ClubApplication));
}
