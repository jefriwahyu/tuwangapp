import { useEffect, useState } from "react";
import { getSummary, getTransactions } from '../api';
import { catBarColor, getCategoryMeta } from '../lib/categoryMeta';

// Satu-satunya daftar periode — dipakai InsightPanel untuk dropdown.
export const PERIODS = [
  { value: 'today', label: 'Hari ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: 'week', label: '7 hari' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'year', label: 'Tahun ini' },
];

// Kartu ringkasan gaya mock Stitch: KPI + rasio + kategori + aktivitas.
function formatNum(n) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n || 0);
}

function FlowKpi({ income, expense, incomeCount, expenseCount }) {
  const balance = income - expense;
  const pct = income > 0 ? (balance / income) * 100 : 0;
  const pctText = balance >= 0
    ? ('Surplus ' + Math.abs(pct).toFixed(1) + '%')
    : ('Defisit ' + Math.abs(pct).toFixed(1) + '%');
  return (
    <div className="kpi-grid">
      <div className="kpi kpi-in">
        <span className="kpi-label">Pemasukan</span>
        <div className="kpi-body">
          <span className="kpi-value">+{formatNum(income)}</span>
          <span className="kpi-sub">{incomeCount} kali log</span>
        </div>
      </div>
      <div className="kpi kpi-out">
        <span className="kpi-label">Pengeluaran</span>
        <div className="kpi-body">
          <span className="kpi-value">-{formatNum(expense)}</span>
          <span className="kpi-sub">{expenseCount} kali log</span>
        </div>
      </div>
      <div className="kpi kpi-balance">
        <span className="kpi-label">Sisa Saldo</span>
        <div className="kpi-body">
          <span className="kpi-value">{formatNum(balance)}</span>
          <span className={balance >= 0 ? 'kpi-sub good' : 'kpi-sub bad'}>{pctText}</span>
        </div>
      </div>
    </div>
  );
}

