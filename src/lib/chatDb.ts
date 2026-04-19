import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  limit,
  onSnapshot,
  Timestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
  setDoc,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpaceId = 'official' | 'academic' | 'clubs' | 'general';

export interface ChatChannel {
  id: string;
  name: string;
  spaceId: SpaceId;
  spaceName: string;
  spaceColor: string;
  description: string;
  isOfficial: boolean;   // admin-only posting
  isJoinable: boolean;   // clubs are opt-in
  memberCount: number;
  createdAt: Timestamp;
  order: number;         // sort order within a space
}

export interface MessageReactions {
  [emoji: string]: string[]; // emoji → array of userIds
}

export interface ReplyRef {
  messageId: string;
  senderName: string;
  preview: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  senderColor: string;
  content: string;
  createdAt: Timestamp;
  reactions: MessageReactions;
  replyTo?: ReplyRef;
  isPinned: boolean;
  isSystem: boolean;
  isEdited?: boolean;
}

export interface DirectChannel {
  id: string;
  participants: string[]; // [user1_id, user2_id]
  createdAt: Timestamp;
}

export interface TypingStatus {
  userId: string;
  name: string;
  timestamp: Timestamp;
}

export interface LastSeen {
  channelId: string;
  timestamp: Timestamp;
}

// ─── Color / Avatar Helpers ───────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#f97316', '#84cc16',
];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Space ordering for client-side sort ──────────────────────────────────────

const SPACE_ORDER_MAP: Record<SpaceId, number> = {
  official: 0,
  academic: 1,
  clubs: 2,
  general: 3,
};

// ─── Default Channel Seed Data ────────────────────────────────────────────────

const DEFAULT_CHANNELS: Omit<ChatChannel, 'id' | 'createdAt'>[] = [
  // Official (admin-only post)
  { name: 'announcements',      spaceId: 'official', spaceName: '🏫 Official', spaceColor: '#2563eb', description: 'Campus-wide official announcements', isOfficial: true,  isJoinable: false, memberCount: 0, order: 0 },
  { name: 'exam-schedule',      spaceId: 'official', spaceName: '🏫 Official', spaceColor: '#2563eb', description: 'Exam dates, seating plans & timetables', isOfficial: true,  isJoinable: false, memberCount: 0, order: 1 },
  { name: 'placements',         spaceId: 'official', spaceName: '🏫 Official', spaceColor: '#2563eb', description: 'Official placement drive announcements', isOfficial: true,  isJoinable: false, memberCount: 0, order: 2 },
  // Academic (year-specific)
  { name: 'year-1-batch',       spaceId: 'academic', spaceName: '📚 Academic', spaceColor: '#10b981', description: 'First year student discussions',               isOfficial: false, isJoinable: true,  memberCount: 0, order: 0 },
  { name: 'year-2-batch',       spaceId: 'academic', spaceName: '📚 Academic', spaceColor: '#10b981', description: 'Second year student discussions',              isOfficial: false, isJoinable: true,  memberCount: 0, order: 1 },
  { name: 'year-3-batch',       spaceId: 'academic', spaceName: '📚 Academic', spaceColor: '#10b981', description: 'Third year student discussions',               isOfficial: false, isJoinable: true,  memberCount: 0, order: 2 },
  { name: 'year-4-batch',       spaceId: 'academic', spaceName: '📚 Academic', spaceColor: '#10b981', description: 'Final year — placement prep & beyond',         isOfficial: false, isJoinable: true,  memberCount: 0, order: 3 },
  // Clubs
  { name: 'coding-club',        spaceId: 'clubs',    spaceName: '🎭 Clubs',    spaceColor: '#8b5cf6', description: 'Competitive programming, hackathons & open source', isOfficial: false, isJoinable: true, memberCount: 0, order: 0 },
  { name: 'photography-club',   spaceId: 'clubs',    spaceName: '🎭 Clubs',    spaceColor: '#8b5cf6', description: 'Share shots, workshops & campus photo events', isOfficial: false, isJoinable: true, memberCount: 0, order: 1 },
  { name: 'nss-ncc',            spaceId: 'clubs',    spaceName: '🎭 Clubs',    spaceColor: '#8b5cf6', description: 'NSS and NCC activity updates & volunteering', isOfficial: false, isJoinable: true, memberCount: 0, order: 2 },
  { name: 'entrepreneurship',   spaceId: 'clubs',    spaceName: '🎭 Clubs',    spaceColor: '#8b5cf6', description: 'Startup ideas, funding & E-Cell events',       isOfficial: false, isJoinable: true, memberCount: 0, order: 3 },
  // General
  { name: 'general',            spaceId: 'general',  spaceName: '💬 General',  spaceColor: '#f59e0b', description: 'Open campus conversations',               isOfficial: false, isJoinable: false, memberCount: 0, order: 0 },
  { name: 'lost-and-found',     spaceId: 'general',  spaceName: '💬 General',  spaceColor: '#f59e0b', description: 'Report or find items lost around campus',  isOfficial: false, isJoinable: false, memberCount: 0, order: 1 },
  { name: 'hostel-life',        spaceId: 'general',  spaceName: '💬 General',  spaceColor: '#f59e0b', description: 'Hostel, food, mess menu & roommate chat',   isOfficial: false, isJoinable: false, memberCount: 0, order: 2 },
  { name: 'off-topic',          spaceId: 'general',  spaceName: '💬 General',  spaceColor: '#f59e0b', description: 'Memes, movies, cricket — anything goes',    isOfficial: false, isJoinable: false, memberCount: 0, order: 3 },
];

