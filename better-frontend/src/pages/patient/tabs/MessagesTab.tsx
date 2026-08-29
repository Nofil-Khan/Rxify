import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Stethoscope, CheckCheck, User } from 'lucide-react';
import {
  getConversations, getChatHistory, sendMessage,
  ConversationItem, ChatMessage
} from '../../../lib/chatApi';
import { getInitials } from '../../../lib/doctorApi';

export default function PatientMessagesTab() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activePeer, setActivePeer]       = useState<ConversationItem | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(true);
  const [sending, setSending]             = useState(false);
  const messagesEndRef                    = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadConvs() {
      setLoading(true);
      const list = await getConversations();
      if (mounted) {
        setConversations(list ?? []);
        if (list && list.length > 0) {
          setActivePeer(list[0]);
        }
        setLoading(false);
      }
    }
    loadConvs();
    return () => { mounted = false; };
  }, []);

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
    const interval = setInterval(loadHistory, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activePeer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activePeer || !input.trim() || sending) return;

    const text = input.trim();
    setInput('');
    setSending(true);

    const tempMsg: ChatMessage = {
      id: Date.now(),
      sender_id: 99,
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
      {/* Sidebar - Doctor Contacts */}
      <div className="dd-chat-sidebar">
        <div className="dd-chat-sidebar-header">
          <h3 className="dd-card-title" style={{ fontSize: '0.98rem' }}>
            <Stethoscope size={18} className="dd-card-title-icon" />
            My Doctor Chat
          </h3>
        </div>

        <div className="dd-chat-peer-list">
          {conversations.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textTransform: 'none', color: 'var(--dd-text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
              <User size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p>No connected doctor conversation found.</p>
              <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Connect with a doctor in the "My Doctor" tab to enable messaging.</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.peer_id}
                className={`dd-chat-peer-item ${activePeer?.peer_id === conv.peer_id ? 'dd-chat-peer-item--active' : ''}`}
                onClick={() => setActivePeer(conv)}
              >
                <div className="dd-avatar" style={{ width: '38px', height: '38px', fontSize: '0.85rem', background: 'var(--dd-indigo-bg)', color: 'var(--dd-indigo)' }}>
                  {getInitials(conv.display_name || conv.username)}
                </div>
                <div className="dd-item-meta" style={{ flex: 1 }}>
                  <span className="dd-item-title" style={{ fontSize: '0.88rem' }}>
                    {conv.display_name || conv.username}
                  </span>
                  <span className="dd-item-sub" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                    {conv.last_message ? conv.last_message.message_text : 'Tap to start conversation'}
                  </span>
                </div>
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
                <div className="dd-avatar" style={{ background: 'var(--dd-indigo-bg)', color: 'var(--dd-indigo)' }}>
                  {getInitials(activePeer.display_name || activePeer.username)}
                </div>
                <div>
                  <h3 className="dd-item-title">{activePeer.display_name || activePeer.username}</h3>
                  <span className="dd-item-sub dd-item-mono">@{activePeer.username} &bull; Doctor</span>
                </div>
              </div>
              <span className="dd-doctor-badge" style={{ background: 'var(--dd-emerald-bg)', color: 'var(--dd-emerald)', borderColor: 'var(--dd-emerald)' }}>
                Assigned Doctor
              </span>
            </div>

            {/* Messages Log */}
            <div className="dd-chat-messages-area">
              {messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--dd-text-muted)', fontSize: '0.88rem' }}>
                  <MessageSquare size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p>Send a message to consult with your doctor.</p>
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
                placeholder={`Ask ${activePeer.display_name || activePeer.username} a medical question...`}
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
            <p>Connect with a doctor in the "My Doctor" tab to message them.</p>
          </div>
        )}
      </div>
    </div>
  );
}
