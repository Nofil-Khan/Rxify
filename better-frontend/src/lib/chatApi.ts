/* ─── Rxify Direct Messaging API Client ──────────────────────────────────────── */

import { authHeaders } from './api';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface ChatMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  message_text: string;
  is_read: number;
  created_at: string;
}

export interface ConversationItem {
  peer_id: number;
  username: string;
  display_name: string | null;
  role: 'doctor' | 'patient';
  specialty?: string | null;
  unread_count: number;
  last_message?: ChatMessage | null;
}

/* ── Fallback Mock Conversations ── */
const MOCK_CONVERSATIONS: ConversationItem[] = [
  {
    peer_id: 101,
    username: 'sarah_c',
    display_name: 'Sarah Connor',
    role: 'patient',
    unread_count: 1,
    last_message: {
      id: 1,
      sender_id: 101,
      receiver_id: 1,
      message_text: 'Doctor, I completed the 7-day Augmentin course today. Symptoms are much better!',
      is_read: 0,
      created_at: '2026-08-10 18:45',
    },
  },
  {
    peer_id: 102,
    username: 'marcus_b',
    display_name: 'Marcus Brody',
    role: 'patient',
    unread_count: 0,
    last_message: {
      id: 2,
      sender_id: 1,
      receiver_id: 102,
      message_text: 'Please remember to take Metformin BID with your meals as prescribed.',
      is_read: 1,
      created_at: '2026-08-10 15:30',
    },
  },
  {
    peer_id: 103,
    username: 'elena_r',
    display_name: 'Elena Rostova',
    role: 'patient',
    unread_count: 0,
    last_message: {
      id: 3,
      sender_id: 103,
      receiver_id: 1,
      message_text: 'Thank you for updating my prescription OCR notes!',
      is_read: 1,
      created_at: '2026-08-09 11:20',
    },
  },
];

const MOCK_HISTORY: Record<number, ChatMessage[]> = {
  101: [
    {
      id: 10,
      sender_id: 1,
      receiver_id: 101,
      message_text: 'Hello Sarah, welcome to Rxify Care! I reviewed your prescription OCR scan.',
      is_read: 1,
      created_at: '2026-08-08 10:15',
    },
    {
      id: 11,
      sender_id: 101,
      receiver_id: 1,
      message_text: 'Thank you Dr. Jenkins! Should I take Lisinopril before or after breakfast?',
      is_read: 1,
      created_at: '2026-08-08 10:18',
    },
    {
      id: 12,
      sender_id: 1,
      receiver_id: 101,
      message_text: 'Take Lisinopril 10mg every morning with a full glass of water.',
      is_read: 1,
      created_at: '2026-08-08 10:22',
    },
    {
      id: 13,
      sender_id: 101,
      receiver_id: 1,
      message_text: 'Doctor, I completed the 7-day Augmentin course today. Symptoms are much better!',
      is_read: 0,
      created_at: '2026-08-10 18:45',
    },
  ],
  102: [
    {
      id: 20,
      sender_id: 102,
      receiver_id: 1,
      message_text: 'Good afternoon Doctor! Checking in regarding my Metformin dosage schedule.',
      is_read: 1,
      created_at: '2026-08-10 15:10',
    },
    {
      id: 21,
      sender_id: 1,
      receiver_id: 102,
      message_text: 'Please remember to take Metformin BID with your meals as prescribed.',
      is_read: 1,
      created_at: '2026-08-10 15:30',
    },
  ],
};

/* ── API Client Methods ── */

export async function getConversations(): Promise<ConversationItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/chat/conversations`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.conversations ?? MOCK_CONVERSATIONS;
  } catch {
    return MOCK_CONVERSATIONS;
  }
}

export async function getChatHistory(otherUserId: number): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/chat/messages/${otherUserId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.messages ?? [];
  } catch {
    return MOCK_HISTORY[otherUserId] ?? [
      {
        id: Date.now(),
        sender_id: otherUserId,
        receiver_id: 1,
        message_text: 'Hello doctor, thank you for connecting!',
        is_read: 1,
        created_at: '2026-08-10 12:00',
      },
    ];
  }
}

export async function sendMessage(receiverId: number, messageText: string): Promise<ChatMessage | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({
        receiver_id: receiverId,
        message_text: messageText,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data;
  } catch {
    // Fallback optimistic message creation
    return {
      id: Date.now(),
      sender_id: 1,
      receiver_id: receiverId,
      message_text: messageText,
      is_read: 1,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
  }
}
