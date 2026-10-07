import { useEffect, useState } from 'react';
import SummaryChart, { PERIODS } from './SummaryChart';
import TransactionHistory from './TransactionHistory';

const TABS = [
  { id: 'summary', label: 'Ringkasan', icon: 'insights' },
  { id: 'history', label: 'Riwayat', icon: 'receipt_long' },
  { id: 'guide', label: 'Panduan', icon: 'menu_book' },
];

function GuidePanel() {
  const [copied, setCopied] = useState(null);
  const examples = [
    {
      tag: 'Pengeluaran Makan',
      tagCls: 'orange',
      quote: '\u201cBeli nasi padang 25rb tadi siang\u201d',
      res: '\u2192 Otomatis dicatat: Pengeluaran Rp25.000 (Makanan)',
      fill: 'Beli nasi padang 25rb tadi siang',
    },
    {
      tag: 'Pemasukan Gaji',
      tagCls: 'green',
      quote: '\u201cDapat gaji freelance desain 1.5jt\u201d',
      res: '\u2192 Otomatis dicatat: Pemasukan Rp1.500.000 (Pendapatan)',
      fill: 'Dapat gaji freelance desain 1.5jt',
    },
    {
      tag: 'Dua Transaksi Sekaligus',
      tagCls: 'blue',
      quote: '\u201cBayar listrik 200rb dan pulsa 50rb\u201d',
      res: '\u2192 AI mengenali 2 pengeluaran: Tagihan Listrik & Pulsa',
      fill: 'Bayar listrik 200rb dan pulsa 50rb',
    },
  ];

  // Klik kartu contoh = salin teksnya saja, tidak langsung terkirim.
  async function copyExample(ex) {
    try {
      await navigator.clipboard.writeText(ex.fill);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = ex.fill;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* abaikan */ }
      ta.remove();
    }
    setCopied(ex.fill);
    setTimeout(() => setCopied((c) => (c === ex.fill ? null : c)), 1500);
  }

  return (
    <div className="guide">
      <div className="guide-hero-card">
        <div className="guide-hero-top">
          <span className="guide-hero-ico">
            <span className="material-symbols-outlined">sentiment_satisfied</span>
          </span>
          <div>
            <h2>Cara Mudah Mencatat Keuangan</h2>
            <p>
              Anda tidak perlu repot menghafal format khusus atau angka baku.
              Cukup ketik seperti sedang berkirim pesan WhatsApp, sistem pintar
              kami yang akan mencatat nominal dan kategorinya.
            </p>
          </div>
        </div>
      </div>

      <div className="guide-sec">
        <div className="guide-sec-head">
          <h3>
            <span className="material-symbols-outlined">forum</span>
            Contoh Kalimat Sehari-hari
          </h3>
          <span className="guide-copy-hint">Klik untuk salin</span>
        </div>
        {examples.map((ex) => (
          <button
            key={ex.quote}
            type="button"
            className="guide-ex"
            onClick={() => copyExample(ex)}
          >
            <span className="guide-ex-top">
              <span className={`guide-tag ${ex.tagCls}`}>{ex.tag}</span>
              <span className="material-symbols-outlined">{copied === ex.fill ? 'check' : 'content_copy'}</span>
            </span>
            <p className="guide-ex-quote">{ex.quote}</p>
            <p className="guide-ex-res">{copied === ex.fill ? 'Tersalin — tinggal tempel di kolom chat.' : ex.res}</p>
          </button>
        ))}
      </div>

      <div className="guide-sec">
        <h3>
          <span className="material-symbols-outlined amber">tips_and_updates</span>
          Tips Praktis untuk Pemula
        </h3>
        <div className="tips-box">
          <div className="tip-row">
            <span className="material-symbols-outlined">check_circle</span>
            <p>Bebas pakai singkatan sehari-hari: <strong>'rb'</strong>, <strong>'k'</strong> (ribu), atau <strong>'jt'</strong> (juta). Contoh: <em>25k</em>, <em>50rb</em>, <em>2jt</em>.</p>
          </div>
          <div className="tip-row">
            <span className="material-symbols-outlined">check_circle</span>
            <p>Sebut nama tempat atau toko (misal: <em>Indomaret, SPBU, KRL</em>) agar kategori langsung akurat secara otomatis.</p>
          </div>
          <div className="tip-row">
            <span className="material-symbols-outlined">check_circle</span>
            <p>Jika salah mencatat, tinggal ketik: <em>"Hapus catatan kopi tadi"</em> atau klik tombol hapus di riwayat.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightPanel({ period, onPeriodChange, refreshKey, liveSnapshot, onChanged }) {
  const [tab, setTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  // Filter tanggal bebas dari tab Riwayat. Kalau ada isinya {from,to,label},
  // ringkasan (arus kas + tren + kategori) ikut tanggal itu.
  const [historyRange, setHistoryRange] = useState(null);

  // Snapshot live dari chat terakhir (tanpa fetch ulang) — kalau periodenya sama.
  useEffect(() => {
    if (liveSnapshot && liveSnapshot.summary && liveSnapshot.summary.period === period) {
      setSummary(liveSnapshot.summary);
    }
  }, [liveSnapshot, period]);

  const periodLabel = (PERIODS.find((p) => p.value === period) || {}).label || 'Bulan ini';

  return (
    <>
      <div className="tabs-head">
        <div className="tabs-row">
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? 'tab active' : 'tab'}
                onClick={() => setTab(t.id)}
              >
                <span className="material-symbols-outlined">{t.icon}</span>
                <span className="tab-txt">
                  {t.label}
                  {tab === t.id && <span className="tab-ind" aria-hidden="true" />}
                </span>
              </button>
            ))}
          </div>
          {tab === 'summary' && (
            <div className="period-wrap">
              <button
                type="button"
                className="period-pill"
                aria-expanded={periodOpen}
                aria-haspopup="listbox"
                onClick={() => setPeriodOpen((v) => !v)}
              >
                <span className="material-symbols-outlined cal">calendar_today</span>
                {periodLabel}
                <span className="material-symbols-outlined chev">expand_more</span>
              </button>
              {periodOpen && (
                <div className="period-menu" role="listbox" aria-label="Periode ringkasan">
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="option"
                      aria-selected={p.value === period}
                      className={p.value === period ? 'period-item active' : 'period-item'}
                      onClick={() => { onPeriodChange(p.value); setHistoryRange(null); setPeriodOpen(false); }}
                    >
                      {p.label}
                      {p.value === period && <span className="material-symbols-outlined">check</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'guide' && (
            <span className="guide-badge">Panduan Pemula</span>
          )}
        </div>
      </div>

      <div className="tabs-body">
        {tab === 'summary' && (
          <SummaryChart
            key={`${period}-${refreshKey}-${historyRange ? `${historyRange.from}_${historyRange.to}` : 'preset'}`}
            period={period}
            initialSummary={summary}
            rangeOverride={historyRange}
            onClearRange={() => setHistoryRange(null)}
            onSeeAll={() => setTab('history')}
            refreshKey={refreshKey}
            liveSnapshot={liveSnapshot}
          />
        )}
        {tab === 'history' && (
          <TransactionHistory refreshKey={refreshKey} onChanged={onChanged} period={period} onRangeChange={setHistoryRange} initialCustom={historyRange} />
        )}
        {tab === 'guide' && (
          <GuidePanel />
        )}
      </div>

      {tab === 'guide' && (
        <div className="cta-wrap">
          <button type="button" className="btn-cta" onClick={() => document.getElementById('chat-input')?.focus()}>
            <span className="material-symbols-outlined">edit_note</span>
            Mulai Ketik Transaksi
          </button>
        </div>
      )}
    </>
  );
}

export default InsightPanel;
