import { useState } from 'react';
import ChatBubble from './components/ChatBubble';
import ChatInput from './components/ChatInput';
import SummaryChart from './components/SummaryChart';
import { sendMessage } from './api';

function App() {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Halo! Cerita aja pemasukan/pengeluaran kamu'},
  ]);

  async function handleSend(text) {
    if (!text.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text }]);
    
    try {
      const data = await sendMessage(text);
      setMessages((prev) => [...prev, { sender: 'bot', text: data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'bot', text: 'Waduh, gagal connect ke server nich..' }]);
    }
  }

  return (
    <div>
      <h1>Asisten Keuangan</h1>
      {messages.map((msg, i) => (
        <ChatBubble key={i} sender={msg.sender} text={msg.text} />
      ))}
      <ChatInput onSend={handleSend} />
      <hr />
      <SummaryChart />
    </div>
  );
}

export default App;