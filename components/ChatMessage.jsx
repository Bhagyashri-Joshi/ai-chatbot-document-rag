// components/ChatMessage.jsx
// Responsible for: rendering chat messages, streaming display, loading
// state, source display (TRD section 33/45).

import ChunkSourceList from "./ChunkSourceList";

export default function ChatMessage({ role, content, sources, isStreaming, isLoading }) {
  const isUser = role === "user";

  return (
    <div className={`chat-message ${isUser ? "chat-message--user" : "chat-message--ai"}`}>
      <div className="chat-message__label">{isUser ? "You" : "AI"}</div>
      <div className="chat-message__bubble">
        {isLoading ? (
          <div className="chat-message__loading">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        ) : (
          <p className="chat-message__text">
            {content}
            {isStreaming && <span className="chat-message__cursor">▍</span>}
          </p>
        )}

        {!isUser && sources && sources.length > 0 && (
          <ChunkSourceList sources={sources} />
        )}
      </div>

      <style jsx>{`
        .chat-message {
          display: flex;
          flex-direction: column;
          max-width: 720px;
          margin-bottom: 16px;
        }
        .chat-message--user {
          align-self: flex-end;
          align-items: flex-end;
        }
        .chat-message--ai {
          align-self: flex-start;
          align-items: flex-start;
        }
        .chat-message__label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 4px;
          padding: 0 4px;
        }
        .chat-message__bubble {
          border-radius: 12px;
          padding: 12px 16px;
          background: ${isUser ? "#4f46e5" : "#f3f4f6"};
          color: ${isUser ? "#ffffff" : "#111827"};
        }
        .chat-message__text {
          margin: 0;
          white-space: pre-wrap;
          line-height: 1.5;
        }
        .chat-message__cursor {
          display: inline-block;
          animation: blink 1s step-start infinite;
        }
        @keyframes blink {
          50% {
            opacity: 0;
          }
        }
        .chat-message__loading {
          display: flex;
          gap: 4px;
          padding: 4px 0;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #9ca3af;
          animation: pulse 1.2s infinite ease-in-out;
        }
        .dot:nth-child(2) {
          animation-delay: 0.15s;
        }
        .dot:nth-child(3) {
          animation-delay: 0.3s;
        }
        @keyframes pulse {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
