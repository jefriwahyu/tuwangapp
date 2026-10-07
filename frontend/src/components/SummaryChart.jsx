import { useEffect, useRef, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const appliedSeq = useRef(0);

  const custom = rangeOverride && rangeOverride.from && rangeOverride.to ? rangeOverride : null;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const range = custom ? { from: custom.from, to: custom.to } : null;
    Promise.all([
      getSummary(period, range),
      getTransactions({ ...(range || {}), period: range ? '' : period, limit: 3, offset: 0 }),
    ])
      .then(([sum, tx]) => {
        if (!alive) return;
        setSummary(sum);
        setActivity((tx && tx.data) || []);
      })
      .catch(() => {
        if (!alive) return;
        setSummary(null);
        setActivity([]);
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
        <div className="flow-box">
          <div className="flow-col">
            <span className="flow-pct in">{pct1(incomePct)}%</span>
            <div className="flow-track">
              <div className="flow-fill in" style={{ height: barH(incomePct, income) + 'px' }}>
                <span className="material-symbols-outlined">arrow_downward</span>
              </div>
            </div>
            <span className="flow-name">Masuk</span>
            <span className="flow-amt in">{formatNum(income)}</span>
          </div>
          <div className="flow-col">
            <span className="flow-pct out">{pct1(expensePct)}%</span>
            <div className="flow-track">
              <div className="flow-fill out" style={{ height: barH(expensePct, expense) + 'px' }}>
                <span className="material-symbols-outlined">arrow_upward</span>
              </div>
            </div>
            <span className="flow-name">Keluar</span>
            <span className="flow-amt out">{formatNum(expense)}</span>
          </div>
        </div>
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
