import { useEffect, useState } from "react";
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Tooltip, Legend,
} from 'chart.js';
import { getSummary, getTrend } from '../api';
import { catBarColor, getCategoryMeta } from '../lib/categoryMeta';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

// Satu-satunya daftar periode — dipakai InsightPanel untuk dropdown.
export const PERIODS = [
  { value: 'today', label: 'Hari ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: 'week', label: '7 hari' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'year', label: 'Tahun ini' },
];

const PERIOD_TREND_LABEL = {
  month: 'Tren mingguan bulan ini',
  year: 'Tren bulanan tahun ini',
  today: 'Tren hari ini',
  yesterday: 'Tren kemarin',
  week: 'Tren 7 hari terakhir',
};

function formatRp(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function shortRp(n) {
  const v = Math.abs(n || 0);
  if (v >= 1000000) return ((n / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'jt');
  if (v >= 1000) return (Math.round(n / 1000) + 'rb');
  return String(Math.round(n || 0));
}

// Slide arus kas: ringkasan uang + bar pemasukan vs pengeluaran.
function FlowSlide({ income, expense, incomeCount, expenseCount, customLabel, onClear, onSeeAll }) {
  const balance = income - expense;
  const chartData = {
    labels: ['Arus kas'],
    datasets: [
      { label: 'Pemasukan', data: [income], backgroundColor: '#10b981', borderRadius: 10, barThickness: 26 },
      { label: 'Pengeluaran', data: [expense], backgroundColor: '#f59e0b', borderRadius: 10, barThickness: 26 },
    ],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, boxHeight: 12, borderRadius: 6, useBorderRadius: true, font: { size: 12, weight: 700 } },
      },
      tooltip: {
        callbacks: { label: (ctx) => (' ' + ctx.dataset.label + ': ' + formatRp(ctx.raw)) },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => shortRp(v), font: { size: 11 }, color: '#94a3b8' },
        grid: { color: 'rgba(148,163,184,0.15)' },
      },
      x: { grid: { display: false }, ticks: { font: { size: 12 }, color: '#64748b' } },
    },
  };

  return (
    <div className="flow-box">
      <div className="stat-grid">
        <div className="stat stat-in">
          <span className="stat-icon">💰</span>
          <span className="stat-label">Pemasukan{incomeCount > 0 ? (' • ' + incomeCount + 'x') : ''}</span>
          <strong className="stat-value in">{formatRp(income)}</strong>
        </div>
        <div className="stat stat-out">
          <span className="stat-icon">💸</span>
          <span className="stat-label">Pengeluaran{expenseCount > 0 ? (' • ' + expenseCount + 'x') : ''}</span>
          <strong className="stat-value out">{formatRp(expense)}</strong>
        </div>
        <div className={'stat stat-balance' + (balance < 0 ? ' neg' : '')}>
          <span className="stat-icon">{balance < 0 ? '⚠️' : '✨'}</span>
          <span className="stat-label">Saldo</span>
          <strong className="stat-value">{formatRp(balance)}</strong>
        </div>
      </div>
      <div className="insight-chart">
        <Bar data={chartData} options={chartOptions} />
      </div>
      {customLabel && (
        <div className="range-banner">
          <span className="material-symbols-outlined">date_range</span>
          <span>Filter riwayat: {customLabel}</span>
          <button type="button" className="range-clear" onClick={onClear}>Kembali ke preset</button>
        </div>
      )}
      {onSeeAll && (
        <button type="button" className="tx-more" onClick={onSeeAll}>
          Lihat semua transaksi
        </button>
      )}
    </div>
  );
}

// Slide tren: garis pemasukan vs pengeluaran per bucket waktu.
function TrendSlide({ buckets, trendNote }) {
  const labels = (buckets || []).map((b) => b.label);
  const data = {
    labels,
    datasets: [
      {
        label: 'Pemasukan',
        data: (buckets || []).map((b) => b.income || 0),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.15)',
        tension: 0.35,
        fill: true,
        pointRadius: 3,
      },
      {
        label: 'Pengeluaran',
        data: (buckets || []).map((b) => b.expense || 0),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.12)',
        tension: 0.35,
        fill: true,
        pointRadius: 3,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, boxHeight: 12, borderRadius: 6, useBorderRadius: true, font: { size: 12, weight: 700 } },
      },
      tooltip: {
        callbacks: { label: (ctx) => (' ' + ctx.dataset.label + ': ' + formatRp(ctx.raw)) },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => shortRp(v), font: { size: 11 }, color: '#94a3b8' },
        grid: { color: 'rgba(148,163,184,0.15)' },
      },
      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#64748b', maxTicksLimit: 6 } },
    },
  };

  if (!buckets || buckets.length === 0) {
    return (
      <div className="trend-box">
        <div className="insight-empty">
          <span>📈</span>
          <p>Belum ada data tren pada periode ini.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trend-box">
      <div className="insight-chart">
        <Line data={data} options={options} />
      </div>
      {trendNote && <p className="trend-note">{trendNote}</p>}
    </div>
  );
}

