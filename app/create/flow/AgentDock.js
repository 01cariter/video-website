'use client';

import { useEffect, useRef } from 'react';
import { Bot, LoaderCircle, Send, X } from 'lucide-react';

export default function AgentDock({
  aiReady,
  busy,
  chatInput,
  messages,
  onChatInputChange,
  onClose,
  onRunAction,
  open,
  quickActions,
}) {
  const logRef = useRef(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [busy, messages]);

  if (!open) return null;

  const submitChat = (event) => {
    event.preventDefault();
    if (!busy && chatInput.trim()) onRunAction('chat');
  };

  return (
    <aside className="agent-dock" aria-label="AI Agent">
      <header className="agent-dock__header">
        <Bot aria-hidden="true" />
        <b>AI Agent</b>
        <small>{aiReady ? 'AI Gateway' : 'demo'}</small>
        <button type="button" aria-label="关闭 Agent" title="关闭 Agent" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="agent-dock__actions">
        {quickActions.map((item) => (
          <button
            key={item.action}
            type="button"
            title={item.hint}
            disabled={busy}
            onClick={() => onRunAction(item.action)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="agent-dock__log" ref={logRef}>
        {messages.map((message) => (
          <div key={message.id} className={`agent-message agent-message--${message.role}`}>
            {message.content}
          </div>
        ))}
        {busy ? (
          <div className="agent-message agent-message--assistant agent-message--pending" role="status">
            <LoaderCircle className="is-spinning" aria-hidden="true" />
            思考中…
          </div>
        ) : null}
      </div>

      <form className="agent-dock__composer" onSubmit={submitChat}>
        <textarea
          value={chatInput}
          onChange={(event) => onChatInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (!busy && chatInput.trim()) onRunAction('chat');
            }
          }}
          placeholder="描述创意或向 Agent 提问"
          rows={2}
        />
        <button type="submit" aria-label="发送消息" title="发送消息" disabled={busy || !chatInput.trim()}>
          <Send aria-hidden="true" />
        </button>
      </form>
    </aside>
  );
}
