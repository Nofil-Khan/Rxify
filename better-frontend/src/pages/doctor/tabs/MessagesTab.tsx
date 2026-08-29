import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Search, User, CheckCheck, Clock } from 'lucide-react';
import {
  getConversations, getChatHistory, sendMessage,
  ConversationItem, ChatMessage
} from '../../../lib/chatApi';
import { getInitials } from '../../../lib/doctorApi';
import { useAuthStore } from '../../../lib/auth';

export default function DoctorMessagesTab() {
  const { userId } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activePeer, setActivePeer]       = useState<ConversationItem | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [input, setInput]                 = useState('');
  const [search, setSearch]               = useState('');
  const [loading, setLoading]             = useState(true);
  const [sending, setSending]             = useState(false);
  const messagesEndRef                    = useRef<HTMLDivElement | null>(null);

  /* Load conversations list */
  useEffect(() => {
    let mounted = true;
    async function loadConvs() {
      setLoading(true);
      const list = await getConversations();
      if (mounted) {
        setConversations(list ?? []);
        if (list && list.length > 0 && !activePeer) {
          setActivePeer(list[0]);
        }
        setLoading(false);
      }
    }
    loadConvs();
    return () => { mounted = false; };
  }, []);

  /* Fetch history whenever active peer changes */
  useEffect(() => {
    if (!activePeer) return;
    const peerId = activePeer.peer_id;
    let mounted = true;
    async function loadHistory() {
      const history = await getChatHistory(peerId);
      if (mounted) {
        setMessages(history ?? []);
      }
    }
    loadHistory();
    // Poll for new messages every 4 seconds
    const interval = setInterval(loadHistory, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activePeer]);

  /* Auto-scroll chat to bottom */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activePeer || !input.trim() || sending) return;

    const text = input.trim();
    setInput('');
    setSending(true);

    // Optimistic UI push
    const tempMsg: ChatMessage = {
      id: Date.now(),
      sender_id: userId ?? 1,
      receiver_id: activePeer.peer_id,
      message_text: text,
      is_read: 1,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, tempMsg]);

    const created = await sendMessage(activePeer.peer_id, text);
    if (created) {
      setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? created : m)));
    }
    setSending(false);
  };

  const filteredConvs = conversations.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.display_name || c.username).toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="dd-chat-container">
        <div className="dd-chat-sidebar dd-skeleton" style={{ width: '300px' }} />
        <div className="dd-chat-main dd-skeleton" style={{ flex: 1 }} />
      </div>
    );
  }

  return (
    <div className="dd-chat-container">
      {/* Sidebar - Conversations */}
      <div className="dd-chat-sidebar">
        <div className="dd-chat-sidebar-header">
          <h3 className="dd-card-title" style={{ fontSize: '0.98rem' }}>
            <MessageSquare size={18} className="dd-card-title-icon" />
            Patient Messages
          </h3>
        </div>

        <div style={{ padding: '0.75rem' }}>
          <div className="dd-input-wrap">
            <Search size={14} className="dd-input-icon" />
            <input
              type="text"
              className="dd-input"
              style={{ fontSize: '0.82rem', paddingLeft: '34px' }}
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter patient chats"
            />
          </div>
        </div>

        <div className="dd-chat-peer-list">
          {filteredConvs.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--dd-text-muted)', padding: '2rem', fontSize: '0.82rem' }}>
              No active chat threads found.
            </p>
          ) : (
            filteredConvs.map((conv) => (
              <button
                key={conv.peer_id}
                className={`dd-chat-peer-item ${activePeer?.peer_id === conv.peer_id ? 'dd-chat-peer-item--active' : ''}`}
                onClick={() => setActivePeer(conv)}
              >
                <div className="dd-avatar" style={{ width: '38px', height: '38px', fontSize: '0.85rem' }}>
                  {getInitials(conv.display_name || conv.username)}
                </div>
                <div className="dd-item-meta" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="dd-item-title" style={{ fontSize: '0.88rem' }}>
                      {conv.display_name || conv.username}
                    </span>
                  </div>
                  <span className="dd-item-sub" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                    {conv.last_message ? conv.last_message.message_text : 'Tap to start conversation'}
                  </span>
                </div>
                {conv.unread_count > 0 && (
                  <span className="dd-chat-unread-badge">{conv.unread_count}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Viewport */}
      <div className="dd-chat-main">
        {activePeer ? (
          <>
            {/* Header */}
            <div className="dd-chat-header">
              <div className="dd-item-left">
                <div className="dd-avatar">
                  {getInitials(activePeer.display_name || activePeer.username)}
                </div>
                <div>
                  <h3 className="dd-item-title">{activePeer.display_name || activePeer.username}</h3>
                  <span className="dd-item-sub dd-item-mono">@{activePeer.username} &bull; Patient</span>
                </div>
              </div>
              <span className="dd-doctor-badge" style={{ background: 'var(--dd-emerald-bg)', color: 'var(--dd-emerald)', borderColor: 'var(--dd-emerald)' }}>
                Care Active
              </span>
            </div>

            {/* Messages Log */}
            <div className="dd-chat-messages-area">
              {messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--dd-text-muted)', fontSize: '0.88rem' }}>
                  <MessageSquare size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p>Send a message to start direct clinical communication.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id !== activePeer.peer_id;
                  return (
                    <div
                      key={m.id}
                      className={`dd-msg-row ${isMe ? 'dd-msg-row--me' : 'dd-msg-row--peer'}`}
                    >
                      <div className={`dd-msg-bubble ${isMe ? 'dd-msg-bubble--me' : 'dd-msg-bubble--peer'}`}>
                        {m.message_text}
                      </div>
                      <span className="dd-msg-time">
                        {m.created_at} {isMe && <CheckCheck size={11} style={{ display: 'inline', marginLeft: '3px' }} />}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form className="dd-chat-input-bar" onSubmit={handleSend}>
              <input
                type="text"
                className="dd-chat-input"
                placeholder={`Type a secure response to ${activePeer.display_name || activePeer.username}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="submit"
                className="dd-btn-primary"
                style={{ padding: '10px 16px', borderRadius: 'var(--radius-full)' }}
                disabled={!input.trim() || sending}
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--dd-text-muted)' }}>
            <User size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p>Select a patient conversation to view messages.</p>
          </div>
        )}
      </div>
    </div>
  );
}