// Slide kategori: bar horizontal per kategori + ikon Material Symbols.
function CategorySlide({ breakdown }) {
  const rows = (breakdown || []).filter((b) => b.type === 'expense' && b.total > 0);
  const catLabels = rows.map((b) => b.category);
  const catTotals = rows.map((b) => b.total);
  const catData = {
    labels: catLabels,
    datasets: [
      {
        label: 'Pengeluaran',
        data: catTotals,
        backgroundColor: catLabels.map((_, i) => catBarColor(i)),
        borderRadius: 8,
      },
    ],
  };
  const catOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => (' ' + formatRp(ctx.raw)) } },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { callback: (v) => shortRp(v), font: { size: 11 }, color: '#94a3b8', maxTicksLimit: 5 },
        grid: { color: 'rgba(148,163,184,0.15)' },
      },
      y: { grid: { display: false }, ticks: { font: { size: 12 }, color: '#334155', autoSkip: false } },
    },
  };

  if (rows.length === 0) {
    return (
      <div className="insight-empty">
        <span>🧾</span>
        <p>Belum ada pengeluaran berkategori pada periode ini.</p>
      </div>
    );
  }

  return (
    <div>
      <ul className="cat-list">
        {rows.map((b, i) => {
          const meta = getCategoryMeta(b.category);
          return (
            <li key={(b.category + '-' + i)} className="cat-row">
              <span className="cat-ico" style={{ background: meta.bg, color: meta.fg }}>
                <span className="material-symbols-outlined">{meta.msym}</span>
              </span>
              <span className="cat-name">{b.category}</span>
              <strong className="cat-total">{formatRp(b.total)}</strong>
            </li>
          );
        })}
      </ul>
      <h4 className="insight-subtitle">Grafik per kategori</h4>
      <div className="insight-chart insight-chart-cat">
        <Bar data={catData} options={catOptions} />
      </div>
    </div>
  );
}

const SLIDES = [
  { id: 'flow', label: 'Arus kas' },
  { id: 'trend', label: 'Tren' },
  { id: 'category', label: 'Kategori' },
];

function SummaryChart({ period, initialSummary, rangeOverride, onClearRange, onSeeAll, refreshKey, liveSnapshot }) {
  const [slide, setSlide] = useState(0);
  const [summary, setSummary] = useState(initialSummary || null);
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);

  const custom = rangeOverride && rangeOverride.from && rangeOverride.to ? rangeOverride : null;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const range = custom ? { from: custom.from, to: custom.to } : null;
    Promise.all([getSummary(period, range), getTrend(period, range)])
      .then(([sum, trend]) => {
        if (!alive) return;
        setSummary(sum);
        setBuckets((trend && trend.buckets) || []);
      })
      .catch(() => {
        if (!alive) return;
        setSummary(null);
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

  // Tempel ringkasan inline dari respons chat — tanpa fetch ulang.
  // Pola "adjust state saat props berubah": hanya dijalankan saat seq
  // baru datang dan periodenya cocok, supaya tiap respons diterapkan
  // walau angkanya sama, dan periode beda diabaikan.
  const [appliedSeq, setAppliedSeq] = useState(0);
  if (liveSnapshot && liveSnapshot.summary
    && liveSnapshot.seq > appliedSeq
    && liveSnapshot.summary.period === period
    && !custom) {
    setAppliedSeq(liveSnapshot.seq);
    setSummary(liveSnapshot.summary);
    setLoading(false);
  }

  const income = (summary && summary.income) || 0;
  const expense = (summary && summary.expense) || 0;
  const incomeCount = (summary && summary.income_count) || 0;
  const expenseCount = (summary && summary.expense_count) || 0;
  const trendNote = custom
    ? ('Tren ' + custom.from + ' ke ' + custom.to)
    : (PERIOD_TREND_LABEL[period] || PERIOD_TREND_LABEL.month);

  function go(dir) {
    setSlide((s) => (s + dir + SLIDES.length) % SLIDES.length);
  }

  return (
    <div className="insight-card">
      <div className="insight-head">
        <div>
          <h3 className="insight-title">Ringkasan Keuangan</h3>
          <p className="insight-sub">Pantau arus kasmu secara real-time</p>
        </div>
      </div>

      {loading ? (
        <div className="insight-skeleton">
          <div className="sk sk-card" />
          <div className="sk sk-card" />
          <div className="sk sk-chart" />
        </div>
      ) : !summary ? (
        <div className="insight-empty">
          <span>📭</span>
          <p>Gagal memuat rekap. Pastikan backend berjalan.</p>
        </div>
      ) : (
        <>
          <div className="carousel-bar">
            <button type="button" className="carousel-nav" aria-label="Slide sebelumnya" onClick={() => go(-1)}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <div className="carousel-tabs" role="tablist" aria-label="Jenis ringkasan">
              {SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={i === slide}
                  className={i === slide ? 'carousel-tab active' : 'carousel-tab'}
                  onClick={() => setSlide(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button type="button" className="carousel-nav" aria-label="Slide berikutnya" onClick={() => go(1)}>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          <div className="carousel-slide">
            {slide === 0 && (
              <FlowSlide
                income={income}
                expense={expense}
                incomeCount={incomeCount}
                expenseCount={expenseCount}
                customLabel={custom && custom.label}
                onClear={onClearRange}
                onSeeAll={onSeeAll}
              />
            )}
            {slide === 1 && <TrendSlide buckets={buckets} trendNote={trendNote} />}
            {slide === 2 && <CategorySlide breakdown={summary && summary.breakdown} />}
          </div>
          <p className="insight-tip">
            Tips: ketik <code>rekap bulan ini</code> di chat untuk update otomatis.
          </p>
        </>
      )}
    </div>
  );
}

export default SummaryChart;