function FlowRatio({ income, expense, ratioLabel }) {
  const balance = income - expense;
  const max = Math.max(income, expense, 1);
  const inPct = income > 0 ? (income / max) * 100 : 0;
  const outPct = expense > 0 ? (expense / max) * 100 : 0;
  const fmtPct = (v) => (v >= 99.95 ? '100%' : (v.toFixed(1) + '%'));
  const barH = (v) => (v <= 0 ? 6 : Math.max(24, Math.round((86 * v) / max)));
  const healthy = balance >= 0;
  return (
    <div className="flow-card">
      <div className="flow-head">
        <div>
          <h3>Perbandingan Arus Kas</h3>
          <span>Rasio {ratioLabel}</span>
        </div>
        <span className={healthy ? 'health-badge ok' : 'health-badge warn'}>
          {healthy ? 'Kondisi Sehat' : 'Perlu Perhatian'}
        </span>
      </div>
      <div className="flow-bars">
        <div className="flow-col">
          <span className="flow-pct in">{fmtPct(inPct)}</span>
          <div className="flow-bar in" style={{ height: barH(income) + 'px' }}>
            <span className="material-symbols-outlined">arrow_downward</span>
          </div>
          <div className="flow-cap">
            <span className="flow-cap-name">Masuk</span>
            <span className="flow-cap-val in">{formatNum(income)}</span>
          </div>
        </div>
        <div className="flow-col">
          <span className="flow-pct out">{fmtPct(outPct)}</span>
          <div className="flow-bar out" style={{ height: barH(expense) + 'px' }}>
            <span className="material-symbols-outlined">arrow_upward</span>
          </div>
          <div className="flow-cap">
            <span className="flow-cap-name">Keluar</span>
            <span className="flow-cap-val out">{formatNum(expense)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowSlide({ income, expense, incomeCount, expenseCount, customLabel, periodLabel, onClear, onSeeAll }) {
  void onSeeAll;
  return (
    <div className="flow-box">
      <FlowKpi income={income} expense={expense} incomeCount={incomeCount} expenseCount={expenseCount} />
      <FlowRatio income={income} expense={expense} ratioLabel={customLabel || periodLabel} />
      {customLabel && (
        <div className="range-banner">
          <span className="material-symbols-outlined">date_range</span>
          <span>Filter riwayat: {customLabel}</span>
          <button type="button" className="range-clear" onClick={onClear}>Kembali ke preset</button>
        </div>
      )}
    </div>
  );
}

// Kartu kategori gaya mock: baris ikon + nama + nominal + persen + progress bar.
function CategorySlide({ breakdown, expense }) {
  const rows = (breakdown || []).filter((b) => b.type === 'expense' && b.total > 0);
  const total = expense || rows.reduce((s, b) => s + (b.total || 0), 0);
  if (rows.length === 0) {
    return (
      <div className="cat-card">
        <div className="cat-head">
          <h3>Pengeluaran per Kategori</h3>
        </div>
        <div className="insight-empty">
          <span className="material-symbols-outlined">receipt_long</span>
          <p>Belum ada pengeluaran berkategori pada periode ini.</p>
        </div>
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => (b.total || 0) - (a.total || 0));
  return (
    <div className="cat-card">
      <div className="cat-head">
        <h3>Pengeluaran per Kategori</h3>
        <span>Total: Rp{formatNum(total)}</span>
      </div>
      <div className="cat-bars">
        {sorted.map((b, i) => {
          const meta = getCategoryMeta(b.category);
          const pct = total > 0 ? ((b.total / total) * 100) : 0;
          const pctText = pct >= 99.95 ? '100%' : (pct.toFixed(1) + '%');
          const barColor = catBarColor(i);
          return (
            <div key={(b.category + '-' + i)} className="cat-bar-row">
              <div className="cat-bar-top">
                <div className="cat-bar-id">
                  <span className="cat-bar-ico" style={{ background: meta.bg, color: meta.fg }}>
                    <span className="material-symbols-outlined">{meta.msym}</span>
                  </span>
                  <span className="cat-bar-name">{b.category}</span>
                </div>
                <div className="cat-bar-val">
                  <strong>Rp{formatNum(b.total)}</strong>
                  <span>({pctText})</span>
                </div>
              </div>
              <div className="cat-track">
                <div className="cat-fill" style={{ width: Math.max(pct, 2) + '%', background: barColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function relDay(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, now)) return 'Hari ini';
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (sameDay(d, y)) return 'Kemarin';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

// Kartu aktivitas terakhir gaya mock: 3 transaksi terbaru + Lihat Semua.
function ActivityCard({ items, onSeeAll }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="act-card">
      <div className="act-head">
        <h3>Aktivitas Terakhir</h3>
        <button type="button" className="act-more" onClick={onSeeAll}>Lihat Semua</button>
      </div>
      <div className="act-list">
        {items.slice(0, 3).map((tx) => {
          const meta = getCategoryMeta(tx.category);
          const income = tx.type === 'income';
          return (
            <div key={tx.id} className="act-row">
              <div className="act-id">
                <span className="act-ico" style={{ background: meta.bg, color: meta.fg }}>
                  <span className="material-symbols-outlined">{meta.msym}</span>
                </span>
                <div>
                  <span className="act-name">{tx.description || tx.category || (income ? 'Pemasukan' : 'Pengeluaran')}</span>
                  <span className={income ? 'act-sub in' : 'act-sub out'}>
                    {income ? 'Pemasukan' : 'Pengeluaran'} • {relDay(tx.created_at)}
                  </span>
                </div>
              </div>
              <span className={income ? 'act-amt in' : 'act-amt out'}>
                {income ? '+' : '-'}Rp{formatNum(tx.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryChart({ period, initialSummary, rangeOverride, onClearRange, onSeeAll, refreshKey, liveSnapshot }) {
  const [summary, setSummary] = useState(initialSummary || null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const custom = rangeOverride && rangeOverride.from && rangeOverride.to ? rangeOverride : null;
  const periodLabel = (PERIODS.find((p) => p.value === period) || {}).label || 'Bulan ini';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const range = custom ? { from: custom.from, to: custom.to } : null;
    Promise.all([
      getSummary(period, range),
      getTransactions({ from: range?.from || '', to: range?.to || '', limit: 3, offset: 0 }),
    ])
      .then(([sum, tx]) => {
        if (!alive) return;
        setSummary(sum);
        setRecent((tx && tx.data) || []);
      })
      .catch(() => {
        if (!alive) return;
        setSummary(null);
        setRecent([]);
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

  return (
    <div className="insight-stack">
      {loading ? (
        <div className="insight-card">
          <div className="insight-skeleton">
            <div className="sk sk-card" />
            <div className="sk sk-card" />
            <div className="sk sk-chart" />
          </div>
        </div>
      ) : !summary ? (
        <div className="insight-card">
          <div className="insight-empty">
            <span className="material-symbols-outlined">inbox</span>
            <p>Gagal memuat rekap. Pastikan backend berjalan.</p>
          </div>
        </div>
      ) : (
        <>
          <FlowSlide
            income={income}
            expense={expense}
            incomeCount={incomeCount}
            expenseCount={expenseCount}
            customLabel={custom && custom.label}
            periodLabel={periodLabel}
            onClear={onClearRange}
            onSeeAll={onSeeAll}
          />
          <CategorySlide breakdown={summary && summary.breakdown} expense={expense} />
          <ActivityCard items={recent} onSeeAll={onSeeAll} />
        </>
      )}
    </div>
  );
}

export default SummaryChart;
