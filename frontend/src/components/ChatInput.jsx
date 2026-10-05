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
    <div className="chat-dock">
      <form className="chat-dock-bar" onSubmit={handleSubmit}>
        <input
          id="chat-input"
          className="chat-dock-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ketik di sini... (cth: beli makan siang 25rb)"
          disabled={disabled}
          maxLength={500}
        />
        <button
          type="submit"
          className="chat-dock-send"
          disabled={!text.trim() || disabled}
          aria-label="Kirim pesan"
          title="Kirim pesan"
        >
          <span className="material-symbols-outlined">arrow_upward</span>
        </button>
      </form>
    </div>
  );
}

export default ChatInput;
