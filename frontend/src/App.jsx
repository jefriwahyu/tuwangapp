import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import Login from './components/Login';
import ChatBubble from './components/ChatBubble';
import ChatInput from './components/ChatInput';
import InsightPanel from './components/InsightPanel';
import { deleteTransaction, sendMessage } from './api';

function nowTime() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
}

function todayLabel() {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Suggestion chips persis mock: kopi, gaji, belanja, ringkasan.
const QUICK_PROMPTS = [
  { icon: 'coffee', text: 'Beli kopi susu 18rb' },
  { icon: 'payments', text: 'Gaji bulanan masuk 6 jt' },
  { icon: 'shopping_cart', text: 'Belanja bulanan 350rb' },
  { icon: 'pie_chart', text: 'Ringkasan' },
];

function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'Halo! Senang bertemu denganmu. Ada pengeluaran atau pemasukan baru? Langsung ceritakan saja di sini, biar aku yang rapikan pembukuannya ya.', time: nowTime() },
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
        text: data.reply || 'Oke, sudah kucatat!',
        time: nowTime(),
        saved: data.saved || [],
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
        text: 'Waduh, gagal terhubung ke server. Pastikan backend jalan di localhost:8080.',
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
  const namePart = email.split('@')[0].replace(/[._-]+/g, ' ').trim() || 'Pengguna';
  const displayName = namePart.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const initials = displayName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const userNotes = messages.filter((m) => m.sender === 'user').length;

  return (
    <div className="app-shell">
      <div className="app-wrap">
        {/* Top bar terintegrasi persis mock ringkasan */}
        <header className="topbar">
          <div className="topbar-brand">
            <span className="topbar-logo">
              <span className="material-symbols-outlined">account_balance_wallet</span>
            </span>
            <div className="topbar-title">
              <strong>Taktuntuwang</strong>
              <span>Asisten Pencatatan Keuangan Cerdas</span>
            </div>
          </div>
          <div className="topbar-right">
            <span className="ai-pill"><i className="dot" /> AI Aktif &amp; Siap Membantu</span>
            <span className="topbar-div" aria-hidden="true" />
            <div className="topbar-user">
              <span className="topbar-avatar">{initials}</span>
              <span className="topbar-who">
                <strong>{displayName}</strong>
                <em>{email}</em>
              </span>
            </div>
            <button className="topbar-logout" onClick={() => supabase.auth.signOut()} title="Keluar">
              <span className="material-symbols-outlined">logout</span>
              <span>Keluar</span>
            </button>
          </div>
        </header>

      {/* Workspace 2 kolom: chat 7 + insight 5 */}
        <main className="workspace">
          {/* Kartu chat kiri */}
          <section className="chat-card">
            <div className="chat-card-head">
              <div className="chat-card-id">
                <span className="chat-card-avatar">
                  <span className="material-symbols-outlined">smart_toy</span>
                </span>
                <div>
                  <div className="chat-card-titlerow">
                    <h1>Asisten Keuangan</h1>
                    <span className="ready-pill"><i className="dot" /> Siap Membantu</span>
                  </div>
                  <p>Ketik santai seperti mengobrol dengan teman</p>
                </div>
              </div>
              <span className="today-pill">
                <span className="material-symbols-outlined">receipt_long</span>
                {userNotes} Catatan Hari Ini
              </span>
            </div>

            <div className="chat-stream" ref={scrollRef}>
              <div className="date-sep"><span>{todayLabel()}</span></div>
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id || msg.text}
                  sender={msg.sender}
                  text={msg.text}
                  time={msg.time}
                  saved={msg.saved}
                  confirmDelete={msg.confirmDelete}
                  deleteDone={msg.deleteDone}
                  userInitial={initials}
                  onConfirmDelete={(txId) => handleConfirmDelete(msg.id, txId)}
                />
              ))}
              {isTyping && (
                <div className="msg-row bot">
                  <span className="msg-avatar bot">
                    <span className="material-symbols-outlined">smart_toy</span>
                  </span>
                  <div className="msg-col-start">
                    <div className="bubble-bot typing">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="quick-row">
              <span className="quick-label">
                <span className="material-symbols-outlined">bolt</span>
                Coba klik:
              </span>
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.text}
                  type="button"
                  className="quick-chip"
                  onClick={() => handleSend(q.text)}
                  disabled={isTyping}
                >
                  <span className="material-symbols-outlined">{q.icon}</span>
                  {q.text}
                </button>
              ))}
            </div>

            <ChatInput onSend={handleSend} disabled={isTyping} />
          </section>

          {/* Panel insight kanan */}
          <aside className="insight-panel">
            <InsightPanel
              period={chartPeriod}
              onPeriodChange={setChartPeriod}
              refreshKey={summaryKey}
              liveSnapshot={liveSummary}
              onChanged={() => setSummaryKey((k) => k + 1)}
              onFillExample={(text) => handleSend(text)}
            />
          </aside>
        </main>

        <footer className="app-foot">
          <div className="app-foot-inner">
            <span className="app-foot-brand">Taktuntuwang <em>— Asisten Pencatatan Keuangan Percakapan Cerdas</em></span>
            <span className="app-foot-copy">© 2024 Taktuntuwang. Hak cipta dilindungi undang-undang.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
