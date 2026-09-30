import { useEffect, useState } from 'react';
import { deleteTransaction, getTransactions } from '../api';

const PAGE_SIZE = 10;

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

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function TransactionHistory({ refreshKey, onChanged }) {
  const [to, setTo] = useState(todayStr());
  const [from, setFrom] = useState('');
  const [applied, setApplied] = useState({ from: '', to: '' });
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

  function applyFilter() {
    setApplied({ from, to });
  }

  function resetFilter() {
    setFrom('');
    setTo(todayStr());
    setApplied({ from: '', to: '' });
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
  }

  async function handleDelete(tx) {
    const label = `${tx.category || (tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran')} ${formatRp(tx.amount)}`;
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

  return (
    <div className="insight-card">
      <div className="insight-head">
        <div>
          <h3 className="insight-title">Riwayat Transaksi</h3>
          <p className="insight-sub">Semua catatan tersimpan di sini</p>
        </div>
      </div>

      <div className="tx-filters">
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
      </div>

      {loading ? (
        <div className="insight-skeleton">
          <div className="sk sk-card" />
          <div className="sk sk-card" />
        </div>
      ) : error ? (
        <div className="insight-empty">
          <span>📭</span>
          <p>Gagal memuat riwayat. Pastikan backend berjalan.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="insight-empty">
          <span>🧾</span>
          <p>Belum ada transaksi pada rentang ini.</p>
        </div>
      ) : (
        <>
          <ul className="tx-list">
            {items.map((tx) => (
              <li key={tx.id} className="tx-item">
                <span className="tx-icon">{tx.type === 'income' ? '💰' : '💸'}</span>
                <div className="tx-main">
                  <strong className="tx-cat">{tx.category || (tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran')}</strong>
                  <span className="tx-date">{formatDate(tx.created_at)}</span>
                </div>
                <strong className={tx.type === 'income' ? 'tx-amount in' : 'tx-amount out'}>
                  {tx.type === 'income' ? '+' : '-'}{formatRp(tx.amount)}
                </strong>
                <button
                  type="button"
                  className="tx-del"
                  title="Hapus transaksi"
                  onClick={() => handleDelete(tx)}
                  disabled={deletingId === tx.id}
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
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
