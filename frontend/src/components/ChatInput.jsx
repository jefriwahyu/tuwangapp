import { useState } from 'react';

function ChatInput({ onSend }) {
    const [text, setText] = useState('');

    function handleSubmit(e) {
        e.preventDefault();
        onSend(text);
        setText('');
    }

    return (
        <form onSubmit={handleSubmit}>
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tulis pesan..."
            />
            <button type="submit">Kirim</button>
        </form>
    );
}

export default ChatInput;