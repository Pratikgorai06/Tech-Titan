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
import { CLUBS_LIST } from './clubsDb';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpaceId = 'technical' | 'cultural' | 'council' | 'discussions';

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
  technical: 0,
  cultural: 1,
  council: 2,
  discussions: 3,
};

// ─── Chat DB Service ──────────────────────────────────────────────────────────

export const chatDb = {
  /**
   * Seeds default channels if Firestore collection is empty.
   * Uses a batch write — safe to call on every app load.
   */
  async seedChannelsIfEmpty(): Promise<void> {
    // Deprecated: We now auto-populate from CLUBS_LIST in getChannels
  },

  /**
   * Fetches all channels and sorts them client-side.
   * Auto-populates club channels and a default discussion channel.
   */
  async getChannels(): Promise<ChatChannel[]> {
    const snap = await getDocs(collection(db, 'chatChannels'));
    let dbChannels = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatChannel));

    // 1. Generate Club Channels
    const clubChannels: ChatChannel[] = CLUBS_LIST.map((club, index) => {
      let spaceId: SpaceId = 'technical';
      let spaceName = '🚀 Technical Societies';
      let spaceColor = '#3b82f6';
      
      if (club.category === 'Cultural Society') {
        spaceId = 'cultural';
        spaceName = '🎭 Cultural Societies';
        spaceColor = '#ec4899';
      } else if (club.category === 'Council') {
        spaceId = 'council';
        spaceName = '🏛️ Councils';
        spaceColor = '#8b5cf6';
      }
      
      return {
        id: club.id,
        name: club.id,
        spaceId,
        spaceName,
        spaceColor,
        description: club.description,
        isOfficial: false,
        isJoinable: true,
        memberCount: 0,
        createdAt: Timestamp.now(),
        order: index
      };
    });
    
    // 2. Default Discussion Channel
    const discussionChannel: ChatChannel = {
        id: 'general-discussions',
        name: 'general-discussions',
        spaceId: 'discussions',
        spaceName: '💬 Discussions',
        spaceColor: '#f59e0b',
        description: 'General discussions for events, inductions, and Q&A',
        isOfficial: false,
        isJoinable: false, // False means no explicit join needed, it's public
        memberCount: 0,
        createdAt: Timestamp.now(),
        order: 0
    };

    // 3. Filter DB channels to valid spaces
    const validSpaces = ['technical', 'cultural', 'council', 'discussions'];
    dbChannels = dbChannels.filter(c => validSpaces.includes(c.spaceId as string));
    
    // 4. Combine and Sort
    const allChannels = [...clubChannels, discussionChannel, ...dbChannels];

    return allChannels.sort((a, b) => {
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
