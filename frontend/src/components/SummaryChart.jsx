import { useEffect, useState } from "react";
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { getSummary } from '../api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const PERIODS = [
  { value: 'week', label: 'Minggu' },
  { value: 'month', label: 'Bulan' },
  { value: 'year', label: 'Tahun' },
];

function formatRp(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function SummaryChart({ period, onPeriodChange, refreshKey, liveSnapshot }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getSummary(period)
      .then((data) => { if (alive) setSummary(data); })
      .catch(() => { if (alive) setSummary(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [period, refreshKey]);

  // Tempel ringkasan inline dari respons chat — tanpa fetch ulang.
  // Pola "adjust state saat props berubah": hanya dijalankan saat seq
  // baru datang dan periodenya cocok, supaya tiap respons diterapkan
  // walau angkanya sama, dan periode beda diabaikan.
  const [appliedSeq, setAppliedSeq] = useState(0);
  if (liveSnapshot?.summary
    && liveSnapshot.seq > appliedSeq
    && liveSnapshot.summary.period === period) {
    setAppliedSeq(liveSnapshot.seq);
    setSummary(liveSnapshot.summary);
    setLoading(false);
  }

  const income = summary?.income || 0;
  const expense = summary?.expense || 0;
  const balance = income - expense;
  const breakdown = (summary?.breakdown || []).filter((b) => b.type === 'expense' && b.total > 0);
  const catLabels = breakdown.map((b) => b.category);
  const catTotals = breakdown.map((b) => b.total);

  const palette = ['#10b981', '#f59e0b', '#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#34d399', '#fb7185', '#60a5fa', '#a3e635', '#fbbf24', '#2dd4bf'];

  const catData = {
    labels: catLabels,
    datasets: [
      {
        label: 'Pengeluaran',
        data: catTotals,
        backgroundColor: catLabels.map((_, i) => palette[i % palette.length]),
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
      tooltip: {
        callbacks: { label: (ctx) => ` ${formatRp(ctx.raw)}` },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: (v) => v >= 1000000 ? `${v / 1000000}jt` : v >= 1000 ? `${v / 1000}rb` : v,
          font: { size: 11 },
          color: '#94a3b8',
          maxTicksLimit: 5,
        },
        grid: { color: 'rgba(148,163,184,0.15)' },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 12 }, color: '#334155', autoSkip: false },
      },
    },
  };

  const chartData = {
    labels: ['Keuangan'],
    datasets: [
      {
        label: 'Pemasukan',
        data: [income],
        backgroundColor: '#10b981',
        borderRadius: 10,
        barThickness: 26,
      },
      {
        label: 'Pengeluaran',
        data: [expense],
        backgroundColor: '#f59e0b',
        borderRadius: 10,
        barThickness: 26,
      },
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
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatRp(ctx.raw)}` },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (v) => v >= 1000000 ? `${v / 1000000}jt` : v >= 1000 ? `${v / 1000}rb` : v,
          font: { size: 11 },
          color: '#94a3b8',
        },
        grid: { color: 'rgba(148,163,184,0.15)' },
      },
      x: { grid: { display: false }, ticks: { font: { size: 12 }, color: '#64748b' } },
    },
  };

  return (
    <div className="insight-card">
      <div className="insight-head">
        <div>
          <h3 className="insight-title">Ringkasan Keuangan</h3>
          <p className="insight-sub">Pantau arus kasmu secara real-time</p>
        </div>
        <div className="insight-periods">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={period === p.value ? 'insight-period active' : 'insight-period'}
              onClick={() => onPeriodChange(p.value)}
            >
              {p.label}
            </button>
          ))}
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
          <div className="stat-grid">
            <div className="stat stat-in">
              <span className="stat-icon">💰</span>
              <span className="stat-label">Pemasukan</span>
              <strong className="stat-value in">{formatRp(income)}</strong>
            </div>
            <div className="stat stat-out">
              <span className="stat-icon">💸</span>
              <span className="stat-label">Pengeluaran</span>
              <strong className="stat-value out">{formatRp(expense)}</strong>
            </div>
            <div className={`stat stat-balance ${balance < 0 ? 'neg' : ''}`}>
              <span className="stat-icon">{balance < 0 ? '⚠️' : '✨'}</span>
              <span className="stat-label">Saldo</span>
              <strong className="stat-value">{formatRp(balance)}</strong>
            </div>
          </div>
          <div className="insight-chart">
            <Bar data={chartData} options={chartOptions} />
          </div>
          {breakdown.length > 0 && (
            <>
              <h4 className="insight-subtitle">Pengeluaran per kategori</h4>
              <div className="insight-chart insight-chart-cat">
                <Bar data={catData} options={catOptions} />
              </div>
            </>
          )}
          <p className="insight-tip">
            💡 Tips: ketik <code>rekap bulan ini</code> di chat untuk update otomatis.
          </p>
        </>
      )}
    </div>
  );
}

export default SummaryChart;
