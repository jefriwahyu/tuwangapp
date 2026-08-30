import { useState } from 'react';
import ChatBubble from './components/ChatBubble';
import ChatInput from './components/ChatInput';

function App() {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Halo! Cerita aja pemasukan/pengeluaran kamu'},
  ]);

  function handleSend(text) {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { sender: 'user', text }]);
  }

  return (
    <div>
      <h1>Asisten Keuangan</h1>
      {messages.map((msg, i) => (
        <ChatBubble key={i} sender={msg.sender} text={msg.text} />
      ))}
      <ChatInput onSend={handleSend} />
    </div>
  )
}

export default App;