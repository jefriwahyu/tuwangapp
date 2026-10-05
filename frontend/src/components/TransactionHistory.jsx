import { useEffect, useMemo, useState } from 'react';
import { deleteTransaction, getTransactions } from '../api';
import { getCategoryMeta } from '../lib/categoryMeta';

const PAGE_SIZE = 50;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatRp(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Kelompok tanggal ala mock: Hari Ini / Kemarin / Riwayat Sebelumnya.
function groupOf(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return 'today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'yesterday';
  return 'older';
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
}

function fmtDayLong(iso) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function monthLabel(isoDate) {
  try {
    const d = isoDate ? new Date(isoDate + 'T00:00:00') : new Date();
    return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

const TYPE_CHIPS = [
  { id: 'all', label: 'Semua' },
  { id: 'income', label: 'Pemasukan' },
  { id: 'expense', label: 'Pengeluaran' },
];

function TransactionHistory({ refreshKey, onChanged, period, onRangeChange, initialCustom }) {
  void period;
  const [to, setTo] = useState((initialCustom && initialCustom.to) || todayStr());
  const [from, setFrom] = useState((initialCustom && initialCustom.from) || '');
  const [applied, setApplied] = useState(
    initialCustom && initialCustom.from
      ? { from: initialCustom.from, to: initialCustom.to }
      : { from: '', to: '' },
  );
  const [query, setQuery] = useState('');
  const [typeChip, setTypeChip] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function load(reset, filter) {
    const f = filter || applied;
    if (reset) {
      setLoading(true);
      setError(false);
    } else {
      setLoadingMore(true);
    }
    try {
      const data = await getTransactions({
        from: f.from,
        to: f.to,
        limit: PAGE_SIZE,
        offset: reset ? 0 : items.length,
      });
      const rows = data.data || [];
      setItems((prev) => (reset ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      if (reset) setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Muat ulang saat filter diterapkan atau ada transaksi baru dari chat.
  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, refreshKey]);

  function notifyRange(f) {
    if (onRangeChange) {
      if (f.from && f.to) {
        const fmtShort = (iso) => {
          try {
            return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          } catch {
            return iso;
          }
        };
        onRangeChange({ from: f.from, to: f.to, label: (fmtShort(f.from) + ' – ' + fmtShort(f.to)) });
      } else {
        onRangeChange(null);
      }
    }
  }

  function applyFilter() {
    const f = { from, to };
    setApplied(f);
    notifyRange(f);
  }

  function resetFilter() {
    setFrom('');
    setTo(todayStr());
    setApplied({ from: '', to: '' });
    if (onRangeChange) onRangeChange(null);
  }

  function preset(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const f = { from: fmt(start), to: fmt(end) };
    setFrom(f.from);
    setTo(f.to);
    setApplied(f);
    notifyRange(f);
  }

  async function handleDelete(tx) {
    const label = `${tx.description || tx.category || (tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran')} ${formatRp(tx.amount)}`;
    if (!window.confirm(`Yakin hapus ${label}?`)) return;
    setDeletingId(tx.id);
    try {
      await deleteTransaction(tx.id);
      setItems((prev) => prev.filter((row) => row.id !== tx.id));
      if (onChanged) onChanged();
    } catch (err) {
      window.alert(err.message || 'Gagal menghapus transaksi');
    } finally {
      setDeletingId(null);
    }
  }

  // Saring lokal ala mock: query teks + chip tipe. Filter tanggal tetap
  // di server (applied) supaya ringkasan global ikut tanggal itu.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((tx) => {
      if (typeChip !== 'all' && tx.type !== typeChip) return false;
      if (!q) return true;
      const hay = `${tx.description || ''} ${tx.category || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, typeChip]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    visible.forEach((tx) => {
      if (tx.type === 'income') income += tx.amount || 0;
      else expense += tx.amount || 0;
    });
    return { income, expense, net: income - expense, count: visible.length };
  }, [visible]);

  const groups = useMemo(() => {
    const g = { today: [], yesterday: [], older: [] };
    visible.forEach((tx) => g[groupOf(tx.created_at)].push(tx));
    return g;
  }, [visible]);

  function monthPreset() {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const f = { from: fmt(start), to: fmt(end) };
    setFrom(f.from);
    setTo(f.to);
    setApplied(f);
    notifyRange(f);
  }

  function groupTitle(key) {
    if (key === 'today') return `Hari Ini — ${fmtDayLong(new Date().toISOString())}`;
    if (key === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return `Kemarin — ${fmtDayLong(y.toISOString())}`;
    }
    return 'Riwayat Sebelumnya';
  }

  function rowSub(tx, groupKey) {
    const meta = tx.category || (tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran');
    const when = groupKey === 'older' ? fmtDayLong(tx.created_at) : fmtTime(tx.created_at);
    return `${meta} • ${when}`;
  }

  return (
    <div className="hx-stack">
      <div className="hx-toolbar">
        <div className="hx-search">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari catatan transaksi..."
            aria-label="Cari catatan transaksi"
          />
        </div>
        <div className="hx-chiprow">
          <div className="hx-chips">
            {TYPE_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={typeChip === c.id ? 'hx-chip active' : 'hx-chip'}
                onClick={() => setTypeChip(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button type="button" className="hx-month" onClick={monthPreset} title="Tampilkan bulan berjalan">
            <span className="material-symbols-outlined">calendar_today</span>
            {monthLabel(applied.from)}
            <span className="material-symbols-outlined">expand_more</span>
          </button>
        </div>
        <details className="hx-dates">
          <summary>Filter tanggal khusus</summary>
          <div className="tx-dates">
            <label>
              Dari
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Sampai
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <div className="tx-actions">
            <button type="button" className="insight-period" onClick={() => preset(7)}>7 hari</button>
            <button type="button" className="insight-period" onClick={applyFilter}>Terapkan</button>
            <button type="button" className="insight-period" onClick={resetFilter}>Reset</button>
          </div>
          {applied.from && applied.to && (
            <p className="hx-applied">Menampilkan {applied.from} – {applied.to}. Ringkasan ikut rentang ini.</p>
          )}
        </details>
      </div>

      {loading ? (
        <div className="insight-skeleton">
          <div className="sk sk-card" />
          <div className="sk sk-card" />
        </div>
      ) : error ? (
        <div className="insight-empty">
          <span className="material-symbols-outlined">inbox</span>
          <p>Gagal memuat riwayat. Pastikan backend berjalan.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="insight-empty">
          <span className="material-symbols-outlined">receipt_long</span>
          <p>{items.length === 0 ? 'Belum ada transaksi pada rentang ini.' : 'Tidak ada yang cocok dengan pencarian.'}</p>
        </div>
      ) : (
        <>
          <div className="hx-total">
            <div className="hx-total-id">
              <span className="hx-total-ico">
                <span className="material-symbols-outlined">receipt_long</span>
              </span>
              <div>
                <span className="hx-total-label">Total Transaksi</span>
                <span className="hx-total-count">{totals.count} Catatan <em>({monthLabel(applied.from)})</em></span>
              </div>
            </div>
            <div className="hx-total-net">
              <span className="hx-total-label">Saldo Bersih</span>
              <strong className={totals.net >= 0 ? 'hx-net in' : 'hx-net out'}>
                {totals.net >= 0 ? '+' : '-'}{formatRp(Math.abs(totals.net))}
              </strong>
            </div>
          </div>

          {['today', 'yesterday', 'older'].filter((k) => groups[k].length > 0).map((key) => (
            <div key={key} className="hx-group">
              <div className="hx-group-head">
                <h2>{groupTitle(key)}</h2>
                <span>{groups[key].length} transaksi</span>
              </div>
              <ul className="tx-list hx-list">
                {groups[key].map((tx) => {
                  const meta = getCategoryMeta(tx.category);
                  const income = tx.type === 'income';
                  return (
                    <li key={tx.id} className="tx-item hx-item">
                      <span className="hx-ico" style={{ background: meta.bg, color: meta.fg }}>
                        <span className="material-symbols-outlined">{meta.msym}</span>
                      </span>
                      <div className="tx-main">
                        <strong className="tx-cat">{tx.description || tx.category || (income ? 'Pemasukan' : 'Pengeluaran')}</strong>
                        <span className="tx-date">
                          {rowSub(tx, key)} • <span className="hx-via">Via Chat</span>
                        </span>
                      </div>
                      <div className="hx-right">
                        <strong className={income ? 'tx-amount in' : 'tx-amount out'}>
                          {income ? '+' : '-'}{formatRp(tx.amount)}
                        </strong>
                        <button
                          type="button"
                          className="hx-del"
                          title="Hapus transaksi"
                          onClick={() => handleDelete(tx)}
                          disabled={deletingId === tx.id}
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {hasMore && (
            <button
              type="button"
              className="tx-more"
              onClick={() => load(false)}
              disabled={loadingMore}
            >
              {loadingMore ? 'Memuat...' : 'Muat lagi'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default TransactionHistory;
