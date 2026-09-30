import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isLogin = mode === 'login';

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Email dan password wajib diisi ya.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password minimal 6 karakter.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMsg('Akun berhasil dibuat! Silakan cek email untuk verifikasi, lalu login.');
        setMode('login');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan. Coba lagi ya.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setErrorMsg('');
    setSuccessMsg('');
  }

  return (
    <div className="login-page">
      {/* hiasan background */}
      <div className="login-blob login-blob-1" aria-hidden="true" />
      <div className="login-blob login-blob-2" aria-hidden="true" />
      <div className="login-blob login-blob-3" aria-hidden="true" />

      <div className="login-card">
        {/* Panel kiri - branding */}
        <div className="login-brand">
          <div className="login-logo">
            <span className="login-logo-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="6" width="20" height="13" rx="3" fill="white" opacity="0.95" />
                <rect x="2" y="6" width="20" height="5" rx="2.5" fill="#10b981" />
                <circle cx="17.5" cy="14.5" r="1.8" fill="#065f46" />
                <path d="M6 3.5h9l-1.5 2.5H6z" fill="white" opacity="0.9" />
              </svg>
            </span>
            <span className="login-logo-text">Taktuntuwang</span>
          </div>

          <h1 className="login-title">
            Kelola uang
            <br />
            semudah <span className="login-highlight">ngobrol.</span>
          </h1>
          <p className="login-subtitle">
            Ceritakan aja pemasukan &amp; pengeluaran kamu, biar AI yang mencatat dan merangkumnya.
          </p>

          <ul className="login-features">
            <li>
              <span className="login-feat-icon">💬</span>
              <div>
                <strong>Chat-based tracking</strong>
                <span>Ketik natural, otomatis tercatat</span>
              </div>
            </li>
            <li>
              <span className="login-feat-icon">📊</span>
              <div>
                <strong>Ringkasan visual</strong>
                <span>Grafik harian, mingguan, bulanan</span>
              </div>
            </li>
            <li>
              <span className="login-feat-icon">🔒</span>
              <div>
                <strong>Aman &amp; privat</strong>
                <span>Data terenkripsi via Supabase Auth</span>
              </div>
            </li>
          </ul>

          <div className="login-brand-footer">
            <div className="login-avatars">
              <span>🧑‍💼</span>
              <span>👩‍🎓</span>
              <span>👨‍💻</span>
              <span className="login-avatars-more">2k+</span>
            </div>
            <p>Dipercaya 2.000+ pengguna hemat</p>
          </div>
        </div>

        {/* Panel kanan - form */}
        <div className="login-form-wrap">
          <div className="login-tabs">
            <button
              type="button"
              className={isLogin ? 'login-tab active' : 'login-tab'}
              onClick={() => switchMode('login')}
            >
              Masuk
            </button>
            <button
              type="button"
              className={!isLogin ? 'login-tab active' : 'login-tab'}
              onClick={() => switchMode('register')}
            >
              Daftar
            </button>
            <span className={`login-tab-pill ${isLogin ? 'left' : 'right'}`} aria-hidden="true" />
          </div>

          <h2 className="login-form-title">
            {isLogin ? 'Selamat datang kembali 👋' : 'Buat akun barumu ✨'}
          </h2>
          <p className="login-form-desc">
            {isLogin
              ? 'Masuk untuk lanjut mencatat keuanganmu hari ini.'
              : 'Gratis, cuma butuh email dan password.'}
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span className="login-label">Email</span>
              <span className="login-input-wrap">
                <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                <input
                  type="email"
                  placeholder="kamu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            <label className="login-field">
              <span className="login-label">Password</span>
              <span className="login-input-wrap">
                <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder={isLogin ? 'Masukkan password' : 'Minimal 6 karakter'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPw ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.5 10.5 0 0 1 12 19c-5 0-9-4.5-10-7 1-2.5 5-7 10-7a10.6 10.6 0 0 1 4.06.8" />
                      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                      <path d="m2 2 20 20" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </span>
            </label>

            {errorMsg && (
              <div className="login-alert login-alert-error" role="alert">
                <span>⚠️</span>
                <p>{errorMsg}</p>
              </div>
            )}
            {successMsg && (
              <div className="login-alert login-alert-success" role="status">
                <span>✅</span>
                <p>{successMsg}</p>
              </div>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  {isLogin ? 'Masuk...' : 'Mendaftar...'}
                </>
              ) : (
                <>{isLogin ? 'Masuk →' : 'Buat Akun Gratis →'}</>
              )}
            </button>
          </form>

          <p className="login-switch">
            {isLogin ? (
              <>Belum punya akun? <button type="button" onClick={() => switchMode('register')}>Daftar gratis</button></>
            ) : (
              <>Sudah punya akun? <button type="button" onClick={() => switchMode('login')}>Masuk di sini</button></>
            )}
          </p>

          <p className="login-terms">
            Dengan lanjut, kamu setuju dengan Syarat &amp; Kebijakan Privasi Taktuntuwang.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
