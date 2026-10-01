import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import Login from './components/Login';
import ChatBubble from './components/ChatBubble';
import ChatInput from './components/ChatInput';
import SummaryChart from './components/SummaryChart';
import TransactionHistory from './components/TransactionHistory';
import { deleteTransaction, sendMessage } from './api';

function nowTime() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
}

const QUICK_PROMPTS = [
  '💰 Gaji masuk 5 juta',
  '☕ Beli kopi 20rb',
  '🏠 Bayar kos 800rb',
  '📊 Rekap bulan ini',
];

function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'Halo! 👋 Ceritakan aja pemasukan / pengeluaran kamu, contoh: "Gaji 5jt" atau "Makan siang 25rb".', time: nowTime() },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [chartPeriod, setChartPeriod] = useState('month');
  const [summaryKey, setSummaryKey] = useState(0);
  // Ringkasan inline dari respons chat + nomor urutnya.
  const [liveSummary, setLiveSummary] = useState(null);
  const liveSeq = useRef(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setChecking(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  async function handleSend(text) {
    if (!text.trim() || isTyping) return;

    const userMsg = { id: Date.now(), sender: 'user', text, time: nowTime() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      // Kirim periode aktif chart supaya ringkasan inline dari backend
      // cocok dengan yang sedang dilihat user.
      const data = await sendMessage(text, chartPeriod);
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: data.reply || 'Oke, sudah kucatat! ✅',
        time: nowTime(),
      };
      // Kartu konfirmasi hapus: tombol di dalam bubble chat.
      if (data.action === 'confirm_delete' && data.candidates?.length) {
        botMsg.confirmDelete = data.candidates;
      }
      setMessages((prev) => [...prev, botMsg]);
      if (data.period) setChartPeriod(data.period);
      // Tempel ringkasan inline ke chart — tanpa fetch ulang.
      // Periode query_report ikut data.period, transaksi pakai periode aktif.
      const summaryPeriod = data.period || chartPeriod;
      if (data.summary && data.summary.period === summaryPeriod) {
        liveSeq.current += 1;
        setLiveSummary({ summary: data.summary, seq: liveSeq.current });
      }
      setSummaryKey((k) => k + 1);
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        sender: 'bot',
        text: 'Waduh, gagal connect ke server nih. Pastikan backend jalan di localhost:8080 🛠️',
        time: nowTime(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }

  async function handleConfirmDelete(msgId, txId) {
    try {
      await deleteTransaction(txId);
      // Tandai kandidat terhapus, kunci sisa tombol di kartu yang sama.
      setMessages((prev) => prev.map((m) => {
        if (m.id !== msgId) return m;
        const rest = (m.confirmDelete || []).filter((c) => String(c.id) !== String(txId));
        return { ...m, confirmDelete: rest, deleteDone: true };
      }));
      setSummaryKey((k) => k + 1);
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: Date.now() + 2,
        sender: 'bot',
        text: err.message || 'Gagal menghapus transaksi.',
        time: nowTime(),
      }]);
    }
  }

  if (checking) {
    return (
      <div className="chat-loading">
        <span className="login-spinner dark" />
        <p>Memuat Taktuntuwang...</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const email = session.user.email || '';
  const initial = (email[0] || 'U').toUpperCase();

  return (
    <div className="chat-app">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-inner">
          <div className="chat-brand">
            <span className="chat-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="6" width="20" height="13" rx="3" fill="white" opacity="0.95" />
                <rect x="2" y="6" width="20" height="5" rx="2.5" fill="#10b981" />
                <circle cx="17.5" cy="14.5" r="1.8" fill="#065f46" />
              </svg>
            </span>
            <div>
              <strong className="chat-brand-name">Taktuntuwang</strong>
              <span className="chat-brand-status"><i className="dot" /> Asisten keuangan online</span>
            </div>
          </div>
          <div className="chat-user">
            <span className="chat-avatar">{initial}</span>
            <span className="chat-email">{email}</span>
            <button className="chat-logout" onClick={() => supabase.auth.signOut()} title="Keluar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="chat-main">
        {/* Chat panel */}
        <section className="chat-panel">
          <div className="chat-panel-head">
            <div>
              <h2>Room Chat 💬</h2>
              <p>Ceritakan transaksi harianmu dengan bahasa santai</p>
            </div>
            <span className="chat-count">{messages.length} pesan</span>
          </div>

          <div className="chat-messages" ref={scrollRef}>
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id || msg.text}
                sender={msg.sender}
                text={msg.text}
                time={msg.time}
                confirmDelete={msg.confirmDelete}
                deleteDone={msg.deleteDone}
                onConfirmDelete={(txId) => handleConfirmDelete(msg.id, txId)}
              />
            ))}
            {isTyping && (
              <div className="bubble-row bot">
                <div className="bubble-avatar">✍️</div>
                <div className="bubble bubble-bot typing">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
          </div>

          <div className="chat-suggestions">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                className="chip"
                onClick={() => handleSend(q.replace(/^[^\s]+\s/, ''))}
                disabled={isTyping}
              >
                {q}
              </button>
            ))}
          </div>

          <ChatInput onSend={handleSend} disabled={isTyping} />
        </section>

        {/* Insight panel */}
        <aside className="insight-panel">
          <SummaryChart period={chartPeriod} onPeriodChange={setChartPeriod} refreshKey={summaryKey} liveSnapshot={liveSummary} />
          <TransactionHistory refreshKey={summaryKey} onChanged={() => setSummaryKey((k) => k + 1)} />

          <div className="insight-card howto">
            <h3>🚀 Cara pakai</h3>
            <ol>
              <li>Ketik <b>"Gaji 5 juta"</b> untuk pemasukan</li>
              <li>Ketik <b>"Beli kopi 20rb"</b> untuk pengeluaran</li>
              <li>Ketik <b>"kopi 10k, parkir 5rb"</b> untuk catat 2 sekaligus</li>
              <li>Ketik <b>"Rekap minggu ini"</b> untuk ringkasan</li>
            </ol>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