// ─── Chat DB Service ──────────────────────────────────────────────────────────

export const chatDb = {
  /**
   * Seeds default channels if Firestore collection is empty.
   * Uses a batch write — safe to call on every app load.
   */
  async seedChannelsIfEmpty(): Promise<void> {
    const snap = await getDocs(collection(db, 'chatChannels'));
    if (!snap.empty) return;

    const batch = writeBatch(db);
    for (const ch of DEFAULT_CHANNELS) {
      const ref = doc(collection(db, 'chatChannels'));
      batch.set(ref, { ...ch, createdAt: Timestamp.now() });
    }
    await batch.commit();
  },

  /**
   * Fetches all channels and sorts them client-side.
   * Avoids compound index requirements in Firestore.
   */
  async getChannels(): Promise<ChatChannel[]> {
    const snap = await getDocs(collection(db, 'chatChannels'));
    const channels = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatChannel));

    return channels.sort((a, b) => {
      const spaceDiff = (SPACE_ORDER_MAP[a.spaceId] ?? 99) - (SPACE_ORDER_MAP[b.spaceId] ?? 99);
      if (spaceDiff !== 0) return spaceDiff;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  },

  /**
   * Fetches Direct Message channels for a user.
   */
  async getDirectChannels(userId: string): Promise<DirectChannel[]> {
    const q = query(
      collection(db, 'chatDMs'),
      where('participants', 'array-contains', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DirectChannel));
  },

  /**
   * Creates or gets a DM channel between two users.
   */
  async createOrGetDirectChannel(userId1: string, userId2: string): Promise<DirectChannel> {
    const q1 = query(collection(db, 'chatDMs'), where('participants', 'array-contains', userId1));
    const snap = await getDocs(q1);
    const existing = snap.docs.find(d => {
      const data = d.data();
      return data.participants && data.participants.includes(userId2);
    });

    if (existing) {
      return { id: existing.id, ...existing.data() } as DirectChannel;
    }

    const docRef = await addDoc(collection(db, 'chatDMs'), {
      participants: [userId1, userId2],
      createdAt: Timestamp.now()
    });
    
    return {
      id: docRef.id,
      participants: [userId1, userId2],
      createdAt: Timestamp.now()
    };
  },

  /**
   * Real-time listener for messages in a channel.
   * Uses only `where` (no compound orderBy) to avoid composite index errors.
   * Messages are sorted client-side by createdAt.
   * Returns the unsubscribe function.
   */
  onMessages(
    channelId: string,
    callback: (messages: ChatMessage[]) => void,
    msgLimit = 80
  ): () => void {
    const q = query(
      collection(db, 'chatMessages'),
      where('channelId', '==', channelId),
      limit(msgLimit)
    );

    return onSnapshot(q, (snap) => {
      const msgs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ChatMessage))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        });
      callback(msgs);
    });
  },

  /**
   * Sends a new message to a channel.
   */
  async sendMessage(
    channelId: string,
    content: string,
    sender: { id: string; name: string },
    replyTo?: ReplyRef
  ): Promise<void> {
    const msgData: Omit<ChatMessage, 'id'> = {
      channelId,
      senderId: sender.id,
      senderName: sender.name,
      senderInitials: getInitials(sender.name),
      senderColor: getUserColor(sender.id),
      content: content.trim(),
      createdAt: Timestamp.now(),
      reactions: {},
      isPinned: false,
      isSystem: false,
      ...(replyTo ? { replyTo } : {}),
    };
    await addDoc(collection(db, 'chatMessages'), msgData);
  },

  /**
   * Toggles an emoji reaction on a message.
   */
  async toggleReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<void> {
    const msgRef = doc(db, 'chatMessages', messageId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;

    const reactions = (snap.data().reactions || {}) as MessageReactions;
    const current: string[] = reactions[emoji] || [];
    const hasReacted = current.includes(userId);

    await updateDoc(msgRef, {
      [`reactions.${emoji}`]: hasReacted
        ? arrayRemove(userId)
        : arrayUnion(userId),
    });
  },

  /**
   * Toggles pinned state on a message.
   */
  async togglePin(messageId: string, currentlyPinned: boolean): Promise<void> {
    await updateDoc(doc(db, 'chatMessages', messageId), {
      isPinned: !currentlyPinned,
    });
  },

  /**
   * Deletes a message.
   */
  async deleteMessage(messageId: string): Promise<void> {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'chatMessages', messageId));
  },

  /**
   * Edits a message.
   */
  async editMessage(messageId: string, newContent: string): Promise<void> {
    await updateDoc(doc(db, 'chatMessages', messageId), {
      content: newContent,
      isEdited: true
    });
  },

  /**
   * Listen to typing status for a channel.
   */
  onTyping(channelId: string, callback: (typists: TypingStatus[]) => void): () => void {
    const q = query(collection(db, `chatTyping/${channelId}/status`), limit(10));
    return onSnapshot(q, (snap) => {
      const now = Date.now();
      const typists = snap.docs
        .map(d => d.data() as TypingStatus)
        // filter out stale typing (older than 3 seconds)
        .filter(t => t.timestamp && (now - t.timestamp.toMillis() < 4000));
      callback(typists);
    });
  },

  /**
   * Set user typing status.
   */
  async setTyping(channelId: string, userId: string, name: string): Promise<void> {
    const ref = doc(db, `chatTyping/${channelId}/status`, userId);
    await setDoc(ref, {
      userId,
      name,
      timestamp: Timestamp.now()
    });
  },

  /**
   * Updates last seen timestamp for a user in a channel.
   */
  async updateLastSeen(userId: string, channelId: string): Promise<void> {
    const ref = doc(db, `users/${userId}/chatLastSeen`, channelId);
    await setDoc(ref, {
      channelId,
      timestamp: Timestamp.now()
    });
  },

  /**
   * Listen for all last seen timestamps of a user.
   */
  onLastSeen(userId: string, callback: (ls: Record<string, Timestamp>) => void): () => void {
    const q = query(collection(db, `users/${userId}/chatLastSeen`));
    return onSnapshot(q, (snap) => {
      const data: Record<string, Timestamp> = {};
      snap.docs.forEach(d => {
        data[d.id] = d.data().timestamp;
      });
      callback(data);
    });
  },

  /**
   * Creates a new channel (Admin only).
   */
  async createChannel(channel: Omit<ChatChannel, 'id' | 'createdAt' | 'memberCount'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'chatChannels'), {
      ...channel,
      memberCount: 0,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  }
};
