import { useState } from 'react';

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form className="chat-input-bar" onSubmit={handleSubmit}>
      <button type="button" className="chat-attach" title="Segera hadir" aria-label="Lampiran">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m21 12-8.5 8.5a5.5 5.5 0 0 1-7.78-7.78L13 4.5a3.7 3.7 0 0 1 5.23 5.23l-8.5 8.5a1.85 1.85 0 0 1-2.62-2.62L15 8" />
        </svg>
      </button>
      <input
        className="chat-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ceritakan... cth: Gaji 5jt, beli kopi 20rb"
        disabled={disabled}
        maxLength={500}
      />
      <button
        type="submit"
        className="chat-send"
        disabled={!text.trim() || disabled}
        aria-label="Kirim pesan"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      </button>
    </form>
  );
}

export default ChatInput;
