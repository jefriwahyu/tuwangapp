import { getCategoryMeta } from '../lib/categoryMeta';

function formatRp(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

// Kartu struk inline persis mock: 1 transaksi = baris penuh,
// 2+ transaksi = grid 2 kolom mini.
function SavedCards({ items }) {
  if (!items || items.length === 0) return null;

  if (items.length === 1) {
    const s = items[0];
    const meta = getCategoryMeta(s.category);
    const income = s.type === 'income';
    return (
      <div className="tx-card-single">
        <div className="tx-card-id">
          <span className="tx-card-ico" style={{ background: meta.bg, color: meta.fg }}>
            <span className="material-symbols-outlined">{meta.msym}</span>
          </span>
          <div className="tx-card-meta">
            <p>{s.description || s.category || 'Transaksi'}</p>
            <span>{s.category || (income ? 'Pemasukan' : 'Pengeluaran')}</span>
          </div>
        </div>
        <strong className={income ? 'amt-in' : 'amt-out'}>
          {income ? '+' : '-'}{formatRp(s.amount)}
        </strong>
      </div>
    );
  }

  return (
    <div className="tx-card-grid">
      {items.map((s, i) => {
        const meta = getCategoryMeta(s.category);
        const income = s.type === 'income';
        return (
          <div key={i} className={income ? 'tx-mini in' : 'tx-mini out'}>
            <span className="material-symbols-outlined">{meta.msym}</span>
            <div>
              <p>{s.description || s.category || 'Transaksi'}</p>
              <strong>{income ? '+' : '-'}{formatRp(s.amount)}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChatBubble({ sender, text, time, saved, confirmDelete, deleteDone, userInitial, onConfirmDelete }) {
  const isUser = sender === 'user';

  if (isUser) {
    return (
      <div className="msg-row user">
        <div className="msg-col-end">
          <div className="bubble-user">
            <p>{text}</p>
          </div>
          <span className="msg-time">
            {time || ''}
            <span className="material-symbols-outlined tick">done_all</span>
          </span>
        </div>
        <span className="msg-avatar user">{userInitial || 'U'}</span>
      </div>
    );
  }

  return (
    <div className="msg-row bot">
      <span className="msg-avatar bot" aria-hidden="true">
        <span className="material-symbols-outlined">smart_toy</span>
      </span>
      <div className="msg-col-start">
        <div className="bubble-bot">
          <p className="bubble-text">{text}</p>
          <SavedCards items={saved} />
          {confirmDelete?.length > 0 && (
            <div className="msg-actions">
              {confirmDelete.map((c) => (
                <button
                  key={String(c.id)}
                  type="button"
                  className="msg-act danger"
                  onClick={() => onConfirmDelete?.(c.id)}
                >
                  <span className="material-symbols-outlined">delete</span>
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {deleteDone && (
            <p className="msg-synced">
              <span className="material-symbols-outlined">check_circle</span>
              Transaksi dihapus. Riwayat ikut diperbarui.
            </p>
          )}
        </div>
        <span className="msg-time">{time || ''}</span>
      </div>
    </div>
  );
}

export default ChatBubble;
