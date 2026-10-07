import { useEffect, useRef, useState } from "react";
import { getSummary, getTransactions, getTrend } from '../api';
import { catBarColor, getCategoryMeta } from '../lib/categoryMeta';

// Satu-satunya daftar periode — dipakai InsightPanel untuk dropdown.
export const PERIODS = [
  { value: 'today', label: 'Hari ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: 'week', label: '7 hari' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'year', label: 'Tahun ini' },
];

function formatRp(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function formatNum(n) {
  return (n || 0).toLocaleString('id-ID');
}

// Ringkas angka sumbu grafik: 1,2jt / 850rb.
function shortRp(n) {
  const v = Math.abs(n || 0);
  if (v >= 1000000) return ((n / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'jt');
  if (v >= 1000) return (Math.round(n / 1000) + 'rb');
  return String(Math.round(n || 0));
}

// Grafik garis SVG murni: 2 seri (pemasukan hijau, pengeluaran merah),
// tiap bucket jadi 1 titik dan titik-titik dihubungkan garis.
function TrendChart({ buckets, mode }) {
  const W = 560;
  const H = 220;
  const PADL = 44;
  const PADR = 12;
  const PADT = 14;
  const PADB = 28;
  const iw = W - PADL - PADR;
  const ih = H - PADT - PADB;
  const n = buckets.length;
  const showIn = mode !== 'expense';
  const showOut = mode !== 'income';
  const maxV = Math.max(1, ...buckets.map((b) => Math.max(showIn ? (b.income || 0) : 0, showOut ? (b.expense || 0) : 0)));
  const x = (i) => (n === 1 ? PADL + iw / 2 : PADL + (i * iw) / (n - 1));
  const y = (v) => PADT + ih - ((v || 0) / maxV) * ih;
  const coords = (key) => buckets.map((b, i) => [x(i), y(b[key] || 0)]);
  const pts = (key) => coords(key).map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  // Panjang garis untuk efek draw saat pertama dibuka.
  const pathLen = (key) => {
    const c = coords(key);
    let L = 0;
    for (let i = 1; i < c.length; i++) L += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
    return L.toFixed(1);
  };
  const inLen = showIn ? pathLen('income') : 0;
  const outLen = showOut ? pathLen('expense') : 0;
  // Label sumbu-X direnggangkan kalau titik banyak (custom harian).
  const step = n > 12 ? Math.ceil(n / 12) : 1;

  return (
    <svg key={`${mode}-${n}`} viewBox={`0 0 ${W} ${H}`} className="trend-svg" role="img" aria-label="Grafik tren keuangan">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const gy = PADT + ih - f * ih;
        const gv = maxV * f;
        return (
          <g key={f}>
            <line x1={PADL} y1={gy} x2={W - PADR} y2={gy} stroke={f === 0 ? '#cbd5e1' : 'rgba(148,163,184,.25)'} strokeWidth="1" />
            <text x={PADL - 6} y={gy + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{shortRp(gv)}</text>
          </g>
        );
      })}
      {showIn && (
        <polyline
          points={pts('income')}
          fill="none"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trend-line"
          style={{ strokeDasharray: inLen, strokeDashoffset: inLen }}
        />
      )}
      {showOut && (
        <polyline
          points={pts('expense')}
          fill="none"
          stroke="#e11d48"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trend-line trend-line-out"
          style={{ strokeDasharray: outLen, strokeDashoffset: outLen }}
        />
      )}
      {buckets.map((b, i) => (
        <g key={i} className="trend-pt" style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
          {showIn && (
            <circle cx={x(i)} cy={y(b.income)} r="4" fill="#059669" stroke="#fff" strokeWidth="2">
              <title>{b.label}: Pemasukan {formatRp(b.income)}</title>
            </circle>
          )}
          {showOut && (
            <circle cx={x(i)} cy={y(b.expense)} r="4" fill="#e11d48" stroke="#fff" strokeWidth="2">
              <title>{b.label}: Pengeluaran {formatRp(b.expense)}</title>
            </circle>
          )}
          {i % step === 0 && (
            <text
              x={x(i)}
              y={H - 8}
              textAnchor={i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle')}
              fontSize="10"
              fill="#64748b"
            >
              {b.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Label relatif ala mock: Hari ini / Kemarin / tanggal singkat.
function relDay(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    if (sameDay(d, now)) return 'Hari ini';
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (sameDay(d, y)) return 'Kemarin';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function pct1(v) {
  return String(parseFloat(v.toFixed(1)));
}

// Panel ringkasan persis mock: KPI 3 kolom + arus kas + kategori + aktivitas.
// Tanpa carousel, tanpa Chart.js — bar digambar dengan CSS murni.
function SummaryChart({ period, initialSummary, rangeOverride, onClearRange, onSeeAll, refreshKey, liveSnapshot }) {
  const [summary, setSummary] = useState(initialSummary || null);
  const [activity, setActivity] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [trendMode, setTrendMode] = useState('all');
  const [slide, setSlide] = useState(0);
  const touchX = useRef(null);
  const [loading, setLoading] = useState(true);
  const appliedSeq = useRef(0);

  const custom = rangeOverride && rangeOverride.from && rangeOverride.to ? rangeOverride : null;
  // Tren garis hanya didukung backend untuk month/year/custom.
  const trendOn = custom ? true : (period === 'month' || period === 'year');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const range = custom ? { from: custom.from, to: custom.to } : null;
    const trendP = trendOn ? getTrend(period, range).catch(() => null) : Promise.resolve(null);
    Promise.all([
      getSummary(period, range),
      getTransactions({ ...(range || {}), period: range ? '' : period, limit: 3, offset: 0 }),
      trendP,
    ])
      .then(([sum, tx, trend]) => {
        if (!alive) return;
        setSummary(sum);
        setActivity((tx && tx.data) || []);
        setBuckets((trend && trend.buckets) || []);
      })
      .catch(() => {
        if (!alive) return;
        setSummary(null);
        setActivity([]);
        setBuckets([]);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, refreshKey, custom && custom.from, custom && custom.to]);

  // Tempel ringkasan awal / inline dari chat tanpa fetch ulang.
  useEffect(() => {
    if (initialSummary && !custom) setSummary(initialSummary);
  }, [initialSummary, custom]);

  // Tempel ringkasan inline dari respons chat — hanya saat seq baru
  // datang dan periodenya cocok, supaya tiap respons diterapkan.
  useEffect(() => {
    if (liveSnapshot && liveSnapshot.summary
      && liveSnapshot.seq > appliedSeq.current
      && liveSnapshot.summary.period === period
      && !custom) {
      appliedSeq.current = liveSnapshot.seq;
      setSummary(liveSnapshot.summary);
      setLoading(false);
    }
  }, [liveSnapshot, period, custom]);

  const income = (summary && summary.income) || 0;
  const expense = (summary && summary.expense) || 0;
  const incomeCount = (summary && summary.income_count) || 0;
  const expenseCount = (summary && summary.expense_count) || 0;
  const balance = income - expense;

  const periodLabel = (PERIODS.find((p) => p.value === period) || {}).label || 'Bulan ini';
  const rangeSub = custom ? (custom.label || (custom.from + ' – ' + custom.to)) : null;
  const ratioSub = custom ? ('Rasio ' + rangeSub) : ('Rasio ' + periodLabel);

  const surplusPct = income > 0 ? (balance / income) * 100 : 0;
  const health = (() => {
    if (income === 0 && expense === 0) return { cls: 'health-neutral', text: 'Belum ada data' };
    if (income === 0) return { cls: 'health-bad', text: 'Perlu perhatian' };
    const r = expense / income;
    if (r <= 0.5) return { cls: 'health-good', text: 'Kondisi Sehat' };
    if (r <= 0.8) return { cls: 'health-warn', text: 'Waspada' };
    return { cls: 'health-bad', text: 'Boros' };
  })();

  const maxFlow = Math.max(income, expense, 1);
  const incomePct = (income / maxFlow) * 100;
  const expensePct = (expense / maxFlow) * 100;
  const barH = (pct, v) => (v > 0 ? Math.max(6, Math.round((pct / 100) * 86)) : 4);

  const catRows = ((summary && summary.breakdown) || []).filter((b) => b.type === 'expense' && b.total > 0);

  const trendNote = custom
    ? ('Tren ' + rangeSub)
    : (period === 'year' ? 'Tren bulanan tahun ini' : 'Tren mingguan bulan ini');
  const showCarousel = trendOn && buckets.length > 0;

  // Kembali ke slide arus kas saat periode/rentang berubah.
  useEffect(() => { setSlide(0); }, [period, custom && custom.from, custom && custom.to]); // eslint-disable-line react-hooks/exhaustive-deps

  // Geser manual saja — tanpa auto-putar.
  function go(d) {
    setSlide((s) => (s + d + 2) % 2);
  }

  function onTouchStart(e) {
    touchX.current = e.changedTouches[0].clientX;
  }

  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - (touchX.current || 0);
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  }

  const flowBox = (
    <div className="flow-box" key={`flow-${slide}-${period}-${custom ? custom.from + custom.to : ''}-${income}-${expense}`}>
      <div className="flow-col">
        <div className="flow-track">
          <span className="flow-pct in">{pct1(incomePct)}%</span>
          <div className="flow-fill in" style={{ height: barH(incomePct, income) + 'px' }}>
            <span className="material-symbols-outlined">arrow_downward</span>
          </div>
        </div>
        <span className="flow-name">Masuk</span>
        <span className="flow-amt in">{formatNum(income)}</span>
      </div>
      <div className="flow-col">
        <div className="flow-track">
          <span className="flow-pct out">{pct1(expensePct)}%</span>
          <div className="flow-fill out" style={{ height: barH(expensePct, expense) + 'px' }}>
            <span className="material-symbols-outlined">arrow_upward</span>
          </div>
        </div>
        <span className="flow-name">Keluar</span>
        <span className="flow-amt out">{formatNum(expense)}</span>
      </div>
    </div>
  );

  const trendBox = (
    <div className="trend-box" key={`trend-${slide}-${trendMode}-${period}-${custom ? custom.from + custom.to : ''}-${buckets.length}`}>
      <div className="trend-toggle" role="tablist" aria-label="Seri tren">
        {[['all', 'Semua'], ['income', 'Pemasukan'], ['expense', 'Pengeluaran']].map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={trendMode === v}
            className={trendMode === v ? 'trend-chip active' : 'trend-chip'}
            onClick={() => setTrendMode(v)}
          >
            {label}
          </button>
        ))}
      </div>
      <TrendChart buckets={buckets} mode={trendMode} />
      <p className="trend-note">{trendNote}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="sum">
        <div className="insight-skeleton">
          <div className="sk sk-card" />
          <div className="sk sk-card" />
          <div className="sk sk-chart" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="sum">
        <div className="insight-empty">
          <span className="material-symbols-outlined">inbox</span>
          <p>Gagal memuat rekap. Pastikan backend berjalan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sum">
      <div className="kpi-grid">
        <div className="kpi kpi-in">
          <span className="kpi-label">Pemasukan</span>
          <div>
            <span className="kpi-value in">+{formatNum(income)}</span>
            <span className="kpi-sub">{incomeCount} kali log</span>
          </div>
        </div>
        <div className="kpi kpi-out">
          <span className="kpi-label">Pengeluaran</span>
          <div>
            <span className="kpi-value out">-{formatNum(expense)}</span>
            <span className="kpi-sub">{expenseCount} kali log</span>
          </div>
        </div>
        <div className="kpi kpi-net">
          <span className="kpi-label">Sisa Saldo</span>
          <div>
            <span className="kpi-value net">{formatNum(balance)}</span>
            <span className={'kpi-sub' + (balance >= 0 && income > 0 ? ' pos' : '')}>
              {balance >= 0 ? ('Surplus ' + pct1(surplusPct) + '%') : ('Defisit ' + pct1(Math.abs(surplusPct)) + '%')}
            </span>
          </div>
        </div>
      </div>

      <div className="block">
        <div className="block-head">
          <div>
            <h3 className="block-title">Perbandingan Arus Kas</h3>
            <span className="block-sub">{ratioSub}</span>
          </div>
          <span className={'health ' + health.cls}>{health.text}</span>
        </div>
        {showCarousel ? (
          <div
            className="carousel"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="carousel-viewport">
              <div
                className="carousel-track"
                style={{ transform: slide === 0 ? 'translateX(0)' : 'translateX(-100%)' }}
              >
                <div className="carousel-page" aria-hidden={slide !== 0}>
                  {flowBox}
                </div>
                <div className="carousel-page" aria-hidden={slide !== 1}>
                  {trendBox}
                </div>
              </div>
            </div>
            <div className="carousel-dots" role="tablist" aria-label="Pilih grafik">
              {['Arus kas', 'Tren'].map((label, i) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={i === slide}
                  aria-label={'Tampilkan ' + label}
                  title={label}
                  className={i === slide ? 'carousel-dot active' : 'carousel-dot'}
                  onClick={() => setSlide(i)}
                />
              ))}
            </div>
          </div>
        ) : (
          flowBox
        )}
        {custom && (
          <div className="range-banner">
            <span className="material-symbols-outlined">date_range</span>
            <span>{rangeSub} • dari Riwayat.</span>
            <button type="button" className="range-clear" onClick={onClearRange}>Kembali ke {periodLabel}</button>
          </div>
        )}
      </div>

      <div className="block">
        <div className="block-head">
          <h3 className="block-title">Pengeluaran per Kategori</h3>
          <span className="block-sub">Total: {formatRp(expense)}</span>
        </div>
        {catRows.length === 0 ? (
          <p className="block-empty">Belum ada pengeluaran berkategori pada periode ini.</p>
        ) : (
          <div className="cat-list">
            {catRows.map((b, i) => {
              const meta = getCategoryMeta(b.category);
              const pct = expense > 0 ? (b.total / expense) * 100 : 0;
              return (
                <div key={b.category + '-' + i}>
                  <div className="cat-top">
                    <span className="cat-name">
                      <span className="cat-ico" style={{ background: meta.bg, color: meta.fg }}>
                        <span className="material-symbols-outlined">{meta.msym}</span>
                      </span>
                      {b.category}
                    </span>
                    <span>
                      <span className="cat-val">{formatRp(b.total)}</span>
                      <span className="cat-pct">({pct1(pct)}%)</span>
                    </span>
                  </div>
                  <div className="cat-track">
                    <div className="cat-fill" style={{ width: pct + '%', background: catBarColor(i) }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="block">
        <div className="block-head">
          <h3 className="block-title">Aktivitas Terakhir</h3>
          {onSeeAll && (
            <button type="button" className="link-btn" onClick={onSeeAll}>Lihat Semua</button>
          )}
        </div>
        {activity.length === 0 ? (
          <p className="block-empty">Belum ada aktivitas pada periode ini.</p>
        ) : (
          <div className="act-list">
            {activity.map((tx) => {
              const meta = getCategoryMeta(tx.category);
              const isIn = tx.type === 'income';
              return (
                <div key={tx.id} className="act-item">
                  <div className="act-left">
                    <span className="act-ico" style={{ background: meta.bg, color: meta.fg }}>
                      <span className="material-symbols-outlined">{meta.msym}</span>
                    </span>
                    <div>
                      <span className="act-name">{tx.description || tx.category || (isIn ? 'Pemasukan' : 'Pengeluaran')}</span>
                      <span className={'act-sub' + (isIn ? ' in' : ' out')}>
                        {isIn ? 'Pemasukan' : 'Pengeluaran'} • {relDay(tx.created_at)}
                      </span>
                    </div>
                  </div>
                  <strong className={'act-amt' + (isIn ? ' in' : ' out')}>
                    {isIn ? '+' : '-'}{formatRp(tx.amount)}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SummaryChart;
