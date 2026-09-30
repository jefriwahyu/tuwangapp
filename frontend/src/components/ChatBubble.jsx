import { useState } from 'react';

function formatTime(date = new Date()) {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
}

function ChatBubble({ sender, text, time }) {
  const isUser = sender === 'user';

  return (
    <div className={`bubble-row ${isUser ? 'user' : 'bot'}`}>
      {!isUser && (
        <div className="bubble-avatar" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="6" width="20" height="13" rx="3" fill="#059669" />
            <rect x="2" y="6" width="20" height="5" rx="2.5" fill="#34d399" />
            <circle cx="17.5" cy="14.5" r="1.8" fill="#fff" />
          </svg>
        </div>
      )}
      <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-bot'}`}>
        <p className="bubble-text">{text}</p>
        <span className="bubble-time">
          {time || formatTime()}
          {isUser && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 7 17l-5-5" />
              <path d="m22 10-7.5 7.5L13 16" />
            </svg>
          )}
        </span>
      </div>
    </div>
  );
}

export default ChatBubble;
